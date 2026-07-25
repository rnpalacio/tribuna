"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import type { AffiliateProgram } from "@/lib/affiliate";

const EMPTY = { vendor: "", name: "", mode: "wrap" as "wrap" | "param", template: "", param_key: "", param_value: "", notes: "" };

export default function AdminAfiliados() {
  const supabase = useMemo(() => createClient(), []);
  const [authState, setAuthState] = useState<"loading" | "denied" | "ok">("loading");
  const [items, setItems] = useState<(AffiliateProgram & { notes?: string | null })[]>([]);
  const [form, setForm] = useState({ ...EMPTY });
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data } = await supabase.from("affiliate_programs").select("*").order("vendor");
    setItems((data as AffiliateProgram[]) || []);
  }

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setAuthState("denied"); return; }
      const { data: prof } = await supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
      if (!prof?.is_admin) { setAuthState("denied"); return; }
      setAuthState("ok");
      await load();
    })();
  }, [supabase]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg(""); setSaving(true);
    const payload = {
      vendor: form.vendor.trim(),
      name: form.name.trim() || null,
      mode: form.mode,
      template: form.mode === "wrap" ? (form.template.trim() || null) : null,
      param_key: form.mode === "param" ? (form.param_key.trim() || null) : null,
      param_value: form.mode === "param" ? (form.param_value.trim() || null) : null,
      notes: form.notes.trim() || null,
      active: true,
    };
    if (!payload.vendor) { setMsg("El vendor es obligatorio."); setSaving(false); return; }
    if (payload.mode === "wrap" && payload.template && !payload.template.includes("{url}")) {
      setMsg("El template (wrap) debe incluir {url}."); setSaving(false); return;
    }
    const { error } = await supabase.from("affiliate_programs").upsert(payload, { onConflict: "vendor" });
    setSaving(false);
    if (error) { setMsg("Error: " + error.message); return; }
    setForm({ ...EMPTY });
    setMsg("Programa guardado ✓");
    await load();
  }

  async function toggle(it: AffiliateProgram) {
    await supabase.from("affiliate_programs").update({ active: !it.active }).eq("id", it.id);
    await load();
  }

  if (authState === "loading") return <Shell><p className="text-white/55 mt-10 text-center">Cargando…</p></Shell>;
  if (authState === "denied") return <Shell><Denied /></Shell>;

  return (
    <Shell>
      <h1 className="display text-3xl">Afiliados · Admin</h1>
      <p className="text-sm text-white/55 mb-4">Programas de tracking. El <b>vendor</b> tiene que coincidir con el vendor del producto/ticketera.</p>

      <form onSubmit={save} className="bg-card border border-white/5 rounded-2xl p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Vendor (clave)"><input className="input" value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} placeholder="Amazon" /></Field>
          <Field label="Nombre"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Amazon Asociados" /></Field>
        </div>
        <Field label="Modo">
          <select className="input" value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value as "wrap" | "param" })}>
            <option value="wrap">wrap — deep-link con {"{url}"} (Impact, ticketeras)</option>
            <option value="param">param — agregar parámetro a la URL (Amazon, etc.)</option>
          </select>
        </Field>
        {form.mode === "wrap" ? (
          <Field label="Template (incluí {url})">
            <input className="input" value={form.template} onChange={(e) => setForm({ ...form, template: e.target.value })} placeholder="https://x.evyy.net/c/AFF/CAMP?u={url}" />
          </Field>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Param key"><input className="input" value={form.param_key} onChange={(e) => setForm({ ...form, param_key: e.target.value })} placeholder="tag" /></Field>
            <Field label="Param value"><input className="input" value={form.param_value} onChange={(e) => setForm({ ...form, param_value: e.target.value })} placeholder="tustore-20" /></Field>
          </div>
        )}
        <Field label="Notas"><input className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Comisión, link del portal, etc." /></Field>
        <button disabled={saving} className="w-full bg-brand text-white rounded-xl py-3 font-bold disabled:opacity-50">
          {saving ? "Guardando…" : "Guardar programa"}
        </button>
        {msg && <p className="text-sm text-center text-white/70">{msg}</p>}
      </form>

      <h2 className="text-xs tracking-[0.15em] text-white/55 font-semibold mt-6 mb-3">PROGRAMAS ({items.length})</h2>
      <div className="space-y-2">
        {items.map((it) => (
          <div key={it.id} className={`bg-card border border-white/5 rounded-2xl p-3 flex items-center gap-3 ${it.active ? "" : "opacity-50"}`}>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">{it.vendor} <span className="text-white/50 font-normal">· {it.mode}</span></p>
              <p className="text-[11px] text-white/55 truncate">{it.template || (it.param_key ? `${it.param_key}=${it.param_value}` : "sin configurar")}</p>
            </div>
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${it.active ? "bg-brand/10 text-brand" : "bg-white/[0.06] text-white/50"}`}>
              {it.active ? "activo" : "inactivo"}
            </span>
            <button onClick={() => toggle(it)} className="text-xs font-semibold text-brand shrink-0">
              {it.active ? "Desactivar" : "Activar"}
            </button>
          </div>
        ))}
        {items.length === 0 && <div className="bg-card border border-white/5 rounded-2xl p-5 text-center text-white/65 text-sm">Sin programas todavía.</div>}
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
          <Link href="/admin/merch" className="text-white/55 font-semibold">Merch</Link>
          <Link href="/admin/afiliados" className="text-brand font-semibold">Afiliados</Link>
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
