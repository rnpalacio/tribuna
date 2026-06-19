import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/Badge";
import { BottomNav } from "@/components/BottomNav";
import type { Match, Standing } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Partidos() {
  const supabase = await createClient();

  const { data: matches } = await supabase
    .from("matches")
    .select("*, home_team:home_team_id(*), away_team:away_team_id(*), competition:competition_id(*)")
    .order("kickoff_at", { ascending: true });

  const { data: standings } = await supabase
    .from("standings")
    .select("*, team:team_id(*)")
    .order("position", { ascending: true });

  const upcoming = ((matches as Match[]) || []).filter((m) => m.status !== "final");
  const recent = ((matches as Match[]) || []).filter((m) => m.status === "final");

  return (
    <main className="app-shell bg-cream text-ink min-h-screen">
      <div className="px-5 pt-12 pb-28">
        <h1 className="display text-4xl mb-4">Partidos</h1>

        <SectionTitle>PRÓXIMOS</SectionTitle>
        <div className="space-y-3">
          {upcoming.map((m) => <FixtureRow key={m.id} m={m} />)}
          {upcoming.length === 0 && <Empty>No hay próximos partidos cargados.</Empty>}
        </div>

        {recent.length > 0 && (
          <>
            <SectionTitle className="mt-6">RESULTADOS</SectionTitle>
            <div className="space-y-3">
              {recent.map((m) => <FixtureRow key={m.id} m={m} />)}
            </div>
          </>
        )}

        {standings && standings.length > 0 && (
          <>
            <SectionTitle className="mt-6">TABLA DE POSICIONES</SectionTitle>
            <div className="bg-white rounded-2xl overflow-hidden">
              <div className="grid grid-cols-[24px_1fr_40px_48px_48px] gap-2 px-4 py-3 text-xs text-black/45 font-semibold border-b border-black/5">
                <span>#</span><span>EQUIPO</span><span className="text-right">PJ</span><span className="text-right">DIF</span><span className="text-right">PTS</span>
              </div>
              {(standings as Standing[]).map((s, i) => (
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
          </>
        )}
      </div>
      <BottomNav />
    </main>
  );
}

function FixtureRow({ m }: { m: Match }) {
  const d = m.kickoff_at ? new Date(m.kickoff_at) : null;
  return (
    <div className="bg-white rounded-2xl p-4 flex items-center gap-3">
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
