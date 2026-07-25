import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/Badge";
import { BottomNav } from "@/components/BottomNav";
import { applyAffiliate, programLookup, type AffiliateProgram } from "@/lib/affiliate";
import { MatchPrediction } from "@/components/MatchPrediction";
import type { Match, Team } from "@/lib/types";
import { isLiveNow, streamingFor } from "@/lib/live";
import { withRound } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function MatchDetail({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("matches")
    .select("*, home_team:home_team_id(*), away_team:away_team_id(*), competition:competition_id(*)")
    .eq("id", params.id)
    .maybeSingle();

  const m = data as Match | null;

  const { data: programData } = await supabase
    .from("affiliate_programs").select("*").eq("active", true);
  const findProgram = programLookup((programData as AffiliateProgram[]) || []);

  if (!m) {
    return (
      <main className="app-shell bg-cream text-white min-h-screen">
        <div className="px-5 pt-12 pb-28">
          <Link href="/partidos" className="text-brand font-semibold text-sm">‹ Partidos</Link>
          <div className="bg-card border border-white/5 rounded-2xl p-6 mt-6 text-center text-white/65">
            No encontramos este partido.
          </div>
        </div>
        <BottomNav />
      </main>
    );
  }

  const d = m.kickoff_at ? new Date(m.kickoff_at) : null;
  const isFinal = m.status === "final";
  const live = isLiveNow(m);
  const stream = streamingFor(m);
  const fecha = d
    ? d.toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" })
    : "Fecha por confirmar";
  const hora = d ? d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }) : null;

  // Navegación cronológica entre partidos (para cargar predicciones en serie)
  let prevMatch: NavMatch | null = null;
  let nextMatch: NavMatch | null = null;
  if (m.kickoff_at) {
    const navSel = "id, kickoff_at, home_team:home_team_id(short_name), away_team:away_team_id(short_name)";
    const [{ data: prev }, { data: next }] = await Promise.all([
      supabase.from("matches").select(navSel)
        .lt("kickoff_at", m.kickoff_at).order("kickoff_at", { ascending: false }).limit(1),
      supabase.from("matches").select(navSel)
        .gt("kickoff_at", m.kickoff_at).order("kickoff_at", { ascending: true }).limit(1),
    ]);
    prevMatch = (prev?.[0] as unknown as NavMatch) || null;
    nextMatch = (next?.[0] as unknown as NavMatch) || null;
  }

  return (
    <main className="app-shell bg-cream text-white min-h-screen">
      <div className="px-5 pt-12 pb-28">
        <Link href="/partidos" className="text-brand font-semibold text-sm">‹ Partidos</Link>

        {(prevMatch || nextMatch) && (
          <div className="flex items-center justify-between gap-2 mt-4">
            <MatchNavLink dir="prev" match={prevMatch} />
            <span className="text-[11px] text-white/45 font-semibold uppercase tracking-wide">Partido</span>
            <MatchNavLink dir="next" match={nextMatch} />
          </div>
        )}

        <p className="text-xs tracking-[0.15em] text-white/55 font-semibold mt-5">
          {withRound(m.competition?.name || "Partido", m.round)}
        </p>

        {/* Marcador / enfrentamiento */}
        <div className="bg-card border border-white/5 rounded-2xl p-6 mt-3">
          <div className="flex items-center justify-between">
            <TeamCol team={m.home_team} />
            <div className="text-center px-3">
              {isFinal ? (
                <div className="display text-4xl">{m.home_score} – {m.away_score}</div>
              ) : (
                <div className="display text-2xl text-brand">{hora || "VS"}</div>
              )}
              <div className={`text-[11px] mt-1 font-semibold ${live ? "text-red-600" : "text-white/50"}`}>
                {isFinal ? "FINAL" : live ? "● EN VIVO" : "POR JUGARSE"}
              </div>
            </div>
            <TeamCol team={m.away_team} />
          </div>
        </div>

        {/* Dónde verlo */}
        {!isFinal && (
          <div className="mt-4">
            <p className="text-xs tracking-[0.15em] text-white/55 font-semibold mb-2">DÓNDE VERLO</p>
            {live && stream.url ? (
              <a href={stream.url} target="_blank" rel="noopener noreferrer"
                 className="block w-full text-center bg-red-600 hover:bg-red-700 transition text-white rounded-2xl py-4 font-bold tracking-wide">
                ● VER EN VIVO AHORA{stream.platform ? ` · ${stream.platform}` : ""} ↗
              </a>
            ) : stream.platform || stream.url ? (
              <div className="bg-card border border-white/5 rounded-2xl p-4 flex items-center justify-between gap-3">
                <div className="text-sm">
                  <div className={live ? "text-red-600 font-semibold" : "text-white/55"}>
                    {live ? "● En vivo ahora por" : "Se transmite por"}
                  </div>
                  <div className="font-bold text-base">📺 {stream.platform || "Streaming"}</div>
                </div>
                {stream.url && (
                  <a href={stream.url} target="_blank" rel="noopener noreferrer"
                     className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${live ? "bg-red-600 text-white" : "bg-brand text-white"}`}>
                    {live ? "Ver en vivo ↗" : "Ir a la plataforma ↗"}
                  </a>
                )}
              </div>
            ) : (
              <div className="bg-card border border-white/5 rounded-2xl p-4 text-sm text-white/65">
                Transmisión a confirmar.
              </div>
            )}
          </div>
        )}

        {/* Datos */}
        <div className="bg-card border border-white/5 rounded-2xl p-4 mt-4 space-y-2 text-sm">
          <Row label="Fecha" value={fecha[0].toUpperCase() + fecha.slice(1)} />
          {hora && <Row label="Hora" value={hora} />}
          {m.venue && <Row label="Estadio" value={m.venue} />}
          {m.city && <Row label="Ciudad" value={m.city} />}
          {m.competition?.name && <Row label="Competición" value={m.competition.name} />}
        </div>

        {/* Predicción del marcador */}
        <MatchPrediction
          matchId={m.id}
          homeName={m.home_team?.name || "Local"}
          awayName={m.away_team?.name || "Visita"}
          homeShort={m.home_team?.short_name || "?"}
          awayShort={m.away_team?.short_name || "?"}
          kickoffISO={m.kickoff_at}
          status={m.status}
          homeScore={m.home_score}
          awayScore={m.away_score}
        />

        {/* Entradas */}
        {!isFinal && (
          <div className="mt-4">
            {m.tickets_url ? (
              <a
                href={applyAffiliate(m.tickets_url, findProgram(m.ticket_vendor))}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center bg-brand hover:bg-brand-600 transition text-white rounded-2xl py-4 font-bold tracking-wide"
              >
                COMPRAR ENTRADAS{m.ticket_vendor ? ` · ${m.ticket_vendor}` : ""} ↗
              </a>
            ) : (
              <div className="bg-card border border-white/5 rounded-2xl py-4 text-center text-white/65 text-sm">
                {m.ticket_vendor ? m.ticket_vendor : "Entradas a confirmar"}
                {m.ticket_vendor === "Entrada liberada" && (
                  <span className="block text-xs text-white/50 mt-1">Mecanismo de entrega a confirmar por la organización.</span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Resumen */}
        {isFinal && m.summary_url && (
          <a
            href={m.summary_url}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-center bg-card border border-white/5 rounded-2xl py-4 font-bold text-brand mt-4"
          >
            VER RESUMEN ↗
          </a>
        )}
      </div>
      <BottomNav />
    </main>
  );
}

type NavMatch = {
  id: string;
  kickoff_at: string | null;
  home_team?: { short_name: string | null } | null;
  away_team?: { short_name: string | null } | null;
};

function MatchNavLink({ dir, match }: { dir: "prev" | "next"; match: NavMatch | null }) {
  const label = match
    ? `${match.home_team?.short_name || "?"}–${match.away_team?.short_name || "?"}`
    : "—";
  const base = "flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold";
  if (!match) {
    return <span className={`${base} bg-white/[0.06] text-white/40`}>{dir === "prev" ? "‹ Anterior" : "Próximo ›"}</span>;
  }
  return (
    <Link href={`/partidos/${match.id}`} className={`${base} bg-card text-brand active:scale-95 transition`}>
      {dir === "prev" ? <>‹ <span className="text-white/55 font-normal">{label}</span></> : <><span className="text-white/55 font-normal">{label}</span> ›</>}
    </Link>
  );
}

function TeamCol({ team }: { team?: Team | null }) {
  const inner = (
    <>
      <Badge label={team?.short_name || "?"} color={team?.color} size={56} />
      <span className="font-bold text-center leading-tight">{team?.name}</span>
    </>
  );
  if (team?.slug) {
    return (
      <Link href={`/equipos/${team.slug}`} className="flex flex-col items-center gap-2 flex-1">
        {inner}
      </Link>
    );
  }
  return <div className="flex flex-col items-center gap-2 flex-1">{inner}</div>;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-white/55">{label}</span>
      <span className="font-semibold text-right">{value}</span>
    </div>
  );
}
