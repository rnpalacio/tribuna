"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/Badge";
import { BottomNav } from "@/components/BottomNav";
import { PollCard } from "@/components/PollCard";
import type { Team, Match, Article, Poll, ArticleCategory } from "@/lib/types";

// Cuántas notas mostramos de cada categoría para que ninguna tape a otra.
const CATEGORY_LIMITS: Record<ArticleCategory, number> = {
  chile: 7,
  argentina: 3,
  global: 5,
};

const CATEGORY_META: Record<ArticleCategory, { label: string; short: string }> = {
  chile: { label: "Chile", short: "🇨🇱 Chile" },
  argentina: { label: "Argentina", short: "🇦🇷 Argentina" },
  global: { label: "Mundial", short: "🌍 Mundial" },
};

type Filter = "todo" | ArticleCategory;

// Intercala las listas por categoría (round-robin) para que el feed mezcle
// fuentes en lugar de amontonar una sola categoría arriba.
function interleave(groups: Article[][]): Article[] {
  const out: Article[] = [];
  const max = Math.max(0, ...groups.map((g) => g.length));
  for (let i = 0; i < max; i++) {
    for (const g of groups) if (g[i]) out.push(g[i]);
  }
  return out;
}

export default function Feed() {
  const supabase = useMemo(() => createClient(), []);
  const [name, setName] = useState("hincha");
  const [followed, setFollowed] = useState<Team[]>([]);
  const [match, setMatch] = useState<Match | null>(null);
  const [byCategory, setByCategory] = useState<Record<ArticleCategory, Article[]>>({
    chile: [],
    argentina: [],
    global: [],
  });
  const [filter, setFilter] = useState<Filter>("todo");
  const [poll, setPoll] = useState<Poll | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      let teamIds: string[] = [];

      if (user) {
        const { data: prof } = await supabase
          .from("profiles").select("display_name").eq("id", user.id).single();
        if (prof?.display_name) setName(prof.display_name);
        const { data: f } = await supabase
          .from("follows").select("team_id").eq("user_id", user.id).not("team_id", "is", null);
        teamIds = (f || []).map((r: { team_id: string }) => r.team_id);
      } else {
        try {
          const local = JSON.parse(localStorage.getItem("tribuna_follows") || "{}");
          teamIds = local.teams || [];
        } catch {}
      }

      if (teamIds.length) {
        const { data: t } = await supabase.from("teams").select("*").in("id", teamIds);
        setFollowed((t as Team[]) || []);
      }

      const { data: m } = await supabase
        .from("matches")
        .select("*, home_team:home_team_id(*), away_team:away_team_id(*), competition:competition_id(*)")
        .eq("status", "final")
        .order("kickoff_at", { ascending: false })
        .limit(1);
      setMatch((m?.[0] as Match) || null);

      // Una consulta por categoría con su propio límite, así ninguna tapa a otra.
      const cats = Object.keys(CATEGORY_LIMITS) as ArticleCategory[];
      const results = await Promise.all(
        cats.map((cat) =>
          supabase
            .from("articles")
            .select("*, source:source_id(*)")
            .eq("category", cat)
            .order("published_at", { ascending: false })
            .limit(CATEGORY_LIMITS[cat])
        )
      );
      const grouped: Record<ArticleCategory, Article[]> = { chile: [], argentina: [], global: [] };
      cats.forEach((cat, i) => {
        grouped[cat] = (results[i].data as Article[]) || [];
      });
      setByCategory(grouped);

      const { data: p } = await supabase
        .from("polls")
        .select("*, poll_options(*)")
        .eq("active", true)
        .eq("kind", "prediction")
        .limit(1);
      setPoll((p?.[0] as Poll) || null);

      setLoading(false);
    })();
  }, [supabase]);

  const visibleArticles = useMemo(() => {
    if (filter === "todo") {
      return interleave([byCategory.chile, byCategory.argentina, byCategory.global]);
    }
    return byCategory[filter];
  }, [filter, byCategory]);

  return (
    <main className="app-shell bg-cream text-ink min-h-screen">
      <div className="px-5 pt-12 pb-28">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-black/45 text-sm">Buenas, {name}</p>
            <h1 className="display text-4xl">Hoy</h1>
          </div>
          <div className="w-11 h-11 rounded-full bg-white grid place-items-center shadow">
            🔔
          </div>
        </div>

        {/* followed chips */}
        {followed.length > 0 && (
          <div className="flex gap-4 mt-5 overflow-x-auto no-scrollbar">
            {followed.map((t) => (
              <div key={t.id} className="flex flex-col items-center gap-1 shrink-0">
                <Badge label={t.short_name || t.name.slice(0, 3)} color={t.color} size={52} />
                <span className="text-xs text-black/55">{t.name.replace("Los ", "")}</span>
              </div>
            ))}
          </div>
        )}

        {/* match result */}
        {match && <MatchResult match={match} />}

        {/* poll */}
        {poll && <div className="mt-4"><PollCard poll={poll} /></div>}

        {/* category filters */}
        <div className="flex gap-2 mt-5 overflow-x-auto no-scrollbar">
          {(["todo", "chile", "argentina", "global"] as Filter[]).map((f) => {
            const count =
              f === "todo"
                ? Object.values(byCategory).reduce((n, g) => n + g.length, 0)
                : byCategory[f].length;
            const label = f === "todo" ? "Todo" : CATEGORY_META[f].short;
            const isActive = filter === f;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                  isActive ? "bg-brand text-white" : "bg-white text-black/55"
                }`}
              >
                {label}
                {count > 0 && (
                  <span className={`ml-1.5 ${isActive ? "text-white/70" : "text-black/35"}`}>{count}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* articles */}
        <div className="mt-4 space-y-4">
          {visibleArticles.map((a) => (
            <ArticleCard key={a.id} a={a} />
          ))}
        </div>

        {loading && <p className="text-center text-black/40 mt-10">Cargando tu feed…</p>}
        {!loading && visibleArticles.length === 0 && (
          <div className="bg-white rounded-2xl p-5 mt-4 text-center text-black/55">
            Todavía no hay noticias cargadas. El feed se actualiza
            automáticamente cuando la ingesta corre.
          </div>
        )}
      </div>
      <BottomNav />
    </main>
  );
}

function MatchResult({ match }: { match: Match }) {
  const h = match.home_team, a = match.away_team;
  return (
    <div className="bg-white rounded-2xl mt-5 overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-4">
        <span className="text-xs tracking-[0.15em] text-black/45 font-semibold">
          {match.competition?.short_name || "PARTIDO"} {match.round ? "· " + match.round : ""}
        </span>
        <span className="text-[11px] bg-black/5 rounded px-2 py-0.5 font-semibold text-black/60">
          {match.status === "final" ? "FINAL" : ""}
        </span>
      </div>
      <div className="flex items-center justify-between px-4 py-4">
        <div className="flex items-center gap-2">
          <Badge label={h?.short_name || "?"} color={h?.color} size={34} />
          <span className="font-bold">{h?.name}</span>
        </div>
        <span className="display text-3xl">{match.home_score} – {match.away_score}</span>
        <div className="flex items-center gap-2">
          <span className="font-bold">{a?.name}</span>
          <Badge label={a?.short_name || "?"} color={a?.color} size={34} />
        </div>
      </div>
      <div className="flex items-center justify-between px-4 py-3 border-t border-black/5">
        <span className="text-sm text-black/45">
          {[match.venue, match.city].filter(Boolean).join(" · ")}
        </span>
        {match.summary_url && (
          <a href={match.summary_url} className="text-brand text-sm font-semibold">VER RESUMEN ›</a>
        )}
      </div>
    </div>
  );
}

function ArticleCard({ a }: { a: Article }) {
  return (
    <a href={a.url || "#"} target="_blank" rel="noopener noreferrer" className="block bg-white rounded-2xl overflow-hidden">
      <div className="flex">
        <div className="flex-1 p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-5 h-5 rounded-full bg-brand grid place-items-center text-[10px] text-white font-bold">
              {(a.author || a.source?.name || "R")[0]}
            </span>
            <span className="text-sm font-semibold">{a.author || a.source?.name}</span>
            {a.category && CATEGORY_META[a.category] && (
              <span className="ml-auto text-[10px] font-semibold bg-black/5 text-black/55 rounded-full px-2 py-0.5">
                {CATEGORY_META[a.category].short}
              </span>
            )}
          </div>
          <p className="font-bold leading-snug">{a.title}</p>
          <p className="text-xs text-black/45 mt-2">
            {a.published_at ? timeAgo(a.published_at) : ""} · Leer ›
          </p>
        </div>
        {a.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={a.image_url} alt="" className="w-28 object-cover" />
        )}
      </div>
    </a>
  );
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3.6e6);
  if (h < 1) return "hace minutos";
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
}
