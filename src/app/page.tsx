import Link from "next/link";
import { RefCapture } from "@/components/RefCapture";

export default function Landing() {
  return (
    <main className="app-shell bg-ink text-white flex flex-col">
      <RefCapture />
      <div className="relative flex-1 px-6 pt-16 pb-10 overflow-hidden">
        {/* hero glow / ambiente estadio */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[520px] h-[420px] rounded-full bg-brand/25 blur-[90px]" />
          <div className="absolute top-1/3 -right-24 w-[280px] h-[280px] rounded-full bg-brand/10 blur-[80px]" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-ink/40 to-ink" />
        </div>

        <div className="flex items-center gap-3 mt-8">
          <div className="w-12 h-12 rounded-2xl bg-brand grid place-items-center text-2xl font-extrabold shadow-lg shadow-brand/40">
            T
          </div>
          <span className="text-2xl font-extrabold tracking-wide">TRIBUNA</span>
        </div>

        <p className="mt-24 text-brand text-xs font-bold tracking-[0.2em]">
          RUGBY · CHILE
        </p>
        <h1 className="display text-5xl leading-[1.05] mt-3">
          Tu pasión.
          <br />
          Tu <span className="text-brand">rugby.</span>
        </h1>
        <p className="mt-5 text-white/70 leading-relaxed max-w-[20rem]">
          Seguí a tus selecciones, clubes y jugadores. Resultados, noticias,
          partidos en vivo y comunidad, curados para vos.
        </p>

        <div className="mt-10 space-y-3">
          <Link
            href="/onboarding"
            className="flex items-center justify-center gap-2 w-full text-center bg-brand hover:bg-brand-600 transition rounded-2xl py-4 font-bold tracking-wide shadow-lg shadow-brand/30"
          >
            ARMAR MI FEED <span aria-hidden>→</span>
          </Link>
          <Link
            href="/equipos"
            className="block w-full text-center border border-white/15 hover:bg-white/5 transition rounded-2xl py-4 font-bold tracking-wide"
          >
            Ver equipos
          </Link>
          <p className="text-center text-white/55 pt-2 text-sm">
            ¿Ya tenés cuenta?{" "}
            <Link href="/login" className="text-white font-semibold">
              Iniciar sesión
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
