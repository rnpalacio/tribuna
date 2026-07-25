"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { BottomNav } from "@/components/BottomNav";

type Notif = { id: string; type: string; title: string; body: string | null; link: string | null; read: boolean; created_at: string };

const ICON: Record<string, string> = {
  prediction_scored: "🎯", match_result: "🏉", match_soon: "⏱️", referral: "🎉", system: "📣",
};

export default function Notificaciones() {
  const supabase = useMemo(() => createClient(), []);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [items, setItems] = useState<Notif[]>([]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setAuthed(false); return; }
      setAuthed(true);
      const { data } = await supabase
        .from("notifications").select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      const list = (data as Notif[]) || [];
      setItems(list);
      // marcar como leídas las no leídas
      const unreadIds = list.filter((n) => !n.read).map((n) => n.id);
      if (unreadIds.length) {
        await supabase.from("notifications").update({ read: true }).in("id", unreadIds);
      }
    })();
  }, [supabase]);

  return (
    <main className="app-shell bg-cream text-white min-h-screen">
      <div className="px-5 pt-12 pb-28">
        <Link href="/feed" className="text-brand font-semibold text-sm">‹ Hoy</Link>
        <h1 className="display text-4xl mt-3 mb-4">Notificaciones</h1>

        {authed === false && (
          <div className="bg-card border border-white/5 rounded-2xl p-6 text-center">
            <p className="text-white/65 text-sm">Iniciá sesión para ver tus notificaciones.</p>
            <Link href="/login" className="inline-block mt-3 text-brand font-semibold">Iniciar sesión ›</Link>
          </div>
        )}

        {authed && items.length === 0 && (
          <div className="bg-card border border-white/5 rounded-2xl p-6 text-center text-white/65 text-sm">
            No tenés notificaciones todavía. Te avisamos cuando tu equipo juegue o se resuelvan tus predicciones.
          </div>
        )}

        <div className="space-y-2">
          {items.map((n) => {
            const card = (
              <div className={`bg-card border border-white/5 rounded-2xl p-4 flex gap-3 ${n.read ? "" : "ring-2 ring-brand/30"}`}>
                <span className="text-xl shrink-0">{ICON[n.type] || "🔔"}</span>
                <div className="min-w-0">
                  <p className="font-bold text-sm leading-snug">{n.title}</p>
                  {n.body && <p className="text-sm text-white/65 mt-0.5">{n.body}</p>}
                  <p className="text-[11px] text-white/45 mt-1">{timeAgo(n.created_at)}</p>
                </div>
              </div>
            );
            return n.link ? <Link key={n.id} href={n.link} className="block">{card}</Link> : <div key={n.id}>{card}</div>;
          })}
        </div>
      </div>
      <BottomNav />
    </main>
  );
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3.6e6);
  if (h < 1) return "hace minutos";
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
}
