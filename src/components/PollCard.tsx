"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Poll } from "@/lib/types";

export function PollCard({ poll, dark = true }: { poll: Poll; dark?: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const [options, setOptions] = useState(poll.poll_options || []);
  const [voted, setVoted] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const total = options.reduce((s, o) => s + o.votes, 0) + (voted ? 1 : 0);

  async function vote(optionId: string) {
    if (voted) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setMsg("Iniciá sesión para votar y sumar puntos.");
      return;
    }
    const { error } = await supabase
      .from("poll_votes")
      .insert({ poll_id: poll.id, option_id: optionId, user_id: user.id });
    if (error) {
      setMsg("Ya votaste en esta encuesta.");
      return;
    }
    setOptions((prev) => prev.map((o) => (o.id === optionId ? { ...o, votes: o.votes + 1 } : o)));
    setVoted(optionId);
  }

  const sorted = [...options].sort((a, b) => a.sort - b.sort);

  return (
    <div className={`${dark ? "bg-ink text-white" : "bg-white text-ink"} rounded-2xl p-4`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-brand text-xs font-bold tracking-[0.15em]">
          {poll.kind === "prediction" ? "PREDICCIÓN · COMUNIDAD" : "ENCUESTA"}
        </span>
      </div>
      <h3 className="display text-2xl mb-3">{poll.question}</h3>
      <div className={poll.kind === "prediction" ? "grid grid-cols-2 gap-3" : "space-y-2"}>
        {sorted.map((o) => {
          const pct = total ? Math.round((o.votes / total) * 100) : 0;
          const isMine = voted === o.id;
          return (
            <button
              key={o.id}
              onClick={() => vote(o.id)}
              className={`relative overflow-hidden text-left rounded-xl px-4 py-3 transition ${dark ? "bg-white/10" : "bg-black/5"} ${isMine ? "ring-2 ring-brand" : ""}`}
            >
              {voted && (
                <span className="absolute inset-y-0 left-0 bg-brand/30" style={{ width: `${pct}%` }} />
              )}
              <span className="relative flex justify-between items-center font-semibold">
                <span>{o.label}</span>
                {voted && <span className="text-sm opacity-80">{pct}%</span>}
              </span>
            </button>
          );
        })}
      </div>
      <p className={`text-xs mt-3 ${dark ? "text-white/55" : "text-black/45"}`}>
        {msg || `Votá y sumá puntos · ${total.toLocaleString("es-CL")} hinchas`}
      </p>
    </div>
  );
}
