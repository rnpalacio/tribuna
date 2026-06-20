"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/Badge";
import type { Player, Team } from "@/lib/types";

const MAX = 15;
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

type Row = Player & { team?: Team | null; points: number };

export default function XVBuilder() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<Row[]>([]);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [teamId, setTeamId] = useState<string | null>(null);
  const [authed, setAuthed] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: players }, { data: pts }] = await Promise.all([
        supabase.from("players").select("*, team:team_id(*)").order("name", { ascending: true }),
        supabase.from("player_points").select("player_id, points"),
      ]);
      const pmap = new Map<string, number>();
      ((pts as { player_id: string; points: number }[]) || []).forEach((r) => pmap.set(r.player_id, r.points));
      const merged: Row[] = ((players as (Player & { team?: Team })[]) || []).map((p) => ({
        ...p,
        points: pmap.get(p.id) ?? 0,
      }));
      setRows(merged);

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setAuthed(true);
        const { data: ft } = await supabase.from("fantasy_teams").select("id").eq("user_id", user.id).maybeSingle();
        if (ft) {
          setTeamId(ft.id);
          const { data: picks } = await supabase.from("fantasy_picks").select("player_id").eq("fantasy_team_id", ft.id);
          setSel(new Set(((picks as { player_id: string }[]) || []).map((r) => r.player_id)));
        }
      }
      setLoading(false);
    })();
  }, [supabase]);

  const q = norm(query.trim());
  const list = q
    ? rows.filter((r) => norm(`${r.name} ${r.position} ${r.team?.name || ""} ${r.country}`).includes(q))
    : rows;
  const selRows = rows.filter((r) => sel.has(r.id));
  const totalPts = selRows.reduce((s, r) => s + r.points, 0);

  function toggle(id: string) {
    setMsg(null);
    setSel((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX) next.add(id);
      else setMsg(`Tu XV ya tiene ${MAX} jugadores. Sacá uno para sumar otro.`);
      return next;
    });
  }

  async function save() {
    setMsg(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setMsg("Iniciá sesión para guardar tu XV y entrar al ranking.");
      return;
    }
    setSaving(true);
    let id = teamId;
    if (!id) {
      const { data, error } = await supabase
        .from("fantasy_teams").insert({ user_id: user.id }).select("id").single();
      if (error || !data) { setMsg("No se pudo guardar. Probá de nuevo."); setSaving(false); return; }
      id = data.id;
      setTeamId(id);
    }
    await supabase.from("fantasy_picks").delete().eq("fantasy_team_id", id);
    const ids = [...sel];
    if (ids.length) {
      await supabase.from("fantasy_picks").insert(ids.map((pid) => ({ fantasy_team_id: id, player_id: pid })));
    }
    setSaving(false);
    setMsg("¡XV guardado! Tus puntos se actualizan con cada fecha.");
  }

  return (
    <main className="app-shell bg-cream text-ink min-h-screen">
      <div className="px-5 pt-12 pb-40">
        <Link href="/comunidad" className="text-brand font-semibold text-sm">‹ Comunidad</Link>
        <h1 className="display text-3xl mt-3">Armá tu XV</h1>
        <p className="text-black/55 text-sm mt-1 mb-4">
          Elegí 15 jugadores. Cada fecha suman los puntos que hace su club (gana 4 · empata 2 · bonus).
        </p>

        {!authed && (
          <div className="bg-white rounded-2xl p-4 text-sm text-black/60 mb-4">
            Podés armarlo igual, pero <Link href="/login" className="text-brand font-semibold">iniciá sesión</Link> para guardarlo y entrar al ranking.
          </div>
        )}

        <div className="relative mb-4">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-black/35">🔍</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar jugador, club o posición…"
            className="w-full bg-white rounded-2xl pl-11 pr-4 py-3 outline-none border-2 border-transparent focus:border-brand/40 transition"
          />
        </div>

        <div className="space-y-3">
          {list.map((r) => {
            const on = sel.has(r.id);
            return (
              <button
                key={r.id}
                onClick={() => toggle(r.id)}
                className={`w-full bg-white rounded-2xl p-3 flex items-center gap-3 border-2 transition ${on ? "border-brand" : "border-transparent"}`}
              >
                <Badge label={r.name.split(" ").map((w) => w[0]).slice(0, 2).join("")} color={r.team?.color} size={44} />
                <div className="text-left flex-1">
                  <p className="font-bold leading-tight">{r.name}</p>
                  <p className="text-xs text-black/45">
                    {[r.position, r.team?.name].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <span className="text-xs font-bold text-black/55 mr-1">{r.points} pts</span>
                <span className={`w-7 h-7 rounded-full grid place-items-center text-sm ${on ? "bg-brand text-white" : "bg-black/5 text-black/40"}`}>
                  {on ? "✓" : "+"}
                </span>
              </button>
            );
          })}
          {list.length === 0 && <p className="text-center text-black/40 py-6">Sin resultados.</p>}
          {loading && <p className="text-center text-black/40 py-6">Cargando jugadores…</p>}
        </div>
      </div>

      {/* Barra inferior con resumen + guardar */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] p-4 bg-gradient-to-t from-cream via-cream to-transparent">
        {msg && <p className="text-center text-xs text-black/60 mb-2">{msg}</p>}
        <div className="bg-ink text-white rounded-2xl p-3 flex items-center justify-between">
          <div className="pl-2">
            <p className="text-xs text-white/60">Tu XV</p>
            <p className="font-bold">{sel.size}/{MAX} · {totalPts} pts</p>
          </div>
          <button
            disabled={saving || sel.size === 0}
            onClick={save}
            className="bg-brand hover:bg-brand-600 transition rounded-xl px-6 py-3 font-bold disabled:opacity-50"
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </main>
  );
}
