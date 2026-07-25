"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/Badge";
import { BottomNav } from "@/components/BottomNav";
import type { Match, Standing } from "@/lib/types";
import { isLiveNow, streamingFor } from "@/lib/live";
import { withRound } from "@/lib/format";

const PAST_LIMIT = 10; // resultados visibles
const UPCOMING_WINDOW_DAYS = 62; // ~2 meses hacia adelante

export default function Partidos() {
  const supabase = useMemo(() => createClient(), []);
  const [matches, setMatches] = useState<Match[]>([]);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [followTeams, setFollowTeams] = useState<Set<string>>(new Set());
  const [followLeagues, setFollowLeagues] = useState<Set<string>>(new Set());
  const [hasFollows, setHasFollows] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"proximos" | "pasados">("proximos");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      let teamIds: string[] = [], leagueIds: string[] = [];
      if (user) {
        const { data: f } = await supabase
          .from("follows").select("team_id, competition_id").eq("user_id", user.id);
        teamIds = (f || []).map((r) => r.team_id).filter(Boolean) as string[];
        leagueIds = (f || []).map((r) => r.competition_id).filter(Boolean) as string[];
      } else {
        try {
          const local = JSON.parse(localStorage.getItem("tribuna_follows") || "{}");
          teamIds = local.teams || [];
          leagueIds = local.leagues || [];
        } catch {}
      }
      setFollowTeams(new Set(teamIds));
      setFollowLeagues(new Set(leagueIds));
      setHasFollows(teamIds.length + leagueIds.length > 0);

      const { data: m } = await supabase
        .from("matches")
        .select("*, home_team:home_team_id(*), away_team:away_team_id(*), competition:competition_id(*)")
        .order("kickoff_at", { ascending: true });
      const { data: s } = await supabase
        .from("standings")
        .select("*, team:team_id(*), competition:competition_id(*)")
        .order("position", { ascending: true });
      setMatches((m as Match[]) || []);
      setStandings((s as Standing[]) || []);
      setLoading(false);
    })();
  }, [supabase]);

  const matchMine = (m: Match) =>
    followTeams.has(m.home_team_id || "") ||
    followTeams.has(m.away_team_id || "") ||
    followLeagues.has(m.competition_id || "") ||
    followLeagues.has(m.home_team?.competition_id || "") ||
    followLeagues.has(m.away_team?.competition_id || "");

  const standingMine = (s: Standing) =>
    followLeagues.has(s.competition_id || "") ||
    followTeams.has(s.team_id || "") ||
    followLeagues.has(s.team?.competition_id || "");

  // Filtramos por lo que sigue el usuario; si no sigue nada (o nada coincide) mostramos todo.
  const fMatches = hasFollows && matches.some(matchMine) ? matches.filter(matchMine) : matches;
  const fStandings = hasFollows && standings.some(standingMine) ? standings.filter(standingMine) : standings;
  const fallback = hasFollows && (!matches.some(matchMine) || !standings.some(standingMine));

  const liveMatches = fMatches.filter((m) => isLiveNow(m));
  const liveIds = new Set(liveMatches.map((m) => m.id));

  // Pasados: solo los últimos N resultados (del más reciente al más antiguo).
  const recent = fMatches
    .filter((m) => m.status === "final")
    .sort((a, b) => (b.kickoff_at || "").localeCompare(a.kickoff_at || ""))
    .slice(0, PAST_LIMIT);

  // Próximos: hasta ~2 meses hacia adelante para no alargar el scroll.
  const horizon = Date.now() + UPCOMING_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const upcomingAll = fMatches.filter((m) => m.status !== "final" && !liveIds.has(m.id));
  const upcoming = upcomingAll.filter(
    (m) => !m.kickoff_at || new Date(m.kickoff_at).getTime() <= horizon
  );
  const hiddenUpcoming = upcomingAll.length - upcoming.length;

  // Agrupar tabla por competición
  const byComp = new Map<string, { name: string; rows: Standing[] }>();
  for (const s of fStandings) {
    const key = s.competition_id || "x";
    if (!byComp.has(key)) byComp.set(key, { name: s.competition?.short_name || s.competition?.name || "Tabla", rows: [] });
    byComp.get(key)!.rows.push(s);
  }

  return (
    <main className="app-shell bg-cream text-white min-h-screen">
      <div className="px-5 pt-12 pb-28">
        <h1 className="display text-4xl mb-1">Partidos</h1>
        <p className="text-sm text-white/55 mb-4">
          {hasFollows ? "De tus equipos y ligas" : "Todo el rugby"}
        </p>

        {fallback && (
          <div className="bg-card border border-white/5 rounded-2xl p-4 text-sm text-white/65 mb-4">
            Todavía no hay partidos cargados de tus equipos/ligas. Te mostramos toda la agenda mientras tanto.
          </div>
        )}

        {/* 0) EN VIVO AHORA — siempre visible, arriba de todo */}
        {liveMatches.length > 0 && (
          <div className="mb-5">
            <h2 className="text-xs tracking-[0.15em] text-red-600 font-bold mb-3 flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-red-600 animate-pulse" /> EN VIVO AHORA
            </h2>
            <div className="space-y-3">
              {liveMatches.map((m) => <LiveRow key={m.id} m={m} />)}
            </div>
          </div>
        )}

        {/* Selector Próximos / Resultados */}
        <div className="flex bg-card border border-white/5 rounded-full p-1 mb-4">
          <TabBtn active={tab === "proximos"} onClick={() => setTab("proximos")}>Próximos</TabBtn>
          <TabBtn active={tab === "pasados"} onClick={() => setTab("pasados")}>Resultados</TabBtn>
        </div>

        {tab === "proximos" && (
          <>
            <div className="space-y-3">
              {upcoming.map((m) => (
                <Link key={m.id} href={`/partidos/${m.id}`} className="block">
                  <FixtureRow m={m} clickable />
                </Link>
              ))}
              {upcoming.length === 0 && !loading && <Empty>No hay próximos partidos en los próximos 2 meses.</Empty>}
            </div>
            {hiddenUpcoming > 0 && (
              <p className="text-center text-xs text-white/45 mt-3">
                Mostrando los próximos 2 meses · {hiddenUpcoming} partido{hiddenUpcoming === 1 ? "" : "s"} más adelante
              </p>
            )}
          </>
        )}

        {tab === "pasados" && (
          <>
            <div className="space-y-3">
              {recent.map((m) => (
                <Link key={m.id} href={`/partidos/${m.id}`} className="block">
                  <FixtureRow m={m} clickable />
                </Link>
              ))}
              {recent.length === 0 && !loading && <Empty>Sin resultados todavía.</Empty>}
            </div>
            {recent.length === PAST_LIMIT && (
              <p className="text-center text-xs text-white/45 mt-3">Mostrando los últimos {PAST_LIMIT} resultados</p>
            )}

            {/* Tabla de posiciones */}
            {[...byComp.values()].map((g, gi) => (
              <div key={gi}>
                <SectionTitle className="mt-6">TABLA · {g.name.toUpperCase()}</SectionTitle>
                <div className="bg-card border border-white/5 rounded-2xl overflow-hidden">
                  <div className="grid grid-cols-[24px_1fr_40px_48px_48px] gap-2 px-4 py-3 text-xs text-white/55 font-semibold border-b border-white/10">
                    <span>#</span><span>EQUIPO</span><span className="text-right">PJ</span><span className="text-right">DIF</span><span className="text-right">PTS</span>
                  </div>
                  {g.rows.map((s, i) => (
                    <div key={s.id} className={`grid grid-cols-[24px_1fr_40px_48px_48px] gap-2 px-4 py-3 items-center ${i % 2 ? "bg-white/[0.04]" : ""}`}>
                      <span className="font-bold text-brand">{s.position}</span>
                      {s.team?.slug ? (
                        <Link href={`/equipos/${s.team.slug}`} className="flex items-center gap-2">
                          <Badge label={s.team?.short_name || "?"} color={s.team?.color} size={26} />
                          <span className="font-semibold text-sm">{s.team?.name}</span>
                        </Link>
                      ) : (
                        <span className="flex items-center gap-2">
                          <Badge label={s.team?.short_name || "?"} color={s.team?.color} size={26} />
                          <span className="font-semibold text-sm">{s.team?.name}</span>
                        </span>
                      )}
                      <span className="text-right text-sm">{s.played}</span>
                      <span className="text-right text-sm">{s.diff > 0 ? "+" : ""}{s.diff}</span>
                      <span className="text-right font-bold">{s.points}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}

        {loading && <p className="text-center text-white/50 mt-8">Cargando…</p>}
      </div>
      <BottomNav />
    </main>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-full py-2 text-sm font-semibold transition ${
        active ? "bg-brand text-white" : "text-white/55"
      }`}
    >
      {children}
    </button>
  );
}

function LiveRow({ m }: { m: Match }) {
  const stream = streamingFor(m);
  return (
    <Link href={`/partidos/${m.id}`} className="block bg-card border border-white/5 rounded-2xl p-4 border-2 border-red-500/70 active:scale-[0.99] transition">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-bold text-red-600 flex items-center gap-1.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" /> EN VIVO
        </span>
        <span className="text-[11px] text-white/50">{withRound(m.competition?.short_name, m.round)}</span>
      </div>
      <div className="space-y-1">
        <Side team={m.home_team} score={m.home_score} />
        <Side team={m.away_team} score={m.away_score} />
      </div>
      <div className="mt-2 text-[11px] font-semibold text-red-600">
        {stream.url ? "Ver en vivo ↗" : stream.platform ? `En vivo por ${stream.platform}` : "Ver detalle ›"}
      </div>
    </Link>
  );
}

function FixtureRow({ m, clickable = false }: { m: Match; clickable?: boolean }) {
  const d = m.kickoff_at ? new Date(m.kickoff_at) : null;
  const stream = streamingFor(m);
  return (
    <div className={`bg-card border border-white/5 rounded-2xl p-4 flex items-center gap-3 ${clickable ? "active:scale-[0.99] transition" : ""}`}>
      <div className="text-center w-12 shrink-0">
        {d ? (
          <>
            <div className="display text-2xl leading-none">{d.getDate().toString().padStart(2, "0")}</div>
            <div className="text-[11px] text-white/55 uppercase">{d.toLocaleString("es-CL", { month: "short" })}</div>
          </>
        ) : <div className="text-xs text-white/50">—</div>}
      </div>
      <div className="flex-1 space-y-1">
        <Side team={m.home_team} score={m.home_score} />
        <Side team={m.away_team} score={m.away_score} />
        {m.status !== "final" && stream.platform && (
          <div className="text-[11px] text-white/45 pt-0.5">📺 {stream.platform}</div>
        )}
      </div>
      <div className="text-right shrink-0">
        {m.status === "final" ? (
          <span className="text-xs font-semibold text-white/50">FINAL</span>
        ) : (
          <span className="text-brand font-bold">
            {d ? d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }) : ""}
          </span>
        )}
        <div className="text-[11px] text-white/50">
          {withRound(m.competition?.short_name, m.round)}
        </div>
        {clickable && <div className="text-[11px] text-brand font-semibold mt-0.5">Ver ›</div>}
      </div>
    </div>
  );
}

function Side({ team, score }: { team?: Match["home_team"]; score: number | null }) {
  return (
    <div className="flex items-center gap-2">
      <Badge label={team?.short_name || "?"} color={team?.color} size={24} />
      <span className="font-semibold text-sm flex-1">{team?.name}</span>
      {score !== null && <span className="font-bold">{score}</span>}
    </div>
  );
}

function SectionTitle({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <h2 className={`text-xs tracking-[0.15em] text-white/55 font-semibold mb-3 ${className}`}>{children}</h2>;
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div className="bg-card border border-white/5 rounded-2xl p-5 text-center text-white/65">{children}</div>;
}
