"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Props = {
  matchId: string;
  homeName: string;
  awayName: string;
  homeShort: string;
  awayShort: string;
  kickoffISO: string | null;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
};

export function MatchPrediction(props: Props) {
  const { matchId, homeName, awayName, homeShort, awayShort, kickoffISO, status, homeScore, awayScore } = props;
  const supabase = useMemo(() => createClient(), []);
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [ph, setPh] = useState<string>("");
  const [pa, setPa] = useState<string>("");
  const [existing, setExisting] = useState<{ pred_home: number; pred_away: number; points: number; scored: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const open = status === "scheduled" && !!kickoffISO && new Date(kickoffISO).getTime() > Date.now();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setAuthed(true);
        const { data } = await supabase
          .from("predictions")
          .select("pred_home, pred_away, points, scored")
          .eq("user_id", user.id).eq("match_id", matchId).maybeSingle();
        if (data) {
          setExisting(data as { pred_home: number; pred_away: number; points: number; scored: boolean });
          setPh(String((data as { pred_home: number }).pred_home));
          setPa(String((data as { pred_away: number }).pred_away));
        }
      }
      setLoading(false);
    })();
  }, [supabase, matchId]);

  async function save() {
    setMsg(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setMsg("Iniciá sesión para predecir."); return; }
    const h = parseInt(ph, 10), a = parseInt(pa, 10);
    if (Number.isNaN(h) || Number.isNaN(a) || h < 0 || a < 0) { setMsg("Ingresá un marcador válido."); return; }
    setSaving(true);
    const { error } = await supabase
      .from("predictions")
      .upsert({ user_id: user.id, match_id: matchId, pred_home: h, pred_away: a }, { onConflict: "user_id,match_id" });
    setSaving(false);
    if (error) { setMsg("Las predicciones de este partido están cerradas."); return; }
    setExisting({ pred_home: h, pred_away: a, points: 0, scored: false });
    setMsg("¡Predicción guardada! Suma puntos al ranking si acertás.");
  }

  if (loading) return null;

  return (
    <div className="bg-white rounded-2xl p-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <p className="font-bold">Tu predicción</p>
        <span className="text-[11px] text-black/45 font-semibold">+3 GANADOR · +5 EXACTO</span>
      </div>

      {!authed ? (
        <p className="text-sm text-black/55">
          <Link href="/login" className="text-brand font-semibold">Iniciá sesión</Link> para predecir el marcador y entrar al ranking de predictores.
        </p>
      ) : open ? (
        <>
          <div className="flex items-center justify-center gap-3">
            <PredInput label={homeShort} value={ph} onChange={setPh} />
            <span className="text-black/30 font-bold">–</span>
            <PredInput label={awayShort} value={pa} onChange={setPa} />
          </div>
          <button
            disabled={saving}
            onClick={save}
            className="w-full mt-4 bg-brand hover:bg-brand-600 transition text-white rounded-xl py-3 font-bold disabled:opacity-60"
          >
            {saving ? "Guardando…" : existing ? "Actualizar predicción" : "Guardar predicción"}
          </button>
          {msg && <p className="text-xs text-black/55 mt-2 text-center">{msg}</p>}
        </>
      ) : (
        // Cerrada
        <div className="text-sm">
          {existing ? (
            <div className="flex items-center justify-between">
              <span className="text-black/55">
                Predijiste <b>{homeName} {existing.pred_home}–{existing.pred_away} {awayName}</b>
              </span>
              {existing.scored && (
                <span className={`font-bold ${existing.points > 0 ? "text-green-700" : "text-black/40"}`}>
                  +{existing.points} pts
                </span>
              )}
            </div>
          ) : (
            <p className="text-black/45">Predicciones cerradas para este partido.</p>
          )}
          {existing && !existing.scored && status === "final" && homeScore !== null && (
            <p className="text-xs text-black/45 mt-1">Resultado: {homeScore}–{awayScore}. Puntos en cálculo.</p>
          )}
        </div>
      )}
    </div>
  );
}

function PredInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs font-semibold text-black/55">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        className="w-20 text-center text-2xl font-bold bg-cream rounded-xl py-2 outline-none border-2 border-transparent focus:border-brand/40"
      />
    </div>
  );
}
