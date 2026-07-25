"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  const [points, setPoints] = useState<{ predictor: number; xv: number }>({ predictor: 0, xv: 0 });
  const [prefs, setPrefs] = useState<Prefs>({ personalize: true, analytics: true, sponsors: false });
  const [refCode, setRefCode] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [refCount, setRefCount] = useState(0);
  const [copied, setCopied] = useState(false);

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
          setPhone(p.phone || "");
          setAvatarUrl(p.avatar_url || null);
          setPrefs({ personalize: p.personalize_feed, analytics: p.analytics_opt_in, sponsors: p.sponsors_opt_in });
        }
        setEmail(user.email || "");
        const { data: xvAll } = await supabase.rpc("xv_leaderboard");
        const mine = ((xvAll as { user_id: string; xv_points: number }[]) || []).find((r) => r.user_id === user.id);
        setPoints({ predictor: p?.predictor_points ?? 0, xv: mine?.xv_points ?? 0 });
        setRefCode(p?.referral_code ?? null);
        const { count: rc } = await supabase
          .from("referrals").select("id", { count: "exact", head: true }).eq("referrer_id", user.id);
        setRefCount(rc || 0);
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

  const shareUrl = refCode ? `${typeof window !== "undefined" ? window.location.origin : ""}/?ref=${refCode}` : "";
  async function copyLink() {
    if (!shareUrl) return;
    try { await navigator.clipboard.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch {}
  }

  async function saveProfile() {
    setSaving(true);
    setSaveMsg(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const msgs: string[] = [];
    const { error: e1 } = await supabase.from("profiles")
      .update({ display_name: name.trim() || "Hincha", phone: phone.trim() || null })
      .eq("id", user.id);
    if (e1) msgs.push("No pudimos guardar nombre/celular.");
    if (email.trim() && email.trim().toLowerCase() !== (user.email || "").toLowerCase()) {
      const { error: e2 } = await supabase.auth.updateUser({ email: email.trim() });
      msgs.push(e2 ? "No pudimos actualizar el email." : "Te enviamos un email para confirmar el cambio de dirección.");
    }
    setSaving(false);
    setSaveMsg(msgs.length ? msgs.join(" ") : "Datos guardados ✓");
    if (!msgs.some((m) => m.startsWith("No pudimos"))) setEditing(false);
  }

  async function uploadAvatar(file: File) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !file) return;
    setUploading(true);
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${user.id}/avatar.${ext}`;
    const { error } = await supabase.storage.from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type || "image/jpeg" });
    if (!error) {
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = `${pub.publicUrl}?v=${Date.now()}`;
      await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
      setAvatarUrl(url);
    } else {
      setSaveMsg("No pudimos subir la imagen.");
    }
    setUploading(false);
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  return (
    <main className="app-shell bg-cream text-white min-h-screen">
      <div className="px-5 pt-12 pb-28">
        <div className="flex items-center justify-between mb-5">
          <h1 className="display text-4xl">Perfil</h1>
          {!authed && <Link href="/login" className="text-brand font-semibold text-sm">Iniciar sesión</Link>}
        </div>

        <div className="flex items-center gap-4 mb-4">
          <div className="relative shrink-0">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="Foto de perfil" className="w-16 h-16 rounded-full object-cover border border-white/10" />
            ) : (
              <Badge label={name.slice(0, 1).toUpperCase()} size={64} />
            )}
            {authed && (
              <button
                onClick={() => fileRef.current?.click()}
                className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-brand grid place-items-center border-2 border-ink"
                aria-label="Cambiar foto de perfil"
              >
                {uploading ? (
                  <span className="w-3 h-3 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                ) : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                )}
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); e.target.value = ""; }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-lg truncate">{name}</p>
            <p className="text-sm text-white/55">{authed ? "Cuenta verificada" : "Modo invitado"}</p>
          </div>
          {authed && (
            <button onClick={() => { setEditing(!editing); setSaveMsg(null); }} className="text-brand text-sm font-semibold shrink-0">
              {editing ? "Cancelar" : "Editar"}
            </button>
          )}
        </div>

        {authed && editing && (
          <div className="bg-card border border-white/5 rounded-2xl p-4 mb-6 space-y-3">
            <Field label="Nombre" value={name} onChange={setName} placeholder="Tu nombre" />
            <Field label="Email" value={email} onChange={setEmail} placeholder="tu@email.com" type="email" />
            <Field label="Celular" value={phone} onChange={setPhone} placeholder="+56 9 1234 5678" type="tel" />
            <button
              onClick={saveProfile}
              disabled={saving}
              className="w-full bg-brand hover:bg-brand-600 transition text-white rounded-xl py-3 font-bold disabled:opacity-60"
            >
              {saving ? "Guardando…" : "GUARDAR"}
            </button>
            <p className="text-[11px] text-white/45">Si cambiás el email, te llega un enlace de confirmación a la casilla nueva.</p>
          </div>
        )}
        {saveMsg && <p className="text-sm text-brand mb-4">{saveMsg}</p>}

        {authed && (
          <>
            <h2 className="text-xs tracking-[0.15em] text-white/55 font-semibold mb-3">TUS PUNTOS</h2>
            <div className="grid grid-cols-3 gap-3 mb-6">
              <PointBox label="Total" value={points.predictor + points.xv} highlight />
              <PointBox label="Armá tu XV" value={points.xv} />
              <PointBox label="Predicciones" value={points.predictor} />
            </div>

            <h2 className="text-xs tracking-[0.15em] text-white/55 font-semibold mb-3">INVITÁ AMIGOS</h2>
            <div className="bg-card border border-white/5 rounded-2xl p-4 mb-6">
              <p className="text-sm text-white/70">Ganás <b>10 puntos</b> por cada amigo que se suma con tu link y arma su feed.</p>
              <div className="flex items-center gap-2 mt-3">
                <input readOnly value={shareUrl} className="flex-1 min-w-0 text-sm bg-cream rounded-xl px-3 py-2 text-white/80" />
                <button onClick={copyLink} className="shrink-0 bg-brand text-white rounded-xl px-4 py-2 text-sm font-bold">
                  {copied ? "¡Copiado!" : "Copiar"}
                </button>
              </div>
              {shareUrl && (
                <a href={`https://wa.me/?text=${encodeURIComponent("Sumate a Tribuna, el hub del rugby 🏉 " + shareUrl)}`}
                   target="_blank" rel="noopener noreferrer"
                   className="block text-center mt-2 bg-green-600 text-white rounded-xl py-2.5 text-sm font-bold">
                  Compartir por WhatsApp
                </a>
              )}
              <p className="text-[12px] text-white/55 mt-3">
                Amigos invitados: <b className="text-white/80">{refCount}</b> · Puntos ganados: <b className="text-white/80">{refCount * 10}</b>
              </p>
            </div>
          </>
        )}

        <h2 className="text-xs tracking-[0.15em] text-white/55 font-semibold mb-3 flex justify-between">
          TUS INTERESES <Link href="/onboarding" className="text-brand">Editar</Link>
        </h2>
        <div className="flex flex-wrap gap-2 mb-6">
          {teams.map((t) => (
            <span key={t.id} className="bg-card rounded-full pl-1 pr-3 py-1 flex items-center gap-2 text-sm font-semibold">
              <Badge label={t.short_name || "?"} color={t.color} size={26} /> {t.name}
            </span>
          ))}
          {players.map((p) => (
            <span key={p.id} className="bg-card rounded-full pl-1 pr-3 py-1 flex items-center gap-2 text-sm font-semibold">
              <Badge label={p.name.split(" ").map((w) => w[0]).slice(0, 2).join("")} size={26} /> {p.name}
            </span>
          ))}
          {teams.length === 0 && players.length === 0 && (
            <span className="text-white/55 text-sm">Sin intereses aún. <Link href="/onboarding" className="text-brand">Armá tu feed</Link></span>
          )}
        </div>

        <h2 className="text-xs tracking-[0.15em] text-white/55 font-semibold mb-3">TUS DATOS Y PRIVACIDAD</h2>
        <Toggle label="Personalizar mi feed" sub="Usar mis intereses para curar el contenido." value={prefs.personalize} onChange={(v) => updatePref("personalize", v)} />
        <Toggle label="Analítica de uso" sub="Mejorar la app con datos agregados y anónimos." value={prefs.analytics} onChange={(v) => updatePref("analytics", v)} />
        <Toggle label="Sponsors y promociones" sub="Recibir activaciones de marcas del rugby." value={prefs.sponsors} onChange={(v) => updatePref("sponsors", v)} />
        <p className="text-xs text-white/55 mt-3 mb-6">
          Tu data es tuya y se recolecta con consentimiento (Ley 21.719). Podés descargarla o borrarla cuando quieras.
        </p>

        {authed ? (
          <button onClick={logout} className="w-full bg-card border border-white/5 rounded-2xl py-4 font-bold text-brand">CERRAR SESIÓN</button>
        ) : (
          <Link href="/" className="block text-center w-full bg-card border border-white/5 rounded-2xl py-4 font-bold text-brand">VOLVER AL INICIO</Link>
        )}
      </div>
      <BottomNav />
    </main>
  );
}

function PointBox({ label, value, highlight = false }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl p-4 text-center ${highlight ? "bg-ink text-white" : "bg-card"}`}>
      <p className={`display text-3xl ${highlight ? "" : "text-brand"}`}>{value.toLocaleString("es-CL")}</p>
      <p className={`text-[11px] mt-1 ${highlight ? "text-white/60" : "text-white/55"}`}>{label}</p>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <label className="block">
      <span className="text-[11px] tracking-wide text-white/55 font-semibold uppercase">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full bg-ink border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/30 focus:border-brand outline-none"
      />
    </label>
  );
}

function Toggle({ label, sub, value, onChange }: { label: string; sub: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="bg-card border border-white/5 rounded-2xl p-4 mb-3 flex items-center justify-between">
      <div className="pr-4">
        <p className="font-bold">{label}</p>
        <p className="text-sm text-white/65">{sub}</p>
      </div>
      <button onClick={() => onChange(!value)} className={`w-12 h-7 rounded-full transition relative shrink-0 ${value ? "bg-green-700" : "bg-white/20"}`} aria-pressed={value}>
        <span className={`absolute top-1 w-5 h-5 bg-card rounded-full transition-all ${value ? "left-6" : "left-1"}`} />
      </button>
    </div>
  );
}
