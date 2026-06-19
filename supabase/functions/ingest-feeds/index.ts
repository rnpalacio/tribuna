// Supabase Edge Function: ingest-feeds
// Ingesta de noticias de rugby chileno desde dos tipos de fuente:
//   - kind 'rss'  : feeds RSS (ej. Google Noticias) -> cobertura amplia, sin imagen
//   - kind 'html' : scrape de la home de rugbychile.cl -> notas locales CON imagen
// Inserta en `articles` (dedup por url) y etiqueta los equipos mencionados.
// Corre con la service role key para saltar RLS en la escritura.

import { createClient } from "jsr:@supabase/supabase-js@2";

type Source = { id: string; name: string; kind: string; url: string | null; feed_url: string | null };
type Team = { id: string; name: string; short_name: string | null };
type Item = {
  title: string;
  url: string;
  summary: string;
  image: string | null;
  published_at: string | null;
  publisher: string | null;
};

const SKIP = /ticketmaster|puntoticket|passline|entradas|venta de tickets/i;

const decode = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;|&#8217;|&#8216;/g, "'")
    .replace(/&#8220;|&#8221;|&laquo;|&raquo;/g, '"')
    .replace(/&#8211;|&#8212;/g, "–")
    .replace(/&nbsp;/g, " ")
    .trim();

const strip = (s: string) => decode(s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " "));

function tag(xml: string, name: string): string | null {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m ? m[1] : null;
}

function rssImage(itemXml: string): string | null {
  const enclosure = itemXml.match(/<enclosure[^>]*url="([^"]+)"[^>]*>/i);
  if (enclosure) return enclosure[1];
  const media = itemXml.match(/<media:content[^>]*url="([^"]+)"[^>]*>/i);
  if (media) return media[1];
  const content = tag(itemXml, "content:encoded") || tag(itemXml, "description") || "";
  const img = content.match(/<img[^>]*src="([^"]+)"/i);
  return img ? img[1] : null;
}

// --- RSS (Google Noticias y feeds estándar) ---
function parseRss(xml: string): Item[] {
  const items: Item[] = [];
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) || xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];
  for (const b of blocks) {
    let title = strip(tag(b, "title") || "");
    let url = decode(tag(b, "link") || "");
    if (!url) {
      const alt = b.match(/<link[^>]*href="([^"]+)"/i);
      url = alt ? alt[1] : "";
    }
    if (!title || !url) continue;
    const publisher = strip(tag(b, "source") || "") || null;
    if (publisher && title.endsWith(" - " + publisher)) {
      title = title.slice(0, -(publisher.length + 3)).trim();
    }
    if (SKIP.test(title) || (publisher && SKIP.test(publisher))) continue;
    const pub = tag(b, "pubDate") || tag(b, "published") || tag(b, "updated");
    items.push({
      title,
      url,
      summary: strip(tag(b, "description") || tag(b, "summary") || "").slice(0, 300),
      image: rssImage(b),
      published_at: pub ? new Date(decode(pub)).toISOString() : null,
      publisher,
    });
  }
  return items;
}

// --- Scrape de la home de rugbychile.cl (WordPress) ---
function parseRugbyChileHtml(html: string, publisher: string): Item[] {
  const items: Item[] = [];
  const seen = new Set<string>();
  const blocks = html.match(/<article[\s\S]*?<\/article>/gi) || [];
  for (const b of blocks) {
    const linkM = b.match(/<a[^>]*href="(https:\/\/www\.rugbychile\.cl\/20\d\d\/[^"]+)"[^>]*title="([^"]*)"/i);
    if (!linkM) continue;
    const url = linkM[1];
    if (seen.has(url)) continue;
    seen.add(url);
    const title = decode(linkM[2]);
    if (!title || SKIP.test(title)) continue;
    const imgM = b.match(/<img[^>]*src="(https:\/\/www\.rugbychile\.cl\/wp-content\/uploads\/[^"]+)"/i);
    const excM = b.match(/<div class="mh-excerpt">([\s\S]*?)<\/div>/i);
    const dateM = url.match(/\/(20\d\d)\/(\d\d)\/(\d\d)\//);
    items.push({
      title,
      url,
      summary: excM ? strip(excM[1]).slice(0, 300) : "",
      image: imgM ? imgM[1] : null,
      published_at: dateM ? new Date(`${dateM[1]}-${dateM[2]}-${dateM[3]}T12:00:00-04:00`).toISOString() : null,
      publisher,
    });
  }
  return items;
}

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: sources } = await supabase
    .from("sources")
    .select("id, name, kind, url, feed_url")
    .eq("active", true)
    .in("kind", ["rss", "html"]);

  const { data: teams } = await supabase.from("teams").select("id, name, short_name");
  const teamList = (teams as Team[]) || [];

  let inserted = 0;
  const errors: string[] = [];

  for (const src of (sources as Source[]) || []) {
    const target = src.kind === "html" ? src.url : src.feed_url;
    if (!target) continue;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 25000);
      const res = await fetch(target, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) TribunaBot/1.0" },
        redirect: "follow",
        signal: ctrl.signal,
      });
      clearTimeout(t);
      if (!res.ok) {
        errors.push(`${src.name}: HTTP ${res.status}`);
        continue;
      }
      const body = await res.text();
      const items =
        src.kind === "html"
          ? parseRugbyChileHtml(body, src.name)
          : parseRss(body).slice(0, 40);

      for (const it of items) {
        const { data: art, error } = await supabase
          .from("articles")
          .upsert(
            {
              source_id: src.id,
              title: it.title,
              summary: it.summary,
              url: it.url,
              image_url: it.image,
              author: it.publisher,
              published_at: it.published_at,
            },
            { onConflict: "url", ignoreDuplicates: true }
          )
          .select("id")
          .maybeSingle();

        if (error || !art) continue;
        inserted++;

        const hay = (it.title + " " + it.summary).toLowerCase();
        const matches = teamList.filter(
          (tm) =>
            hay.includes(tm.name.toLowerCase()) ||
            hay.includes(tm.name.replace(/^Los\s+/i, "").toLowerCase())
        );
        if (matches.length) {
          await supabase
            .from("article_teams")
            .upsert(
              matches.map((tm) => ({ article_id: art.id, team_id: tm.id })),
              { ignoreDuplicates: true }
            );
        }
      }
    } catch (e) {
      errors.push(`${src.name}: ${String(e)}`);
    }
  }

  return new Response(JSON.stringify({ inserted, errors }), {
    headers: { "Content-Type": "application/json" },
  });
});
