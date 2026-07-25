import Link from "next/link";
import { RefCapture } from "@/components/RefCapture";

export default function Landing() {
  return (
    <main className="app-shell bg-ink text-white flex flex-col">
      <RefCapture />
      <div className="relative flex-1 px-6 pt-14 pb-10 overflow-hidden">
        {/* fondo: pelota + partículas naranjas */}
        <div
          className="pointer-events-none absolute inset-0 -z-10 bg-cover bg-center"
          style={{ backgroundImage: "url(/portada.jpg)" }}
        />
        <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-ink/30 via-transparent to-ink" />

        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-brand grid place-items-center text-2xl font-bold shadow-lg shadow-brand/40">
            T
          </div>
          <span className="text-2xl font-bold tracking-[0.08em]">TRIBUNA</span>
        </div>

        <p className="mt-28 text-brand text-xs font-bold tracking-[0.25em]">
          RUGBY · CHILE
        </p>
        <h1 className="display text-[2.75rem] leading-[1.08] mt-3">
          Todo tu rugby.
          <br />
          En un solo lugar.
        </h1>
        <p className="mt-5 text-white/70 leading-relaxed max-w-[20rem]">
          Seguí a tus selecciones, clubes y jugadores. Resultados, noticias y
          comunidad, curados para vos.
        </p>

        <div className="mt-10 space-y-3">
          <Link
            href="/onboarding"
            className="block w-full text-center bg-brand hover:bg-brand-600 transition rounded-xl py-4 font-bold tracking-[0.06em] shadow-lg shadow-brand/30"
          >
            ARMAR MI FEED
          </Link>
          <p className="text-center text-white/55 pt-2 text-sm">
            ¿Ya tenés cuenta?{" "}
            <Link href="/login" className="text-brand font-semibold">
              Iniciar sesión
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
