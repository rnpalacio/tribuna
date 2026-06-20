import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/components/BottomNav";
import { PollCard } from "@/components/PollCard";
import type { Poll } from "@/lib/types";

export const dynamic = "force-dynamic";

type XVRow = { user_id: string; display_name: string | null; xv_points: number; picks: number };
type PredRow = { display_name: string | null; predictor_points: number };

export default async function Comunidad() {
  const supabase = await createClient();

  const { data: polls } = await supabase
    .from("polls")
    .select("*, poll_options(*)")
    .eq("active", true)
    .eq("kind", "poll")
    .limit(1);

  const { data: xvAll } = await supabase.rpc("xv_leaderboard");
  const xv = ((xvAll as XVRow[]) || []).filter((r) => r.picks > 0).slice(0, 10);

  const { data: ranking } = await supabase
    .from("public_leaderboard")
    .select("display_name, predictor_points")
    .order("predictor_points", { ascending: false })
    .limit(10);

  const poll = (polls?.[0] as Poll) || null;
  const xvRows = (xv as XVRow[]) || [];

  return (
    <main className="app-shell bg-cream text-ink min-h-screen">
      <div className="px-5 pt-12 pb-28">
        <h1 className="display text-4xl mb-4">Comunidad</h1>

        <div className="bg-ink text-white rounded-2xl p-5 mb-5">
          <p className="text-brand text-xs font-bold tracking-[0.15em]">JUEGO</p>
          <h3 className="display text-2xl mt-1">Armá tu XV ideal</h3>
          <p className="text-white/70 text-sm mt-1 mb-4">
            Elegí 15 jugadores de la plataforma. Cada fecha suman los puntos que
            hace su club y competís con la comunidad.
          </p>
          <Link
            href="/comunidad/xv"
            className="inline-block bg-brand hover:bg-brand-600 transition rounded-xl px-5 py-2.5 font-bold text-sm"
          >
            ARMAR MI XV
          </Link>
        </div>

        {/* Ranking XV — siempre visible */}
        <h2 className="text-xs tracking-[0.15em] text-black/45 font-semibold mb-3">RANKING · ARMÁ TU XV</h2>
        <div className="bg-white rounded-2xl overflow-hidden mb-6">
          {xvRows.length === 0 && (
            <div className="p-5 text-center text-black/55">
              Todavía nadie armó su XV. <Link href="/comunidad/xv" className="text-brand font-semibold">Sé el primero ›</Link>
            </div>
          )}
          {xvRows.map((r, i) => (
            <div key={r.user_id} className={`flex items-center gap-3 px-4 py-3 ${i % 2 ? "bg-black/[0.02]" : ""}`}>
              <span className="font-bold text-brand w-5">{i + 1}</span>
              <span className="flex-1 font-semibold">{r.display_name || "Hincha"}</span>
              <span className="font-bold">{r.xv_points.toLocaleString("es-CL")} pts</span>
            </div>
          ))}
        </div>

        {poll && (
          <>
            <h2 className="text-xs tracking-[0.15em] text-black/45 font-semibold mb-3">ENCUESTA DE LA SEMANA</h2>
            <div className="mb-6"><PollCard poll={poll} dark={false} /></div>
          </>
        )}

        <h2 className="text-xs tracking-[0.15em] text-black/45 font-semibold mb-3">RANKING DE PREDICTORES</h2>
        <div className="bg-white rounded-2xl overflow-hidden">
          {((ranking as PredRow[]) || []).length === 0 && (
            <div className="p-5 text-center text-black/55">
              Todavía no hay predictores. ¡Sé el primero en votar las predicciones!
            </div>
          )}
          {((ranking as PredRow[]) || []).map((r, i) => (
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
