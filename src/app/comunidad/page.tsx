import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/components/BottomNav";
import { PollCard } from "@/components/PollCard";
import type { Poll } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Comunidad() {
  const supabase = await createClient();

  const { data: polls } = await supabase
    .from("polls")
    .select("*, poll_options(*)")
    .eq("active", true)
    .eq("kind", "poll")
    .limit(1);

  const { data: ranking } = await supabase
    .from("public_leaderboard")
    .select("display_name, predictor_points")
    .order("predictor_points", { ascending: false })
    .limit(10);

  const poll = (polls?.[0] as Poll) || null;

  return (
    <main className="app-shell bg-cream text-ink min-h-screen">
      <div className="px-5 pt-12 pb-28">
        <h1 className="display text-4xl mb-4">Comunidad</h1>

        <div className="bg-ink text-white rounded-2xl p-5 mb-5">
          <p className="text-brand text-xs font-bold tracking-[0.15em]">JUEGO</p>
          <h3 className="display text-2xl mt-1">Armá tu XV ideal</h3>
          <p className="text-white/70 text-sm mt-1 mb-4">
            Elegí tu equipo de la fecha y competí con la comunidad.
          </p>
          <button className="bg-brand hover:bg-brand-600 transition rounded-xl px-5 py-2.5 font-bold text-sm">
            CREAR MI XV
          </button>
        </div>

        {poll && (
          <>
            <h2 className="text-xs tracking-[0.15em] text-black/45 font-semibold mb-3">ENCUESTA DE LA SEMANA</h2>
            <div className="mb-6"><PollCard poll={poll} dark={false} /></div>
          </>
        )}

        <h2 className="text-xs tracking-[0.15em] text-black/45 font-semibold mb-3">RANKING DE PREDICTORES</h2>
        <div className="bg-white rounded-2xl overflow-hidden">
          {(ranking || []).length === 0 && (
            <div className="p-5 text-center text-black/55">
              Todavía no hay predictores. ¡Sé el primero en votar las predicciones!
            </div>
          )}
          {(ranking || []).map((r: { display_name: string | null; predictor_points: number }, i: number) => (
            <div key={i} className={`flex items-center gap-3 px-4 py-3 ${i % 2 ? "bg-black/[0.02]" : ""}`}>
              <span className="font-bold text-brand w-5">{i + 1}</span>
              <span className="flex-1 font-semibold">{r.display_name || "Hincha"}</span>
              <span className="font-bold">{r.predictor_points.toLocaleString("es-CL")} pts</span>
            </div>
          ))}
        </div>
      </div>
      <BottomNav />
    </main>
  );
}
