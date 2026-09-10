export const SLOTS = [
  { id: "s1", label: "9:30 - 11:30", lunch: false },
  { id: "s2", label: "11:30 - 1:30", lunch: false },
  { id: "s3", label: "1:30 - 2:30 (Lunch)", lunch: true },
  { id: "s4", label: "2:30 - 4:30", lunch: false },
  { id: "s5", label: "4:30 - 6:30", lunch: false },
];

export function emptySlots() {
  return SLOTS.map((s) => ({ id: s.id, task1: "", task2: "", blockage: "" }));
}

export function todayStr() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

export function prettyDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${d} ${months[m - 1]} ${y}`;
}

export function weekRange(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = dt.getUTCDay();
  const diff = dow === 0 ? -6 : 1 - dow; // Monday start
  const start = new Date(dt.getTime() + diff * 86400000);
  const end = new Date(start.getTime() + 6 * 86400000);
  const f = (x) => x.toISOString().slice(0, 10);
  return { from: f(start), to: f(end) };
}
