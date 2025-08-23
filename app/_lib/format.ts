export function formatDateISOToLong(d?: string | null) {
  if (!d) return;
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return;
  return dt.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}
export function formatRuntimeMinutes(mins?: number | null) {
  if (mins == null) return;
  const h = Math.floor(mins / 60), m = mins % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}
export function estimateReadingHoursFromPages(p?: number | null) {
  if (!p) return;
  const hours = p / 60;
  const rounded = Math.max(0.5, Math.round(hours * 2) / 2);
  return `${rounded} hr${rounded === 1 ? "" : "s"}`;
}
