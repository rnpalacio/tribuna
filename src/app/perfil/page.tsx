"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/Badge";
import { BottomNav } from "@/components/BottomNav";
import type { Team, Player, Profile } from "@/lib/types";

type Prefs = { personalize: boolean; analytics: boolean; sponsors: boolean };

export default function Perfil() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [name, setName] = useState("Hincha");
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [prefs, setPrefs] = useState<Prefs>({ personalize: true, analytics: true, sponsors: false });

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      let teamIds: string[] = [], playerIds: string[] = [];

      if (user) {
        setAuthed(true);
        const { data: prof } = await supabase.from("profiles").select("*").eq("id", user.id).single();
        const p = prof as Profile | null;
        if (p) {
          setName(p.display_name || "Hincha");
          setPrefs({ personalize: p.personalize_feed, analytics: p.analytics_opt_in, sponsors: p.sponsors_opt_in });
        }
        const { data: f } = await supabase.from("follows").select("team_id, player_id").eq("user_id", user.id);
        teamIds = (f || []).map((r) => r.team_id).filter(Boolean) as string[];
        playerIds = (f || []).map((r) => r.player_id).filter(Boolean) as string[];
      } else {
        try {
          const local = JSON.parse(localStorage.getItem("tribuna_follows") || "{}");
          teamIds = local.teams || []; playerIds = local.players || [];
          const lp = JSON.parse(localStorage.getItem("tribuna_prefs") || "null");
          if (lp) setPrefs(lp);
        } catch {}
      }

      if (teamIds.length) {
        const { data } = await supabase.from("teams").select("*").in("id", teamIds);
        setTeams((data as Team[]) || []);
      }
      if (playerIds.length) {
        const { data } = await supabase.from("players").select("*").in("id", playerIds);
        setPlayers((data as Player[]) || []);
      }
    })();
  }, [supabase]);

  async function updatePref(key: keyof Prefs, value: boolean) {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    localStorage.setItem("tribuna_prefs", JSON.stringify(next));
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("profiles").update({
        personalize_feed: next.personalize,
        analytics_opt_in: next.analytics,
        sponsors_opt_in: next.sponsors,
      }).eq("id", user.id);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  return (
    <main className="app-shell bg-cream text-ink min-h-screen">
      <div className="px-5 pt-12 pb-28">
        <div className="flex items-center justify-between mb-5">
          <h1 className="display text-4xl">Perfil</h1>
          {!authed && <Link href="/login" className="text-brand font-semibold text-sm">Iniciar sesión</Link>}
        </div>

        <div className="flex items-center gap-3 mb-6">
          <Badge label={name.slice(0, 1).toUpperCase()} size={56} />
          <div>
            <p className="font-bold text-lg">{name}</p>
            <p className="text-sm text-black/45">{authed ? "Cuenta verificada" : "Modo invitado"}</p>
          </div>
        </div>

        <h2 className="text-xs tracking-[0.15em] text-black/45 font-semibold mb-3 flex justify-between">
          TUS INTERESES <Link href="/onboarding" className="text-brand">Editar</Link>
        </h2>
        <div className="flex flex-wrap gap-2 mb-6">
          {teams.map((t) => (
            <span key={t.id} className="bg-white rounded-full pl-1 pr-3 py-1 flex items-center gap-2 text-sm font-semibold">
              <Badge label={t.short_name || "?"} color={t.color} size={26} /> {t.name}
            </span>
          ))}
          {players.map((p) => (
            <span key={p.id} className="bg-white rounded-full pl-1 pr-3 py-1 flex items-center gap-2 text-sm font-semibold">
              <Badge label={p.name.split(" ").map((w) => w[0]).slice(0, 2).join("")} size={26} /> {p.name}
            </span>
          ))}
          {teams.length === 0 && players.length === 0 && (
            <span className="text-black/45 text-sm">Sin intereses aún. <Link href="/onboarding" className="text-brand">Armá tu feed</Link></span>
          )}
        </div>

        <h2 className="text-xs tracking-[0.15em] text-black/45 font-semibold mb-3">TUS DATOS Y PRIVACIDAD</h2>
        <Toggle label="Personalizar mi feed" sub="Usar mis intereses para curar el contenido." value={prefs.personalize} onChange={(v) => updatePref("personalize", v)} />
        <Toggle label="Analítica de uso" sub="Mejorar la app con datos agregados y anónimos." value={prefs.analytics} onChange={(v) => updatePref("analytics", v)} />
        <Toggle label="Sponsors y promociones" sub="Recibir activaciones de marcas del rugby." value={prefs.sponsors} onChange={(v) => updatePref("sponsors", v)} />
        <p className="text-xs text-black/45 mt-3 mb-6">
          Tu data es tuya y se recolecta con consentimiento (Ley 21.719). Podés descargarla o borrarla cuando quieras.
        </p>

        {authed ? (
          <button onClick={logout} className="w-full bg-white rounded-2xl py-4 font-bold text-brand">CERRAR SESIÓN</button>
        ) : (
          <Link href="/" className="block text-center w-full bg-white rounded-2xl py-4 font-bold text-brand">VOLVER AL INICIO</Link>
        )}
      </div>
      <BottomNav />
    </main>
  );
}

function Toggle({ label, sub, value, onChange }: { label: string; sub: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="bg-white rounded-2xl p-4 mb-3 flex items-center justify-between">
      <div className="pr-4">
        <p className="font-bold">{label}</p>
        <p className="text-sm text-black/55">{sub}</p>
      </div>
      <button onClick={() => onChange(!value)} className={`w-12 h-7 rounded-full transition relative shrink-0 ${value ? "bg-green-700" : "bg-black/20"}`} aria-pressed={value}>
        <span className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${value ? "left-6" : "left-1"}`} />
      </button>
    </div>
  );
}
