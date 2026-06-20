"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function Login() {
  const supabase = useMemo(() => createClient(), []);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setLoading(false);
    if (error) setErr(error.message);
    else setSent(true);
  }

  return (
    <main className="app-shell bg-ink text-white flex flex-col">
      <div className="flex-1 px-6 pt-20 pb-10">
        <Link href="/" className="text-white/60 text-sm">‹ Volver</Link>
        <div className="flex items-center gap-3 mt-10">
          <div className="w-12 h-12 rounded-2xl bg-brand grid place-items-center text-2xl font-extrabold">T</div>
          <span className="text-2xl font-extrabold tracking-wide">TRIBUNA</span>
        </div>

        <h1 className="display text-4xl mt-16">Iniciá sesión</h1>
        <p className="text-white/70 mt-2 mb-8">
          Te enviamos un enlace mágico a tu email. Sin contraseñas.
        </p>

        {sent ? (
          <div className="bg-white/10 rounded-2xl p-5">
            <p className="font-bold">Revisá tu email ✉️</p>
            <p className="text-white/70 text-sm mt-1">
              Te enviamos un enlace a <span className="text-white">{email}</span> para entrar.
            </p>
          </div>
        ) : (
          <form onSubmit={send}>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              className="w-full bg-white/10 rounded-2xl px-4 py-4 outline-none focus:ring-2 ring-brand placeholder:text-white/40"
            />
            {err && <p className="text-red-400 text-sm mt-2">{err}</p>}
            <button
              disabled={loading}
              className="w-full bg-brand hover:bg-brand-600 transition rounded-2xl py-4 font-bold tracking-wide mt-4 disabled:opacity-60"
            >
              {loading ? "ENVIANDO…" : "ENVIAR ENLACE"}
            </button>
          </form>
        )}

        <p className="text-center text-white/55 mt-6 text-sm">
          ¿Primera vez?{" "}
          <Link href="/onboarding" className="text-white font-semibold">Armá tu feed</Link>
        </p>
      </div>
    </main>
  );
}
