# Tribuna 🏉

App del hincha de rugby chileno. Indexa y cura contenido (noticias, resultados,
partidos, comunidad) para fans de Los Cóndores, Selknam y el Súper Rugby Américas.

Construida sobre **Next.js 14 (App Router) + Tailwind + Supabase (Postgres, Auth, Edge Functions)**.

---

## 1. Correr en local

```bash
cd tribuna-app
npm install
npm run dev
# http://localhost:3000
```

Las variables de entorno ya están en `.env.local` (apuntan al proyecto Supabase `tribuna`):

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
    comunidad/            Encuesta semanal, ranking de predictores, Crear mi XV
    perfil/               Intereses + privacidad (Ley 21.719) + sesión
  components/             Badge, BottomNav, PollCard
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
Noticias RSS** filtrado a rugby chileno, porque los feeds RSS de rugbychile.cl
están deshabilitados. Guarda el medio original de cada nota (La Tercera, Rugby
Chile, Rugbiers.cl, etc.).

Corre automáticamente **cada 2 horas** vía `pg_cron` (job `ingest-feeds-2h`).
Para disparar manualmente desde el SQL Editor de Supabase:

```sql
select net.http_post(
  url := 'https://tumwbgxyvfdtuzcqzset.supabase.co/functions/v1/ingest-feeds',
  headers := jsonb_build_object('Content-Type','application/json',
    'Authorization','Bearer <ANON_KEY_LEGACY>'),
  body := '{}'::jsonb
);
```

Para agregar fuentes nuevas, insertá filas en `sources` (kind='rss', feed_url=...).

## 5. Desplegar a producción (Vercel + dominio tribuna.fun)

1. Subí esta carpeta `tribuna-app/` a un repo de GitHub.
2. En vercel.com → New Project → importá el repo.
3. Cargá las dos variables de entorno (`NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`) en Project Settings → Environment Variables.
4. Deploy. Luego en Settings → Domains, agregá `tribuna.fun` y `www.tribuna.fun`.
5. **Importante (Supabase Auth):** en el dashboard de Supabase →
   Authentication → URL Configuration, poné:
   - Site URL: `https://tribuna.fun`
   - Redirect URLs: `https://tribuna.fun/auth/callback`
   Sin esto, los enlaces mágicos de login no redirigen bien en producción.

## 6. Pendientes / próximos pasos sugeridos

- Imágenes en noticias (Google News RSS no las trae; se puede hacer scraping del
  og:image de cada artículo en la edge function).
- Resultados/fixtures automáticos del Súper Rugby Américas (hoy cargados a mano).
- Sistema de puntos real para el ranking de predictores (resolver predicciones al
  cerrar cada partido).
- Funcionalidad "Crear mi XV".
- Notificaciones push.
