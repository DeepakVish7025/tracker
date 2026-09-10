const PALETTE = ["#16a34a", "#0d9488", "#059669", "#65a30d", "#0e7490", "#15803d", "#4d7c0f", "#047857"];

export function initials(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (parts[0][0] + last).toUpperCase();
}

// Stable colour per name so a member keeps the same avatar everywhere.
export function avatarColor(name = "") {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
