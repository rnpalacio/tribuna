# Tribuna 🏉

App del hincha de rugby chileno. Indexa y cura contenido (noticias, resultados,
partidos, comunidad) para fans de Los Cóndores, Selknam y el Súper Rugby Américas.

Construida sobre **Next.js 14 (App Router) + Tailwind + Supabase (Postgres, Auth, Edge Functions)**.

---

## 1. Correr en local

```bash
npm install
npm run dev
# http://localhost:3000
```

Variables de entorno (`.env.local`, apuntan al proyecto Supabase `tribuna`):

```
NEXT_PUBLIC_SUPABASE_URL=https://tumwbgxyvfdtuzcqzset.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_8RahcS7EmgkAiqoAXhAJEA_E9xkMd8W
```

## 2. Estructura

```
src/
  app/
    page.tsx              Landing (hero "Todo tu rugby")
    onboarding/           4 pasos: selecciones · clubes · jugadores · privacidad
    login/                Login por enlace mágico (sin contraseñas)
    auth/callback/        Intercambio de código OAuth
    feed/                 Pestaña "Hoy": equipos seguidos, resultado, noticias, predicción
    partidos/             Fixtures + resultados + tabla de posiciones
    equipos/              Directorio y ficha de equipos
    comunidad/            Encuesta semanal, ranking de predictores, Crear mi XV
    notificaciones/       Centro de notificaciones
    perfil/               Intereses + privacidad (Ley 21.719) + sesión
    admin/                Merch y programas de afiliados
  components/             Badge, BottomNav, PollCard, MatchPrediction, etc.
  lib/supabase/           Clientes browser + server (SSR)
supabase/functions/
  ingest-feeds/           Edge function: ingesta de noticias (Google News RSS)
```

## 3. Base de datos (ya creada en Supabase)

Tablas: `competitions, teams, players, matches, standings, sources, articles,
article_teams, article_players, polls, poll_options, poll_votes, profiles,
follows, public_leaderboard`. Row Level Security activado: contenido público de
solo lectura; datos de usuario (perfil, follows, votos) privados por usuario.

## 4. Ingesta de contenido

`ingest-feeds` lee las fuentes RSS activas de la tabla `sources` y carga noticias
a `articles` (dedup por URL, etiqueta equipos mencionados). Hoy usa **Google
Noticias RSS** filtrado a rugby chileno. Corre automáticamente **cada 2 horas**
vía `pg_cron` (job `ingest-feeds-2h`).

Para agregar fuentes nuevas, insertá filas en `sources` (kind='rss', feed_url=...).

## 5. Producción

Deploy en Vercel (proyecto conectado a este repo) → dominio `tribuna.fun`.
Variables de entorno en Vercel Project Settings → Environment Variables.
Supabase Auth → URL Configuration: Site URL `https://tribuna.fun`, Redirect
`https://tribuna.fun/auth/callback`.
