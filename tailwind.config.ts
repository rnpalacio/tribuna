import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#FF5A1F",
          400: "#FF7A33",
          600: "#E04A12",
        },
        ink: "#111111",
        cream: "#111111",
        card: "#1A1A1A",
        surface2: "#242424",
        muted: "#A1A1A1",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
