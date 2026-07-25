"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/Badge";
import { BottomNav } from "@/components/BottomNav";
import { NotificationBell } from "@/components/NotificationBell";
import type { Team, Match, Article, ArticleCategory } from "@/lib/types";
import { isLiveNow, streamingFor } from "@/lib/live";
import { withRound } from "@/lib/format";

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
  const [live, setLive] = useState<Match[]>([]);
  const [byCategory, setByCategory] = useState<Record<ArticleCategory, Article[]>>({
    chile: [],
    argentina: [],
    global: [],
  });
  const [filter, setFilter] = useState<Filter>("todo");
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

      // Partidos posiblemente en vivo (kickoff reciente o status live)
      const since = new Date(Date.now() - 3 * 3600_000).toISOString();
      const { data: lv } = await supabase
        .from("matches")
        .select("*, home_team:home_team_id(*), away_team:away_team_id(*), competition:competition_id(*)")
        .neq("status", "final")
        .gte("kickoff_at", since)
        .order("kickoff_at", { ascending: true });
      setLive(((lv as Match[]) || []).filter((x) => isLiveNow(x)));

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
    <main className="app-shell bg-cream text-white min-h-screen">
      <div className="px-5 pt-12 pb-28">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-white/55 text-sm">Buenas, {name}</p>
            <h1 className="display text-4xl">Hoy</h1>
          </div>
          <NotificationBell />
        </div>

        {/* EN VIVO */}
        {live.length > 0 && (
          <div className="mt-5 space-y-2">
            {live.map((m) => {
              const st = streamingFor(m);
              return (
                <a key={m.id} href={`/partidos/${m.id}`}
                   className="block bg-red-600 text-white rounded-2xl p-4 active:scale-[0.99] transition">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold flex items-center gap-1.5">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-card animate-pulse" /> EN VIVO AHORA
                    </span>
                    <span className="text-[11px] text-white/70">{m.competition?.short_name}</span>
                  </div>
                  <div className="mt-2 font-bold leading-tight">
                    {m.home_team?.name} <span className="text-white/60">vs</span> {m.away_team?.name}
                  </div>
                  <div className="mt-1 text-[12px] text-white/85 font-semibold">
                    {st.url ? "Ver en vivo ↗" : st.platform ? `Por ${st.platform} ›` : "Ver detalle ›"}
                  </div>
                </a>
              );
            })}
          </div>
        )}

        {/* followed chips */}
        {followed.length > 0 && (
          <div className="flex gap-4 mt-5 overflow-x-auto no-scrollbar">
            {followed.map((t) => (
              <Link key={t.id} href={`/equipos/${t.slug}`} className="flex flex-col items-center gap-1 shrink-0">
                <Badge label={t.short_name || t.name.slice(0, 3)} color={t.color} size={52} />
                <span className="text-xs text-white/65">{t.name.replace("Los ", "")}</span>
              </Link>
            ))}
          </div>
        )}

        {/* match result */}
        {match && <MatchResult match={match} />}

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
                  isActive ? "bg-brand text-white" : "bg-card text-white/65"
                }`}
              >
                {label}
                {count > 0 && (
                  <span className={`ml-1.5 ${isActive ? "text-white/70" : "text-white/45"}`}>{count}</span>
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

        {loading && <p className="text-center text-white/50 mt-10">Cargando tu feed…</p>}
        {!loading && visibleArticles.length === 0 && (
          <div className="bg-card border border-white/5 rounded-2xl p-5 mt-4 text-center text-white/65">
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
    <div className="bg-card border border-white/5 rounded-2xl mt-5 overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-4">
        <span className="text-xs tracking-[0.15em] text-white/55 font-semibold">
          {withRound(match.competition?.short_name || "PARTIDO", match.round)}
        </span>
        <span className="text-[11px] bg-white/[0.06] rounded px-2 py-0.5 font-semibold text-white/70">
          {match.status === "final" ? "FINAL" : ""}
        </span>
      </div>
      <div className="flex items-center justify-between px-4 py-4">
        <Link href={h?.slug ? `/equipos/${h.slug}` : "#"} className="flex items-center gap-2">
          <Badge label={h?.short_name || "?"} color={h?.color} size={34} />
          <span className="font-bold">{h?.name}</span>
        </Link>
        <span className="display text-3xl">{match.home_score} – {match.away_score}</span>
        <Link href={a?.slug ? `/equipos/${a.slug}` : "#"} className="flex items-center gap-2">
          <span className="font-bold">{a?.name}</span>
          <Badge label={a?.short_name || "?"} color={a?.color} size={34} />
        </Link>
      </div>
      <div className="flex items-center justify-between px-4 py-3 border-t border-white/10">
        <span className="text-sm text-white/55">
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
    <a href={a.url || "#"} target="_blank" rel="noopener noreferrer" className="block bg-card border border-white/5 rounded-2xl overflow-hidden">
      <div className="flex">
        <div className="flex-1 p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-5 h-5 rounded-full bg-brand grid place-items-center text-[10px] text-white font-bold">
              {(a.author || a.source?.name || "R")[0]}
            </span>
            <span className="text-sm font-semibold">{a.author || a.source?.name}</span>
            {a.category && CATEGORY_META[a.category] && (
              <span className="ml-auto text-[10px] font-semibold bg-white/[0.06] text-white/65 rounded-full px-2 py-0.5">
                {CATEGORY_META[a.category].short}
              </span>
            )}
          </div>
          <p className="font-bold leading-snug">{a.title}</p>
          <p className="text-xs text-white/55 mt-2">
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
