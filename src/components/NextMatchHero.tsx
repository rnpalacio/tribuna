"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Match } from "@/lib/types";
import { withRound } from "@/lib/format";

const BG = "/bg-estadio.jpg";

export function NextMatchHero() {
  const supabase = useMemo(() => createClient(), []);
  const [match, setMatch] = useState<Match | null>(null);
  const [now, setNow] = useState<number>(Date.now());

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

      const { data } = await supabase
        .from("matches")
        .select("*, home_team:home_team_id(*), away_team:away_team_id(*), competition:competition_id(*)")
        .neq("status", "final")
        .gt("kickoff_at", new Date().toISOString())
        .order("kickoff_at", { ascending: true })
        .limit(30);
      const list = (data as Match[]) || [];
      const mine = list.filter((m) =>
        teamIds.includes(m.home_team_id || "") ||
        teamIds.includes(m.away_team_id || "") ||
        leagueIds.includes(m.competition_id || "")
      );
      setMatch(mine[0] || list[0] || null);
    })();
  }, [supabase]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!match || !match.kickoff_at) return null;

  const kick = new Date(match.kickoff_at);
  const diff = Math.max(0, kick.getTime() - now);
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  const secs = Math.floor((diff % 60_000) / 1000);

  const meta = [
    kick.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }) + " HS",
    kick.toLocaleDateString("es-CL", { day: "numeric", month: "short" }).toUpperCase(),
    match.venue?.toUpperCase(),
  ].filter(Boolean).join("  ·  ");

  return (
    <div className="relative rounded-3xl overflow-hidden mt-5 border border-white/10">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${BG})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-ink/60 via-ink/40 to-ink/90" />

      <div className="relative p-5 pt-6">
        <p className="text-brand text-[11px] font-bold tracking-[0.2em]">PRÓXIMO PARTIDO</p>
        <h2 className="display text-3xl leading-[1.1] mt-2 uppercase">
          {match.home_team?.name}
          <br />
          <span className="text-white/60 text-xl align-middle">vs</span> {match.away_team?.name}
        </h2>
        <p className="text-[11px] text-white/70 tracking-wide mt-2">
          {meta} · {withRound(match.competition?.short_name, match.round)}
        </p>

        <div className="grid grid-cols-4 gap-2 mt-4 bg-black/40 backdrop-blur rounded-2xl p-3 text-center">
          <CountBox v={days} label="DÍAS" />
          <CountBox v={hours} label="HS" />
          <CountBox v={mins} label="MIN" />
          <CountBox v={secs} label="SEG" />
        </div>

        <Link
          href={`/partidos/${match.id}`}
          className="block w-full text-center bg-brand hover:bg-brand-600 transition text-white rounded-xl py-3.5 font-bold tracking-[0.06em] mt-4"
        >
          {match.tickets_url ? "CONSEGUIR MI LUGAR" : "VER PARTIDO"}
        </Link>
      </div>
    </div>
  );
}

function CountBox({ v, label }: { v: number; label: string }) {
  return (
    <div>
      <p className="display text-2xl">{v.toString().padStart(2, "0")}</p>
      <p className="text-[10px] text-white/55 tracking-wide">{label}</p>
    </div>
  );
}
