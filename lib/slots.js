export const SLOTS = [
  { id: "s1", label: "9:30 - 11:30", lunch: false },
  { id: "s2", label: "11:30 - 1:30", lunch: false },
  { id: "s3", label: "1:30 - 2:30", lunch: true },
  { id: "s4", label: "2:30 - 4:30", lunch: false },
  { id: "s5", label: "4:30 - 6:30", lunch: false },
];

export const LUNCH_IDS = new Set(SLOTS.filter((s) => s.lunch).map((s) => s.id));

export const MIN_TASKS = 2;

export function emptySlots() {
  return SLOTS.map((s) => ({ id: s.id, tasks: Array(MIN_TASKS).fill(""), blockage: "" }));
}

// Slots used to be stored as { task1, task2 }. Newer entries store { tasks: [...] }.
// This reads both shapes so old sheets keep opening correctly.
export function normalizeSlot(raw) {
  const tasks = Array.isArray(raw?.tasks)
    ? [...raw.tasks]
    : [raw?.task1 || "", raw?.task2 || ""];
  while (tasks.length < MIN_TASKS) tasks.push("");
  return { tasks, blockage: raw?.blockage || "" };
}

export function normalizeEntrySlots(rawSlots) {
  const list = rawSlots || [];
  return SLOTS.map((s) => ({ id: s.id, ...normalizeSlot(list.find((x) => x.id === s.id)) }));
}

export function todayStr() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

export function shiftDate(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + days * 86400000).toISOString().slice(0, 10);
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

// Strips blank tasks, drops the lunch slot, and drops slots with nothing in them.
export function meaningfulSlots(slots) {
  return (slots || [])
    .filter((s) => !LUNCH_IDS.has(s.id))
    .map((s) => ({ ...s, tasks: (s.tasks || []).filter((t) => t && t.trim()) }))
    .filter((s) => s.tasks.length || (s.blockage && s.blockage.trim()));
}
