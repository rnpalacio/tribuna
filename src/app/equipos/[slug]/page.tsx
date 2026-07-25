import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/Badge";
import { BottomNav } from "@/components/BottomNav";
import { FollowButton } from "@/components/FollowButton";
import { applyAffiliate, programLookup, type AffiliateProgram } from "@/lib/affiliate";
import type { Team, Match, Player, Standing } from "@/lib/types";

export const dynamic = "force-dynamic";

type Merch = {
  id: string;
  title: string;
  image_url: string | null;
  price: string | null;
  currency: string | null;
  url: string;
  vendor: string | null;
};

export default async function TeamPage({ params }: { params: { slug: string } }) {
  const supabase = await createClient();

  const { data: teamData } = await supabase
    .from("teams")
    .select("*, competition:competition_id(*)")
    .eq("slug", params.slug)
    .maybeSingle();

  const team = teamData as (Team & { competition?: { id: string; name: string; short_name: string | null } | null }) | null;
  if (!team) notFound();

  const now = new Date().toISOString();

  const [{ data: stand }, { data: upcomingData }, { data: recentData }, { data: playersData }, { data: merchData }, { data: programData }] =
    await Promise.all([
      supabase
        .from("standings")
        .select("*, competition:competition_id(*)")
        .eq("team_id", team.id)
        .order("updated_at", { ascending: false })
        .limit(1),
      supabase
        .from("matches")
        .select("*, home_team:home_team_id(*), away_team:away_team_id(*), competition:competition_id(*)")
        .or(`home_team_id.eq.${team.id},away_team_id.eq.${team.id}`)
        .neq("status", "final")
        .gte("kickoff_at", now)
        .order("kickoff_at", { ascending: true })
        .limit(5),
      supabase
        .from("matches")
        .select("*, home_team:home_team_id(*), away_team:away_team_id(*), competition:competition_id(*)")
        .or(`home_team_id.eq.${team.id},away_team_id.eq.${team.id}`)
        .eq("status", "final")
        .order("kickoff_at", { ascending: false })
        .limit(5),
      supabase
        .from("players")
        .select("*")
        .eq("team_id", team.id)
        .order("name", { ascending: true }),
      supabase
        .from("merch_products")
        .select("*")
        .eq("team_id", team.id)
        .eq("active", true)
        .order("sort", { ascending: true }),
      supabase
        .from("affiliate_programs")
        .select("*")
        .eq("active", true),
    ]);

  const standing = (stand?.[0] as Standing & { competition?: { name: string; short_name: string | null } | null }) || null;
  const upcoming = (upcomingData as Match[]) || [];
  const recent = (recentData as Match[]) || [];
  const players = (playersData as Player[]) || [];
  const merch = (merchData as Merch[]) || [];
  const findProgram = programLookup((programData as AffiliateProgram[]) || []);

  const kindLabel = team.kind === "seleccion" ? "Selección" : "Club";

  return (
    <main className="app-shell bg-cream text-white min-h-screen">
      <div className="px-5 pt-12 pb-28">
        <Link href="/partidos" className="text-brand font-semibold text-sm">‹ Volver</Link>

        {/* Cabecera */}
        <div className="bg-card border border-white/5 rounded-2xl p-6 mt-4 flex items-center gap-4">
          <Badge label={team.short_name || team.name.slice(0, 3)} color={team.color} size={64} />
          <div className="min-w-0">
            <h1 className="display text-3xl leading-tight">{team.name}</h1>
            {team.nickname && <p className="text-brand font-semibold text-sm mt-0.5">{team.nickname}</p>}
            <p className="text-sm text-white/55 mt-1">
              {[kindLabel, team.country].filter(Boolean).join(" · ")}
            </p>
            {team.competition?.name && (
              <p className="text-xs text-white/50 mt-0.5">{team.competition.name}</p>
            )}
          </div>
        </div>

        <div className="mt-3"><FollowButton teamId={team.id} /></div>

        {/* Stats rápidas */}
        {(team.world_ranking || standing?.position || team.founded_year || team.home_venue) && (
          <div className="grid grid-cols-3 gap-3 mt-4">
            {team.world_ranking != null && (
              <Stat label="Ranking mundial" value={`#${team.world_ranking}`} />
            )}
            {standing?.position != null && (
              <Stat
                label={standing.competition?.short_name || "En tabla"}
                value={`#${standing.position}`}
              />
            )}
            {team.founded_year != null && <Stat label="Fundado" value={`${team.founded_year}`} />}
            {team.home_venue && <Stat label="Estadio" value={team.home_venue} />}
          </div>
        )}

        {/* Descripción */}
        {team.description && (
          <Section title="SOBRE EL EQUIPO">
            <p className="text-sm leading-relaxed text-white/80">{team.description}</p>
          </Section>
        )}

        {/* Enlaces oficiales */}
        {(team.website_url || team.instagram_url || team.x_url || team.youtube_url) && (
          <div className="flex flex-wrap gap-2 mt-4">
            {team.website_url && <LinkChip href={team.website_url} label="Web oficial ↗" />}
            {team.instagram_url && <LinkChip href={team.instagram_url} label="Instagram ↗" />}
            {team.x_url && <LinkChip href={team.x_url} label="X ↗" />}
            {team.youtube_url && <LinkChip href={team.youtube_url} label="YouTube ↗" />}
          </div>
        )}

        {/* Próximos partidos */}
        <Section title="PRÓXIMOS PARTIDOS">
          {upcoming.length ? (
            <div className="space-y-2">
              {upcoming.map((m) => <MatchRow key={m.id} m={m} teamId={team.id} />)}
            </div>
          ) : (
            <Empty>Sin próximos partidos cargados.</Empty>
          )}
        </Section>

        {/* Resultados recientes */}
        {recent.length > 0 && (
          <Section title="RESULTADOS RECIENTES">
            <div className="space-y-2">
              {recent.map((m) => <MatchRow key={m.id} m={m} teamId={team.id} />)}
            </div>
          </Section>
        )}

        {/* Jugadores */}
        {players.length > 0 && (
          <Section title={`JUGADORES (${players.length})`}>
            <div className="grid grid-cols-2 gap-2">
              {players.map((p) => (
                <div key={p.id} className="bg-card border border-white/5 rounded-xl p-3 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-brand/10 grid place-items-center text-xs font-bold text-brand shrink-0">
                    {p.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{p.name}</p>
                    {p.position && <p className="text-[11px] text-white/50">{p.position}</p>}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Merchandising */}
        <Section title="MERCHANDISING OFICIAL">
          {merch.length ? (
            <div className="grid grid-cols-2 gap-3">
              {merch.map((p) => (
                <a
                  key={p.id}
                  href={applyAffiliate(p.url, findProgram(p.vendor))}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  className="block bg-card border border-white/5 rounded-2xl overflow-hidden"
                >
                  {p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image_url} alt={p.title} className="w-full h-32 object-cover" />
                  ) : (
                    <div className="w-full h-32 bg-white/[0.06] grid place-items-center text-white/40 text-sm">Sin imagen</div>
                  )}
                  <div className="p-3">
                    <p className="text-sm font-semibold leading-snug line-clamp-2">{p.title}</p>
                    {p.price && <p className="text-sm font-bold text-brand mt-1">{p.price}</p>}
                    <p className="text-[11px] text-white/50 mt-1">{p.vendor ? `${p.vendor} ↗` : "Comprar ↗"}</p>
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <Empty>Pronto vas a poder comprar productos oficiales desde acá.</Empty>
          )}
        </Section>
      </div>
      <BottomNav />
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card border border-white/5 rounded-2xl p-3 text-center">
      <div className="display text-2xl text-brand leading-none">{value}</div>
      <div className="text-[11px] text-white/55 mt-1 leading-tight">{label}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <h2 className="text-xs tracking-[0.15em] text-white/55 font-semibold mb-3">{title}</h2>
      {children}
    </div>
  );
}

function LinkChip({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="bg-card rounded-full px-4 py-2 text-sm font-semibold text-brand"
    >
      {label}
    </a>
  );
}

function MatchRow({ m, teamId }: { m: Match; teamId: string }) {
  const d = m.kickoff_at ? new Date(m.kickoff_at) : null;
  const rival = m.home_team_id === teamId ? m.away_team : m.home_team;
  const isHome = m.home_team_id === teamId;
  const isFinal = m.status === "final";
  return (
    <Link
      href={`/partidos/${m.id}`}
      className="bg-card border border-white/5 rounded-2xl p-4 flex items-center gap-3 active:scale-[0.99] transition"
    >
      <div className="text-center w-12 shrink-0">
        {d ? (
          <>
            <div className="display text-2xl leading-none">{d.getDate().toString().padStart(2, "0")}</div>
            <div className="text-[11px] text-white/55 uppercase">{d.toLocaleString("es-CL", { month: "short" })}</div>
          </>
        ) : <div className="text-xs text-white/50">—</div>}
      </div>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Badge label={rival?.short_name || "?"} color={rival?.color} size={28} />
        <span className="text-sm font-semibold truncate">
          <span className="text-white/50">{isHome ? "vs " : "@ "}</span>{rival?.name}
        </span>
      </div>
      <div className="text-right shrink-0">
        {isFinal ? (
          <span className="display text-lg">{m.home_score}–{m.away_score}</span>
        ) : (
          <span className="text-brand font-bold text-sm">
            {d ? d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }) : "VS"}
          </span>
        )}
        <div className="text-[11px] text-white/50">{m.competition?.short_name}</div>
      </div>
    </Link>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="bg-card border border-white/5 rounded-2xl p-5 text-center text-white/65 text-sm">{children}</div>;
}
