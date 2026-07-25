import type { Match } from "./types";

// Duración típica de un partido + entretiempo/descuento (minutos).
const MATCH_WINDOW_MIN = 110;

/**
 * Un partido está "en vivo ahora" si su status es 'live', o si está
 * programado y la hora actual cae dentro de la ventana de juego desde el
 * kickoff. Esto cubre el caso en que el status todavía no se actualizó.
 */
export function isLiveNow(m: Pick<Match, "status" | "kickoff_at">, now: Date = new Date()): boolean {
  if (m.status === "final" || m.status === "postponed") return false;
  if (m.status === "live") return true;
  if (!m.kickoff_at) return false;
  const start = new Date(m.kickoff_at).getTime();
  const t = now.getTime();
  return t >= start && t <= start + MATCH_WINDOW_MIN * 60_000;
}

// URL canónica de la app/plataforma que transmite. Así, si no hay un link
// directo al partido, el botón abre la plataforma (Disney+, ESPN, etc.) y no
// hay que administrar URLs que cambian con cada partido.
const PLATFORM_URLS: { match: RegExp; url: string }[] = [
  { match: /disney/i, url: "https://www.disneyplus.com" },
  { match: /espn/i, url: "https://www.espn.cl/deportes/rugby/" },
  { match: /\btvn\b/i, url: "https://www.tvn.cl/envivo" },
  { match: /youtube/i, url: "https://www.youtube.com/results?search_query=rugby+en+vivo" },
  { match: /star\+|star plus/i, url: "https://www.starplus.com" },
];

/** Devuelve la URL de la plataforma a partir de su nombre (o null si no la conocemos). */
export function platformUrl(platform: string | null | undefined): string | null {
  if (!platform) return null;
  for (const p of PLATFORM_URLS) if (p.match.test(platform)) return p.url;
  return null;
}

/**
 * Streaming efectivo de un partido: plataforma + URL. La URL es, en orden:
 * link directo del partido > link directo de la competición > URL de la app
 * de la plataforma (para no depender de links cambiantes).
 */
export function streamingFor(m: Match): { platform: string | null; url: string | null } {
  const platform = m.streaming_platform || m.competition?.streaming_platform || null;
  const url = m.streaming_url || m.competition?.streaming_url || platformUrl(platform);
  return { platform, url };
}
