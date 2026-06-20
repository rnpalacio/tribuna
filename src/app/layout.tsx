import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tribuna — Tu rugby, en un solo lugar",
  description:
    "Tribuna: el feed del hincha de rugby. Seguí selecciones, clubes y jugadores del rugby chileno.",
};

export const viewport: Viewport = {
  themeColor: "#EC5A2A",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
