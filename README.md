# Team Daily Tracker

Simple, professional daily work tracker for a 5-person team. No login. Next.js + MongoDB Atlas, deployable on Netlify.

## Features
- **Dashboard** — create/remove team members; each member gets their own page.
- **Member page** — pick any date (defaults to today) and fill the day sheet:
  - 5 time slots: `9:30-11:30`, `11:30-1:30`, `1:30-2:30 (Lunch)`, `2:30-4:30`, `4:30-6:30`
  - Each slot: **Task 1**, **Task 2**, **Blockage / Reason** (why work wasn't done)
  - End of sheet: **Extra Work Hours** + **what extra work was done**
- **Date-wise storage** — 10 Sep sheet saves under 10 Sep; on 11 Sep a fresh blank template appears. Old dates can be reopened any time.
- **Reports & Export** — pick a range (defaults to the current Mon–Sun week), view the full team table, export to **Excel (.xlsx)** or **PDF**, then **delete that range** to keep the free MongoDB tier light.

## Local run
```bash
npm install
npm run dev     # http://localhost:3000
```

`.env.local` already contains:
```
MONGODB_URI=mongodb+srv://DeepakVish:...@deepaknexus.qgu35yc.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB=team_tracker
```

## Deploy on Netlify
1. Push this folder to a GitHub repo.
2. Netlify → **Add new site → Import an existing project** → pick the repo.
3. Build settings are read from `netlify.toml` (`npm run build`, `@netlify/plugin-nextjs`).
4. **Site settings → Environment variables** → add `MONGODB_URI` and `MONGODB_DB` (same values as `.env.local`; `.env.local` is gitignored so it will not be pushed).
5. Deploy.

MongoDB Atlas: **Network Access → Add IP → 0.0.0.0/0** so Netlify's servers can connect.

## Data model
- `members`: `{ name, role, createdAt }`
- `entries`: `{ memberId, memberName, date: "YYYY-MM-DD", slots: [{ id, task1, task2, blockage }], extraHours, extraWork, updatedAt }`
  — one document per member per date (upsert on save).

## Weekly routine
Friday/Saturday → **Reports & Export** → *This Week* → Export Excel + PDF → *Delete This Range*.
