"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/Badge";
import type { Team, Player } from "@/lib/types";

type Prefs = { personalize: boolean; analytics: boolean; sponsors: boolean };

export default function Onboarding() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [step, setStep] = useState(1);
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [teamSel, setTeamSel] = useState<Set<string>>(new Set());
  const [playerSel, setPlayerSel] = useState<Set<string>>(new Set());
  const [prefs, setPrefs] = useState<Prefs>({
    personalize: true,
    analytics: true,
    sponsors: false,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: t } = await supabase
        .from("teams")
        .select("*")
        .order("kind", { ascending: true });
      const { data: p } = await supabase.from("players").select("*");
      setTeams((t as Team[]) || []);
      setPlayers((p as Player[]) || []);
    })();
  }, [supabase]);

  const selecciones = teams.filter((t) => t.kind === "seleccion");
  const clubes = teams.filter((t) => t.kind === "club");

  function toggle(set: Set<string>, id: string, setter: (s: Set<string>) => void) {
    const next = new Set(set);
    next.has(id) ? next.delete(id) : next.add(id);
    setter(next);
  }

  async function finish() {
    setSaving(true);
    const teamIds = [...teamSel];
    const playerIds = [...playerSel];

    // Always store locally so the feed works immediately.
    localStorage.setItem(
      "tribuna_follows",
      JSON.stringify({ teams: teamIds, players: playerIds })
    );
    localStorage.setItem("tribuna_prefs", JSON.stringify(prefs));

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("follows").delete().eq("user_id", user.id);
      const rows = [
        ...teamIds.map((id) => ({ user_id: user.id, kind: "team", team_id: id })),
        ...playerIds.map((id) => ({ user_id: user.id, kind: "player", player_id: id })),
      ];
      if (rows.length) await supabase.from("follows").insert(rows);
      await supabase
        .from("profiles")
        .update({
          onboarded: true,
          personalize_feed: prefs.personalize,
          analytics_opt_in: prefs.analytics,
          sponsors_opt_in: prefs.sponsors,
        })
        .eq("id", user.id);
    }
    router.push("/feed");
  }

  return (
    <main className="app-shell bg-cream text-ink flex flex-col">
      <header className="px-5 pt-12 pb-2">
        <div className="flex items-center justify-between text-sm">
          <button
            onClick={() => (step > 1 ? setStep(step - 1) : router.push("/"))}
            className="w-9 h-9 rounded-full bg-white grid place-items-center shadow"
            aria-label="Atrás"
          >
            ‹
          </button>
          <span className="tracking-[0.2em] text-black/45 text-xs font-semibold">
            PASO {step} DE 4
          </span>
          <button onClick={finish} className="text-black/45">
            Saltar
          </button>
        </div>
        <div className="mt-4 h-1.5 rounded-full bg-black/10 overflow-hidden">
          <div
            className="h-full bg-brand transition-all"
            style={{ width: `${(step / 4) * 100}%` }}
          />
        </div>
      </header>

      <div className="flex-1 px-5 pt-4 pb-28 overflow-y-auto">
        {step === 1 && (
          <Step title="¿A qué selecciones seguís?" sub="Empezá por tus equipos nacionales. Podés elegir varios.">
            <div className="grid grid-cols-2 gap-3">
              {selecciones.map((t) => (
                <TeamCard
                  key={t.id}
                  team={t}
                  selected={teamSel.has(t.id)}
                  onClick={() => toggle(teamSel, t.id, setTeamSel)}
                />
              ))}
            </div>
          </Step>
        )}

        {step === 2 && (
          <Step title="Elegí tus clubes" sub="Súper Rugby Américas y clubes locales de Chile.">
            <div className="space-y-3">
              {clubes.map((t) => (
                <RowCard
                  key={t.id}
                  label={t.name}
                  sub={t.country || ""}
                  initials={t.short_name || t.name.slice(0, 3)}
                  color={t.color}
                  selected={teamSel.has(t.id)}
                  onClick={() => toggle(teamSel, t.id, setTeamSel)}
                />
              ))}
            </div>
          </Step>
        )}

        {step === 3 && (
          <Step title="Tus jugadores favoritos" sub="Te avisamos cuando sean noticia o jueguen.">
            <div className="space-y-3">
              {players.map((p) => (
                <RowCard
                  key={p.id}
                  label={p.name}
                  sub={`${p.position || ""}${p.country ? " · " + p.country : ""}`}
                  initials={p.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                  selected={playerSel.has(p.id)}
                  onClick={() => toggle(playerSel, p.id, setPlayerSel)}
                />
              ))}
            </div>
          </Step>
        )}

        {step === 4 && (
          <Step title="Tu privacidad" sub="Vos decidís qué compartís. Transparente desde el día uno.">
            <div className="bg-white rounded-2xl p-4 mb-3">
              <p className="font-bold">Vos controlás tus datos</p>
              <p className="text-sm text-black/55 mt-1">
                Usamos tus intereses para curar tu feed. Elegí qué compartís —
                podés cambiarlo cuando quieras.
              </p>
            </div>
            <Toggle label="Personalizar mi feed" sub="Usar mis intereses para curar el contenido." value={prefs.personalize} onChange={(v) => setPrefs({ ...prefs, personalize: v })} />
            <Toggle label="Analítica de uso" sub="Mejorar la app con datos agregados y anónimos." value={prefs.analytics} onChange={(v) => setPrefs({ ...prefs, analytics: v })} />
            <Toggle label="Sponsors y promociones" sub="Recibir activaciones de marcas del rugby." value={prefs.sponsors} onChange={(v) => setPrefs({ ...prefs, sponsors: v })} />
            <p className="text-xs text-black/45 mt-4">
              Tu data es tuya y se recolecta con consentimiento (Ley 21.719).
            </p>
          </Step>
        )}
      </div>

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] p-4 bg-gradient-to-t from-cream via-cream to-transparent">
        <button
          disabled={saving}
          onClick={() => (step < 4 ? setStep(step + 1) : finish())}
          className="w-full bg-brand hover:bg-brand-600 transition text-white rounded-2xl py-4 font-bold tracking-wide disabled:opacity-60"
        >
          {step < 4 ? "CONTINUAR" : saving ? "ENTRANDO…" : "ENTRAR A TRIBUNA"}
        </button>
      </div>
    </main>
  );
}

function Step({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="display text-3xl">{title}</h2>
      <p className="text-black/55 mt-1 mb-5">{sub}</p>
      {children}
    </div>
  );
}

function TeamCard({ team, selected, onClick }: { team: Team; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`bg-white rounded-2xl p-5 flex flex-col items-center gap-2 border-2 transition ${selected ? "border-brand" : "border-transparent"}`}
    >
      <Badge label={team.short_name || team.name.slice(0, 3)} color={team.color} size={48} />
      <span className="font-bold">{team.name}</span>
      <span className="text-xs text-black/45">{team.country}</span>
    </button>
  );
}

function RowCard({ label, sub, initials, color, selected, onClick }: { label: string; sub: string; initials: string; color?: string | null; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full bg-white rounded-2xl p-3 flex items-center gap-3 border-2 transition ${selected ? "border-brand" : "border-transparent"}`}
    >
      <Badge label={initials.toUpperCase()} color={color} size={44} />
      <div className="text-left flex-1">
        <p className="font-bold leading-tight">{label}</p>
        <p className="text-xs text-black/45">{sub}</p>
      </div>
      <span className={`w-7 h-7 rounded-full grid place-items-center text-sm ${selected ? "bg-brand text-white" : "bg-black/5 text-black/40"}`}>
        {selected ? "✓" : "+"}
      </span>
    </button>
  );
}

function Toggle({ label, sub, value, onChange }: { label: string; sub: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="bg-white rounded-2xl p-4 mb-3 flex items-center justify-between">
      <div className="pr-4">
        <p className="font-bold">{label}</p>
        <p className="text-sm text-black/55">{sub}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`w-12 h-7 rounded-full transition relative shrink-0 ${value ? "bg-green-700" : "bg-black/20"}`}
        aria-pressed={value}
      >
        <span className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${value ? "left-6" : "left-1"}`} />
      </button>
    </div>
  );
}
