import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/Badge";
import { BottomNav } from "@/components/BottomNav";
import type { Team } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EquiposIndex() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("teams")
    .select("*")
    .order("kind", { ascending: true })
    .order("name", { ascending: true });

  const teams = (data as Team[]) || [];
  const selecciones = teams.filter((t) => t.kind === "seleccion");
  const clubes = teams.filter((t) => t.kind === "club");

  return (
    <main className="app-shell bg-cream text-white min-h-screen">
      <div className="px-5 pt-12 pb-28">
        <h1 className="display text-4xl mb-1">Equipos</h1>
        <p className="text-sm text-white/55 mb-5">Tocá un equipo para ver su info, partidos y jugadores.</p>

        {selecciones.length > 0 && (
          <>
            <h2 className="text-xs tracking-[0.15em] text-white/55 font-semibold mb-3">SELECCIONES</h2>
            <div className="grid grid-cols-2 gap-2 mb-6">
              {selecciones.map((t) => <TeamCard key={t.id} t={t} />)}
            </div>
          </>
        )}

        {clubes.length > 0 && (
          <>
            <h2 className="text-xs tracking-[0.15em] text-white/55 font-semibold mb-3">CLUBES</h2>
            <div className="grid grid-cols-2 gap-2">
              {clubes.map((t) => <TeamCard key={t.id} t={t} />)}
            </div>
          </>
        )}
      </div>
      <BottomNav />
    </main>
  );
}

function TeamCard({ t }: { t: Team }) {
  return (
    <Link href={`/equipos/${t.slug}`} className="bg-card border border-white/5 rounded-2xl p-3 flex items-center gap-3 active:scale-[0.98] transition">
      <Badge label={t.short_name || t.name.slice(0, 3)} color={t.color} size={40} />
      <div className="min-w-0">
        <p className="font-semibold text-sm leading-tight truncate">{t.name}</p>
        {(t.nickname || t.country) && <p className="text-[11px] text-white/50 truncate">{[t.nickname, t.country].filter(Boolean).join(" · ")}</p>}
      </div>
    </Link>
  );
}
