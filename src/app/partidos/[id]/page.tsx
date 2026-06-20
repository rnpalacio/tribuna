import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/Badge";
import { BottomNav } from "@/components/BottomNav";
import { affiliateUrl } from "@/lib/affiliate";
import type { Match } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function MatchDetail({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("matches")
    .select("*, home_team:home_team_id(*), away_team:away_team_id(*), competition:competition_id(*)")
    .eq("id", params.id)
    .maybeSingle();

  const m = data as Match | null;

  if (!m) {
    return (
      <main className="app-shell bg-cream text-ink min-h-screen">
        <div className="px-5 pt-12 pb-28">
          <Link href="/partidos" className="text-brand font-semibold text-sm">‹ Partidos</Link>
          <div className="bg-white rounded-2xl p-6 mt-6 text-center text-black/55">
            No encontramos este partido.
          </div>
        </div>
        <BottomNav />
      </main>
    );
  }

  const d = m.kickoff_at ? new Date(m.kickoff_at) : null;
  const isFinal = m.status === "final";
  const fecha = d
    ? d.toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" })
    : "Fecha por confirmar";
  const hora = d ? d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }) : null;

  return (
    <main className="app-shell bg-cream text-ink min-h-screen">
      <div className="px-5 pt-12 pb-28">
        <Link href="/partidos" className="text-brand font-semibold text-sm">‹ Partidos</Link>

        <p className="text-xs tracking-[0.15em] text-black/45 font-semibold mt-5">
          {m.competition?.name || "Partido"}{m.round ? " · " + m.round : ""}
        </p>

        {/* Marcador / enfrentamiento */}
        <div className="bg-white rounded-2xl p-6 mt-3">
          <div className="flex items-center justify-between">
            <TeamCol name={m.home_team?.name} short={m.home_team?.short_name} color={m.home_team?.color} />
            <div className="text-center px-3">
              {isFinal ? (
                <div className="display text-4xl">{m.home_score} – {m.away_score}</div>
              ) : (
                <div className="display text-2xl text-brand">{hora || "VS"}</div>
              )}
              <div className="text-[11px] text-black/40 mt-1 font-semibold">
                {isFinal ? "FINAL" : "POR JUGARSE"}
              </div>
            </div>
            <TeamCol name={m.away_team?.name} short={m.away_team?.short_name} color={m.away_team?.color} />
          </div>
        </div>

        {/* Datos */}
        <div className="bg-white rounded-2xl p-4 mt-4 space-y-2 text-sm">
          <Row label="Fecha" value={fecha[0].toUpperCase() + fecha.slice(1)} />
          {hora && <Row label="Hora" value={hora} />}
          {m.venue && <Row label="Estadio" value={m.venue} />}
          {m.city && <Row label="Ciudad" value={m.city} />}
          {m.competition?.name && <Row label="Competición" value={m.competition.name} />}
        </div>

        {/* Entradas */}
        {!isFinal && (
          <div className="mt-4">
            {m.tickets_url ? (
              <a
                href={affiliateUrl(m.tickets_url, m.ticket_vendor)}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center bg-brand hover:bg-brand-600 transition text-white rounded-2xl py-4 font-bold tracking-wide"
              >
                COMPRAR ENTRADAS{m.ticket_vendor ? ` · ${m.ticket_vendor}` : ""} ↗
              </a>
            ) : (
              <div className="bg-white rounded-2xl py-4 text-center text-black/55 text-sm">
                {m.ticket_vendor ? m.ticket_vendor : "Entradas a confirmar"}
                {m.ticket_vendor === "Entrada liberada" && (
                  <span className="block text-xs text-black/40 mt-1">Mecanismo de entrega a confirmar por la organización.</span>
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
            className="block w-full text-center bg-white rounded-2xl py-4 font-bold text-brand mt-4"
          >
            VER RESUMEN ↗
          </a>
        )}
      </div>
      <BottomNav />
    </main>
  );
}

function TeamCol({ name, short, color }: { name?: string | null; short?: string | null; color?: string | null }) {
  return (
    <div className="flex flex-col items-center gap-2 flex-1">
      <Badge label={short || "?"} color={color} size={56} />
      <span className="font-bold text-center leading-tight">{name}</span>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-black/45">{label}</span>
      <span className="font-semibold text-right">{value}</span>
    </div>
  );
}
