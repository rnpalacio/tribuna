"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/Badge";
import { BottomNav } from "@/components/BottomNav";
import type { Match } from "@/lib/types";
import { withRound } from "@/lib/format";

const LIMIT = 10;
const LOCAL_KEY = "tribuna_winner_picks";

type Counts = Record<string, Record<string, number>>; // matchId -> teamId -> votos

export default function Prediccion() {
  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [counts, setCounts] = useState<Counts>({});
  const [loading, setLoading] = useState(true);
  const [usedFallback, setUsedFallback] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);

      // Ligas que sigue el usuario (BD o localStorage para anónimos)
      let leagueIds: string[] = [];
      if (user) {
        const { data: f } = await supabase
          .from("follows").select("competition_id").eq("user_id", user.id);
        leagueIds = (f || []).map((r) => r.competition_id).filter(Boolean) as string[];
      } else {
        try {
          const local = JSON.parse(localStorage.getItem("tribuna_follows") || "{}");
          leagueIds = local.leagues || [];
        } catch {}
      }

      // Próximos partidos (de mis campeonatos; si no sigo ninguno, todos)
      const base = supabase
        .from("matches")
        .select("*, home_team:home_team_id(*), away_team:away_team_id(*), competition:competition_id(*)")
        .neq("status", "final")
        .gt("kickoff_at", new Date().toISOString())
        .order("kickoff_at", { ascending: true })
        .limit(LIMIT);
      let list: Match[] = [];
      if (leagueIds.length > 0) {
        const { data } = await base.in("competition_id", leagueIds);
        list = (data as Match[]) || [];
      }
      if (list.length === 0) {
        const { data } = await supabase
          .from("matches")
          .select("*, home_team:home_team_id(*), away_team:away_team_id(*), competition:competition_id(*)")
          .neq("status", "final")
          .gt("kickoff_at", new Date().toISOString())
          .order("kickoff_at", { ascending: true })
          .limit(LIMIT);
        list = (data as Match[]) || [];
        setUsedFallback(leagueIds.length > 0);
      }
      setMatches(list);

      const ids = list.map((m) => m.id);
      if (ids.length > 0) {
        // Votos de la comunidad
        const { data: all } = await supabase
          .from("winner_predictions")
          .select("match_id, predicted_team_id")
          .in("match_id", ids);
        const c: Counts = {};
        for (const r of all || []) {
          c[r.match_id] = c[r.match_id] || {};
          c[r.match_id][r.predicted_team_id] = (c[r.match_id][r.predicted_team_id] || 0) + 1;
        }
        setCounts(c);

        // Mis pronósticos
        if (user) {
          const { data: mine } = await supabase
            .from("winner_predictions")
            .select("match_id, predicted_team_id")
            .eq("user_id", user.id)
            .in("match_id", ids);
          const p: Record<string, string> = {};
          for (const r of mine || []) p[r.match_id] = r.predicted_team_id;
          setPicks(p);
        } else {
          try {
            setPicks(JSON.parse(localStorage.getItem(LOCAL_KEY) || "{}"));
          } catch {}
        }
      }
      setLoading(false);
    })();
  }, [supabase]);

  const pick = async (matchId: string, teamId: string) => {
    const prev = picks[matchId];
    if (prev === teamId) return;
    setPicks((p) => ({ ...p, [matchId]: teamId }));
    setCounts((c) => {
      const mc = { ...(c[matchId] || {}) };
      if (prev) mc[prev] = Math.max(0, (mc[prev] || 1) - 1);
      mc[teamId] = (mc[teamId] || 0) + 1;
      return { ...c, [matchId]: mc };
    });
    if (userId) {
      await supabase.from("winner_predictions").upsert(
        { user_id: userId, match_id: matchId, predicted_team_id: teamId, updated_at: new Date().toISOString() },
        { onConflict: "user_id,match_id" }
      );
    } else {
      try {
        const local = JSON.parse(localStorage.getItem(LOCAL_KEY) || "{}");
        local[matchId] = teamId;
        localStorage.setItem(LOCAL_KEY, JSON.stringify(local));
      } catch {}
    }
  };

  const answered = Object.keys(picks).filter((id) => matches.some((m) => m.id === id)).length;

  return (
    <main className="app-shell bg-ink text-white min-h-screen">
      <div className="px-5 pt-12 pb-28">
        <h1 className="display text-4xl mb-1">Predicción</h1>
        <p className="text-sm text-muted mb-1">¿Quién gana? Tus próximos {matches.length || LIMIT} partidos.</p>
        {matches.length > 0 && (
          <p className="text-xs text-brand font-semibold mb-4">{answered}/{matches.length} pronosticados</p>
        )}

        {usedFallback && (
          <div className="bg-card border border-white/5 rounded-2xl p-4 text-sm text-white/65 mb-4">
            No hay partidos próximos de tus campeonatos. Te mostramos toda la agenda.
          </div>
        )}

        {!userId && !loading && (
          <div className="bg-card border border-brand/30 rounded-2xl p-4 text-sm text-white/65 mb-4">
            <Link href="/login" className="text-brand font-semibold">Iniciá sesión</Link> para que tus pronósticos cuenten en el ranking de la comunidad.
          </div>
        )}

        <div className="space-y-3">
          {matches.map((m) => (
            <PredictionCard key={m.id} m={m} pick={picks[m.id]} counts={counts[m.id] || {}} onPick={pick} />
          ))}
          {matches.length === 0 && !loading && (
            <div className="bg-card border border-white/5 rounded-2xl p-5 text-center text-white/65">
              No hay partidos próximos para pronosticar.
            </div>
          )}
        </div>

        {loading && <p className="text-center text-white/50 mt-8">Cargando…</p>}
      </div>
      <BottomNav />
    </main>
  );
}

function PredictionCard({
  m, pick, counts, onPick,
}: {
  m: Match;
  pick?: string;
  counts: Record<string, number>;
  onPick: (matchId: string, teamId: string) => void;
}) {
  const d = m.kickoff_at ? new Date(m.kickoff_at) : null;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const pct = (teamId?: string | null) =>
    total > 0 && teamId ? Math.round(((counts[teamId] || 0) / total) * 100) : null;

  return (
    <div className="bg-card border border-white/5 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] text-muted font-semibold tracking-wide uppercase">
          {withRound(m.competition?.short_name, m.round)}
        </span>
        <span className="text-[11px] text-muted">
          {d ? `${d.toLocaleDateString("es-CL", { day: "numeric", month: "short" })} · ${d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}` : "Por confirmar"}
        </span>
      </div>
      <div className="space-y-2">
        <TeamOption m={m} side="home" pick={pick} pct={pick ? pct(m.home_team_id) : null} onPick={onPick} />
        <TeamOption m={m} side="away" pick={pick} pct={pick ? pct(m.away_team_id) : null} onPick={onPick} />
      </div>
      {pick && total > 0 && (
        <p className="text-[11px] text-muted mt-2 text-right">{total} pronóstico{total === 1 ? "" : "s"} de la comunidad</p>
      )}
    </div>
  );
}

function TeamOption({
  m, side, pick, pct, onPick,
}: {
  m: Match;
  side: "home" | "away";
  pick?: string;
  pct: number | null;
  onPick: (matchId: string, teamId: string) => void;
}) {
  const team = side === "home" ? m.home_team : m.away_team;
  const teamId = side === "home" ? m.home_team_id : m.away_team_id;
  if (!team || !teamId) return null;
  const selected = pick === teamId;
  return (
    <button
      onClick={() => onPick(m.id, teamId)}
      className={`relative w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left overflow-hidden transition active:scale-[0.99] ${
        selected ? "border-brand bg-brand/10" : "border-white/10 bg-white/[0.03]"
      }`}
    >
      {pct !== null && (
        <span
          className={`absolute inset-y-0 left-0 ${selected ? "bg-brand/15" : "bg-white/[0.05]"}`}
          style={{ width: `${pct}%` }}
        />
      )}
      <Badge label={team.short_name || "?"} color={team.color} size={28} />
      <span className={`relative flex-1 font-semibold text-sm ${selected ? "text-white" : "text-white/85"}`}>
        {team.name}
      </span>
      {pct !== null ? (
        <span className={`relative text-sm font-bold ${selected ? "text-brand" : "text-muted"}`}>{pct}%</span>
      ) : (
        <span className={`relative w-5 h-5 rounded-full border grid place-items-center ${selected ? "border-brand" : "border-white/25"}`}>
          {selected && <span className="w-2.5 h-2.5 rounded-full bg-brand" />}
        </span>
      )}
    </button>
  );
}
