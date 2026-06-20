"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/Badge";
import type { Team, Player, Competition } from "@/lib/types";

type Prefs = { personalize: boolean; analytics: boolean; sponsors: boolean };

const STEPS = 5;
const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

export default function Onboarding() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [step, setStep] = useState(1);
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [leagues, setLeagues] = useState<Competition[]>([]);
  const [teamSel, setTeamSel] = useState<Set<string>>(new Set());
  const [playerSel, setPlayerSel] = useState<Set<string>>(new Set());
  const [leagueSel, setLeagueSel] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
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
        .order("kind", { ascending: true })
        .order("name", { ascending: true });
      const { data: p } = await supabase
        .from("players")
        .select("*")
        .order("name", { ascending: true });
      const { data: c } = await supabase
        .from("competitions")
        .select("*")
        .eq("followable", true)
        .order("sort", { ascending: true });
      setTeams((t as Team[]) || []);
      setPlayers((p as Player[]) || []);
      setLeagues((c as Competition[]) || []);
    })();
  }, [supabase]);

  // Reset el buscador al cambiar de paso
  useEffect(() => setQuery(""), [step]);

  const selecciones = teams.filter((t) => t.kind === "seleccion");
  const clubes = teams.filter((t) => t.kind === "club");
  const leagueName = useMemo(() => {
    const m = new Map<string, string>();
    leagues.forEach((l) => m.set(l.id, l.short_name || l.name));
    return m;
  }, [leagues]);

  const q = norm(query.trim());
  const fLeagues = q
    ? leagues.filter((l) => norm(`${l.name} ${l.short_name} ${l.country}`).includes(q))
    : leagues;
  const fClubes = q
    ? clubes.filter((t) =>
        norm(`${t.name} ${t.short_name} ${t.country} ${leagueName.get(t.competition_id || "") || ""}`).includes(q)
      )
    : clubes;
  const fPlayers = q
    ? players.filter((p) => norm(`${p.name} ${p.position} ${p.country}`).includes(q))
    : players;

  function toggle(set: Set<string>, id: string, setter: (s: Set<string>) => void) {
    const next = new Set(set);
    next.has(id) ? next.delete(id) : next.add(id);
    setter(next);
  }

  async function finish() {
    setSaving(true);
    const teamIds = [...teamSel];
    const playerIds = [...playerSel];
    const leagueIds = [...leagueSel];

    localStorage.setItem(
      "tribuna_follows",
      JSON.stringify({ teams: teamIds, players: playerIds, leagues: leagueIds })
    );
    localStorage.setItem("tribuna_prefs", JSON.stringify(prefs));

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("follows").delete().eq("user_id", user.id);
      const rows = [
        ...teamIds.map((id) => ({ user_id: user.id, kind: "team", team_id: id })),
        ...playerIds.map((id) => ({ user_id: user.id, kind: "player", player_id: id })),
        ...leagueIds.map((id) => ({ user_id: user.id, kind: "league", competition_id: id })),
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
            PASO {step} DE {STEPS}
          </span>
          <button onClick={finish} className="text-black/45">
            Saltar
          </button>
        </div>
        <div className="mt-4 h-1.5 rounded-full bg-black/10 overflow-hidden">
          <div
            className="h-full bg-brand transition-all"
            style={{ width: `${(step / STEPS) * 100}%` }}
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
          <Step title="Elegí tus ligas" sub="Seguí torneos completos: te llega su contenido al feed.">
            <SearchBar value={query} onChange={setQuery} placeholder="Buscar liga…" />
            <div className="space-y-3">
              {fLeagues.map((l) => (
                <RowCard
                  key={l.id}
                  label={l.name}
                  sub={l.country || ""}
                  initials={l.short_name || l.name.slice(0, 3)}
                  color={l.color}
                  selected={leagueSel.has(l.id)}
                  onClick={() => toggle(leagueSel, l.id, setLeagueSel)}
                />
              ))}
              {fLeagues.length === 0 && <Empty />}
            </div>
            <SuggestBox kind="league" supabase={supabase} />
          </Step>
        )}

        {step === 3 && (
          <Step title="Elegí tus clubes" sub="Clubes de Chile, Argentina y el Súper Rugby Américas.">
            <SearchBar value={query} onChange={setQuery} placeholder="Buscar club…" />
            <div className="space-y-3">
              {fClubes.map((t) => (
                <RowCard
                  key={t.id}
                  label={t.name}
                  sub={[t.country, leagueName.get(t.competition_id || "")].filter(Boolean).join(" · ")}
                  initials={t.short_name || t.name.slice(0, 3)}
                  color={t.color}
                  selected={teamSel.has(t.id)}
                  onClick={() => toggle(teamSel, t.id, setTeamSel)}
                />
              ))}
              {fClubes.length === 0 && <Empty />}
            </div>
            <SuggestBox kind="club" supabase={supabase} />
          </Step>
        )}

        {step === 4 && (
          <Step title="Tus jugadores favoritos" sub="Te avisamos cuando sean noticia o jueguen.">
            <SearchBar value={query} onChange={setQuery} placeholder="Buscar jugador…" />
            <div className="space-y-3">
              {fPlayers.map((p) => (
                <RowCard
                  key={p.id}
                  label={p.name}
                  sub={[p.position, p.country].filter(Boolean).join(" · ")}
                  initials={p.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                  selected={playerSel.has(p.id)}
                  onClick={() => toggle(playerSel, p.id, setPlayerSel)}
                />
              ))}
              {fPlayers.length === 0 && <Empty />}
            </div>
            <SuggestBox kind="player" supabase={supabase} />
          </Step>
        )}

        {step === 5 && (
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
          onClick={() => (step < STEPS ? setStep(step + 1) : finish())}
          className="w-full bg-brand hover:bg-brand-600 transition text-white rounded-2xl py-4 font-bold tracking-wide disabled:opacity-60"
        >
          {step < STEPS ? "CONTINUAR" : saving ? "ENTRANDO…" : "ENTRAR A TRIBUNA"}
        </button>
      </div>
    </main>
  );
}

function Step({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="display text-3xl">{title}</h2>
      <p className="text-black/55 mt-1 mb-4">{sub}</p>
      {children}
    </div>
  );
}

function SearchBar({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative mb-4">
      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-black/35">🔍</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-white rounded-2xl pl-11 pr-10 py-3 outline-none border-2 border-transparent focus:border-brand/40 transition"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-black/5 grid place-items-center text-black/45"
          aria-label="Limpiar"
        >
          ×
        </button>
      )}
    </div>
  );
}

function Empty() {
  return (
    <p className="text-center text-sm text-black/40 py-6">
      Sin resultados. ¿Falta algo? Sugerilo abajo 👇
    </p>
  );
}

const SUGGEST_LABEL: Record<string, { cta: string; ph: string }> = {
  league: { cta: "Sugerir una liga que falte", ph: "Nombre de la liga" },
  club: { cta: "Sugerir un club que falte", ph: "Nombre del club" },
  player: { cta: "Sugerir un jugador que falte", ph: "Nombre del jugador" },
};

function SuggestBox({ kind, supabase }: { kind: "league" | "club" | "player"; supabase: ReturnType<typeof createClient> }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [context, setContext] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const cfg = SUGGEST_LABEL[kind];

  async function send() {
    if (!name.trim()) return;
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("suggestions").insert({
      kind,
      name: name.trim(),
      context: context.trim() || null,
      user_id: user?.id ?? null,
    });
    setBusy(false);
    setSent(true);
    setName("");
    setContext("");
  }

  if (sent) {
    return (
      <div className="mt-5 bg-green-700/10 text-green-800 rounded-2xl p-4 text-sm text-center">
        ¡Gracias! Anotamos tu sugerencia. Cuanto más se pida, antes lo sumamos.
      </div>
    );
  }

  return (
    <div className="mt-5">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="w-full border-2 border-dashed border-black/15 rounded-2xl py-3 text-sm font-semibold text-black/55 hover:border-brand/40 transition"
        >
          + {cfg.cta}
        </button>
      ) : (
        <div className="bg-white rounded-2xl p-4 space-y-3">
          <p className="font-bold text-sm">{cfg.cta}</p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={cfg.ph}
            className="w-full bg-cream rounded-xl px-3 py-2.5 outline-none border-2 border-transparent focus:border-brand/40"
          />
          {kind === "player" && (
            <input
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Club (opcional)"
              className="w-full bg-cream rounded-xl px-3 py-2.5 outline-none border-2 border-transparent focus:border-brand/40"
            />
          )}
          <div className="flex gap-2">
            <button
              onClick={() => setOpen(false)}
              className="flex-1 rounded-xl py-2.5 text-sm font-semibold bg-black/5 text-black/55"
            >
              Cancelar
            </button>
            <button
              disabled={busy || !name.trim()}
              onClick={send}
              className="flex-1 rounded-xl py-2.5 text-sm font-bold bg-brand text-white disabled:opacity-50"
            >
              {busy ? "Enviando…" : "Enviar"}
            </button>
          </div>
        </div>
      )}
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
