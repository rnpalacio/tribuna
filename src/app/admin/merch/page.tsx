"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { BottomNav } from "@/components/BottomNav";

type TeamLite = { id: string; name: string; slug: string; kind: string };
type Merch = {
  id: string; team_id: string; title: string; image_url: string | null;
  price: string | null; url: string; vendor: string | null; sort: number; active: boolean;
};

const EMPTY = { team_id: "", title: "", url: "", image_url: "", price: "", vendor: "", sort: 0 };

export default function AdminMerch() {
  const supabase = useMemo(() => createClient(), []);
  const [authState, setAuthState] = useState<"loading" | "denied" | "ok">("loading");
  const [teams, setTeams] = useState<TeamLite[]>([]);
  const [items, setItems] = useState<Merch[]>([]);
  const [form, setForm] = useState({ ...EMPTY });
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadItems() {
    const { data } = await supabase.from("merch_products").select("*").order("created_at", { ascending: false });
    setItems((data as Merch[]) || []);
  }

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setAuthState("denied"); return; }
      const { data: prof } = await supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
      if (!prof?.is_admin) { setAuthState("denied"); return; }
      setAuthState("ok");
      const { data: t } = await supabase.from("teams").select("id,name,slug,kind").order("name");
      setTeams((t as TeamLite[]) || []);
      await loadItems();
    })();
  }, [supabase]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg(""); setSaving(true);
    const payload = {
      team_id: form.team_id || null,
      title: form.title.trim(),
      url: form.url.trim(),
      image_url: form.image_url.trim() || null,
      price: form.price.trim() || null,
      vendor: form.vendor.trim() || null,
      sort: Number(form.sort) || 0,
      active: true,
    };
    if (!payload.team_id || !payload.title || !payload.url) {
      setMsg("Equipo, título y URL son obligatorios."); setSaving(false); return;
    }
    const { error } = await supabase.from("merch_products").insert(payload);
    setSaving(false);
    if (error) { setMsg("Error: " + error.message); return; }
    setForm({ ...EMPTY });
    setMsg("Producto agregado ✓");
    await loadItems();
  }

  async function toggle(it: Merch) {
    await supabase.from("merch_products").update({ active: !it.active }).eq("id", it.id);
    await loadItems();
  }

  if (authState === "loading") return <Shell><p className="text-white/55 mt-10 text-center">Cargando…</p></Shell>;
  if (authState === "denied") return <Shell><Denied /></Shell>;

  const teamName = (id: string) => teams.find((t) => t.id === id)?.name || "—";

  return (
    <Shell>
      <h1 className="display text-3xl">Merch · Admin</h1>
      <p className="text-sm text-white/55 mb-4">Cargá productos oficiales por equipo. Aparecen en la ficha del equipo.</p>

      <form onSubmit={save} className="bg-card border border-white/5 rounded-2xl p-4 space-y-3">
        <Field label="Equipo">
          <select className="input" value={form.team_id} onChange={(e) => setForm({ ...form, team_id: e.target.value })}>
            <option value="">Elegí un equipo…</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.kind})</option>)}
          </select>
        </Field>
        <Field label="Título"><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Camiseta titular 2026" /></Field>
        <Field label="URL del producto"><input className="input" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://tienda.../producto" /></Field>
        <Field label="URL de imagen"><input className="input" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://…/foto.jpg" /></Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Precio"><input className="input" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="$39.990" /></Field>
          <Field label="Vendor"><input className="input" value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} placeholder="Amazon" /></Field>
          <Field label="Orden"><input className="input" type="number" value={form.sort} onChange={(e) => setForm({ ...form, sort: Number(e.target.value) })} /></Field>
        </div>
        <button disabled={saving} className="w-full bg-brand text-white rounded-xl py-3 font-bold disabled:opacity-50">
          {saving ? "Guardando…" : "Agregar producto"}
        </button>
        {msg && <p className="text-sm text-center text-white/70">{msg}</p>}
      </form>

      <h2 className="text-xs tracking-[0.15em] text-white/55 font-semibold mt-6 mb-3">PRODUCTOS CARGADOS ({items.length})</h2>
      <div className="space-y-2">
        {items.map((it) => (
          <div key={it.id} className={`bg-card border border-white/5 rounded-2xl p-3 flex items-center gap-3 ${it.active ? "" : "opacity-50"}`}>
            {it.image_url
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={it.image_url} alt="" className="w-12 h-12 rounded-lg object-cover" />
              : <div className="w-12 h-12 rounded-lg bg-white/[0.06]" />}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{it.title}</p>
              <p className="text-[11px] text-white/55">{teamName(it.team_id)} · {it.price || "s/precio"} · {it.vendor || "s/vendor"}</p>
            </div>
            <button onClick={() => toggle(it)} className="text-xs font-semibold text-brand shrink-0">
              {it.active ? "Ocultar" : "Mostrar"}
            </button>
          </div>
        ))}
        {items.length === 0 && <div className="bg-card border border-white/5 rounded-2xl p-5 text-center text-white/65 text-sm">Todavía no cargaste productos.</div>}
      </div>

      <style jsx>{`.input{width:100%;border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:10px 12px;font-size:14px;background:#0A0E16;color:#fff}`}</style>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="app-shell bg-cream text-white min-h-screen">
      <div className="px-5 pt-12 pb-28">
        <div className="flex gap-3 text-sm mb-2">
          <Link href="/admin/merch" className="text-brand font-semibold">Merch</Link>
          <Link href="/admin/afiliados" className="text-white/55 font-semibold">Afiliados</Link>
        </div>
        {children}
      </div>
      <BottomNav />
    </main>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-xs text-white/55 font-semibold">{label}</span><div className="mt-1">{children}</div></label>;
}
function Denied() {
  return (
    <div className="bg-card border border-white/5 rounded-2xl p-6 mt-8 text-center">
      <p className="font-bold">Acceso restringido</p>
      <p className="text-sm text-white/65 mt-1">Necesitás iniciar sesión con una cuenta de administrador.</p>
      <Link href="/login" className="inline-block mt-4 text-brand font-semibold">Iniciar sesión ›</Link>
    </div>
  );
}
