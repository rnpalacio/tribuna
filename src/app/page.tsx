import Link from "next/link";

export default function Landing() {
  return (
    <main className="app-shell bg-ink text-white flex flex-col">
      <div className="relative flex-1 px-6 pt-16 pb-10 overflow-hidden">
        {/* decorative rings */}
        <div className="pointer-events-none absolute -top-20 right-[-60px] w-[320px] h-[320px] rounded-full border border-brand/25" />
        <div className="pointer-events-none absolute top-10 right-10 w-[180px] h-[180px] rounded-full border border-white/10" />

        <div className="flex items-center gap-3 mt-8">
          <div className="w-12 h-12 rounded-2xl bg-brand grid place-items-center text-2xl font-extrabold shadow-lg shadow-brand/30">
            T
          </div>
          <span className="text-2xl font-extrabold tracking-wide">TRIBUNA</span>
        </div>

        <p className="mt-24 text-brand text-xs font-bold tracking-[0.2em]">
          RUGBY · CHILE
        </p>
        <h1 className="display text-5xl leading-[1.05] mt-3">
          Todo tu rugby.
          <br />
          En un solo lugar.
        </h1>
        <p className="mt-5 text-white/70 leading-relaxed max-w-[20rem]">
          Seguí a tus selecciones, clubes y jugadores. Resultados, noticias y
          comunidad, curados para vos.
        </p>

        <div className="mt-10">
          <Link
            href="/onboarding"
            className="block w-full text-center bg-brand hover:bg-brand-600 transition rounded-2xl py-4 font-bold tracking-wide shadow-lg shadow-brand/30"
          >
            ARMAR MI FEED
          </Link>
          <p className="text-center text-white/55 mt-5 text-sm">
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
