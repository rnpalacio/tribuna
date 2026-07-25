"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function FollowButton({ teamId }: { teamId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [following, setFollowing] = useState(false);
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setAuthed(true);
        const { data } = await supabase
          .from("follows").select("id").eq("user_id", user.id).eq("team_id", teamId).maybeSingle();
        setFollowing(!!data);
      } else {
        try {
          const local = JSON.parse(localStorage.getItem("tribuna_follows") || "{}");
          setFollowing((local.teams || []).includes(teamId));
        } catch {}
      }
      setReady(true);
    })();
  }, [supabase, teamId]);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    const next = !following;
    setFollowing(next);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      if (next) {
        await supabase.from("follows").insert({ user_id: user.id, kind: "team", team_id: teamId });
      } else {
        await supabase.from("follows").delete().eq("user_id", user.id).eq("team_id", teamId);
      }
    } else {
      try {
        const local = JSON.parse(localStorage.getItem("tribuna_follows") || "{}");
        const teams: string[] = local.teams || [];
        local.teams = next ? [...new Set([...teams, teamId])] : teams.filter((t) => t !== teamId);
        localStorage.setItem("tribuna_follows", JSON.stringify(local));
      } catch {}
    }
    setBusy(false);
  }

  if (!ready) {
    return <div className="h-9 w-24 rounded-full bg-white/[0.06] animate-pulse" />;
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`rounded-full px-4 h-9 text-sm font-bold transition disabled:opacity-60 ${
        following ? "bg-white/[0.06] text-white/65" : "bg-brand text-white"
      }`}
    >
      {following ? "Siguiendo ✓" : "+ Seguir"}
    </button>
  );
}
