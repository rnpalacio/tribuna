"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/Badge";
import type { Player, Team } from "@/lib/types";

const MAX = 15;
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

type Row = Player & { team?: Team | null };

export default function XVBuilder() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<Row[]>([]);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [savedSet, setSavedSet] = useState<Set<string>>(new Set());
  const [teamId, setTeamId] = useState<string | null>(null);
  const [authed, setAuthed] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: players } = await supabase
        .from("players").select("*, team:team_id(*)").order("name", { ascending: true });
      setRows((players as Row[]) || []);

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setAuthed(true);
        const { data: ft } = await supabase.from("fantasy_teams").select("id").eq("user_id", user.id).maybeSingle();
        if (ft) {
          setTeamId(ft.id);
          const { data: picks } = await supabase.from("fantasy_picks").select("player_id").eq("fantasy_team_id", ft.id);
          const ids = ((picks as { player_id: string }[]) || []).map((r) => r.player_id);
          setSel(new Set(ids));
          setSavedSet(new Set(ids));
        }
      }
      setLoading(false);
    })();
  }, [supabase]);

  const q = norm(query.trim());
  const list = q
    ? rows.filter((r) => norm(`${r.name} ${r.position} ${r.team?.name || ""} ${r.country}`).includes(q))
    : rows;
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
    // Guardado por diferencias: solo borramos los que sacaste e insertamos los
    // nuevos. Los que mantenés conservan su fecha de elección (no reinician sus puntos).
    const toDelete = [...savedSet].filter((pid) => !sel.has(pid));
    const toInsert = [...sel].filter((pid) => !savedSet.has(pid));
    if (toDelete.length) {
      await supabase.from("fantasy_picks").delete().eq("fantasy_team_id", id).in("player_id", toDelete);
    }
    if (toInsert.length) {
      await supabase.from("fantasy_picks").insert(toInsert.map((pid) => ({ fantasy_team_id: id, player_id: pid })));
    }
    setSavedSet(new Set(sel));
    setSaving(false);
    setMsg("¡XV guardado! Suman solo los partidos que se jueguen de ahora en adelante.");
  }

  return (
    <main className="app-shell bg-cream text-ink min-h-screen">
      <div className="px-5 pt-12 pb-40">
        <Link href="/comunidad" className="text-brand font-semibold text-sm">‹ Comunidad</Link>
        <h1 className="display text-3xl mt-3">Armá tu XV</h1>
        <p className="text-black/55 text-sm mt-1 mb-4">
          Elegí 15 jugadores y adiviná quiénes van a sumar más. Solo cuentan los
          partidos que se jueguen <b>después</b> de que los elijas (gana 4 · empata 2 · bonus).
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
            <p className="font-bold">{sel.size}/{MAX} jugadores</p>
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
