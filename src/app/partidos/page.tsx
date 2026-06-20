"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/Badge";
import { BottomNav } from "@/components/BottomNav";
import type { Match, Standing } from "@/lib/types";

export default function Partidos() {
  const supabase = useMemo(() => createClient(), []);
  const [matches, setMatches] = useState<Match[]>([]);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [followTeams, setFollowTeams] = useState<Set<string>>(new Set());
  const [followLeagues, setFollowLeagues] = useState<Set<string>>(new Set());
  const [hasFollows, setHasFollows] = useState(false);
  const [loading, setLoading] = useState(true);

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

  const recent = fMatches.filter((m) => m.status === "final");
  const upcoming = fMatches.filter((m) => m.status !== "final");

  // Agrupar tabla por competición
  const byComp = new Map<string, { name: string; rows: Standing[] }>();
  for (const s of fStandings) {
    const key = s.competition_id || "x";
    if (!byComp.has(key)) byComp.set(key, { name: s.competition?.short_name || s.competition?.name || "Tabla", rows: [] });
    byComp.get(key)!.rows.push(s);
  }

  return (
    <main className="app-shell bg-cream text-ink min-h-screen">
      <div className="px-5 pt-12 pb-28">
        <h1 className="display text-4xl mb-1">Partidos</h1>
        <p className="text-sm text-black/45 mb-4">
          {hasFollows ? "De tus equipos y ligas" : "Todo el rugby"}
        </p>

        {fallback && (
          <div className="bg-white rounded-2xl p-4 text-sm text-black/55 mb-4">
            Todavía no hay partidos cargados de tus equipos/ligas. Te mostramos toda la agenda mientras tanto.
          </div>
        )}

        {/* 1) RESULTADOS */}
        <SectionTitle>RESULTADOS</SectionTitle>
        <div className="space-y-3">
          {recent.map((m) => <FixtureRow key={m.id} m={m} />)}
          {recent.length === 0 && <Empty>Sin resultados todavía.</Empty>}
        </div>

        {/* 2) TABLA DE POSICIONES */}
        {[...byComp.values()].map((g, gi) => (
          <div key={gi}>
            <SectionTitle className="mt-6">TABLA · {g.name.toUpperCase()}</SectionTitle>
            <div className="bg-white rounded-2xl overflow-hidden">
              <div className="grid grid-cols-[24px_1fr_40px_48px_48px] gap-2 px-4 py-3 text-xs text-black/45 font-semibold border-b border-black/5">
                <span>#</span><span>EQUIPO</span><span className="text-right">PJ</span><span className="text-right">DIF</span><span className="text-right">PTS</span>
              </div>
              {g.rows.map((s, i) => (
                <div key={s.id} className={`grid grid-cols-[24px_1fr_40px_48px_48px] gap-2 px-4 py-3 items-center ${i % 2 ? "bg-black/[0.02]" : ""}`}>
                  <span className="font-bold text-brand">{s.position}</span>
                  <span className="flex items-center gap-2">
                    <Badge label={s.team?.short_name || "?"} color={s.team?.color} size={26} />
                    <span className="font-semibold text-sm">{s.team?.name}</span>
                  </span>
                  <span className="text-right text-sm">{s.played}</span>
                  <span className="text-right text-sm">{s.diff > 0 ? "+" : ""}{s.diff}</span>
                  <span className="text-right font-bold">{s.points}</span>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* 3) PRÓXIMOS PARTIDOS */}
        <SectionTitle className="mt-6">PRÓXIMOS PARTIDOS</SectionTitle>
        <div className="space-y-3">
          {upcoming.map((m) => (
            <Link key={m.id} href={`/partidos/${m.id}`} className="block">
              <FixtureRow m={m} clickable />
            </Link>
          ))}
          {upcoming.length === 0 && <Empty>No hay próximos partidos cargados.</Empty>}
        </div>

        {loading && <p className="text-center text-black/40 mt-8">Cargando…</p>}
      </div>
      <BottomNav />
    </main>
  );
}

function FixtureRow({ m, clickable = false }: { m: Match; clickable?: boolean }) {
  const d = m.kickoff_at ? new Date(m.kickoff_at) : null;
  return (
    <div className={`bg-white rounded-2xl p-4 flex items-center gap-3 ${clickable ? "active:scale-[0.99] transition" : ""}`}>
      <div className="text-center w-12 shrink-0">
        {d ? (
          <>
            <div className="display text-2xl leading-none">{d.getDate().toString().padStart(2, "0")}</div>
            <div className="text-[11px] text-black/45 uppercase">{d.toLocaleString("es-CL", { month: "short" })}</div>
          </>
        ) : <div className="text-xs text-black/40">—</div>}
      </div>
      <div className="flex-1 space-y-1">
        <Side team={m.home_team} score={m.home_score} />
        <Side team={m.away_team} score={m.away_score} />
      </div>
      <div className="text-right shrink-0">
        {m.status === "final" ? (
          <span className="text-xs font-semibold text-black/40">FINAL</span>
        ) : (
          <span className="text-brand font-bold">
            {d ? d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }) : ""}
          </span>
        )}
        <div className="text-[11px] text-black/40">
          {m.competition?.short_name} {m.round ? "· " + m.round : ""}
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
  return <h2 className={`text-xs tracking-[0.15em] text-black/45 font-semibold mb-3 ${className}`}>{children}</h2>;
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div className="bg-white rounded-2xl p-5 text-center text-black/55">{children}</div>;
}
