/**
 * Une competición y ronda evitando repetir cuando coinciden
 * (ej. "Nations Cup · Nations Cup" → "Nations Cup"; "URBA · Fecha 12" se mantiene).
 */
export function withRound(base?: string | null, round?: string | null): string {
  const b = (base || "").trim();
  const r = (round || "").trim();
  if (!r) return b;
  if (!b) return r;
  const nb = b.toLowerCase();
  const nr = r.toLowerCase();
  if (nb === nr || nb.includes(nr) || nr.includes(nb)) return b;
  return `${b} · ${r}`;
}
