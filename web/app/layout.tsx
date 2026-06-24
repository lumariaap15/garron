import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Inter como cuerpo limpio y geométrico, cargado por next/font (self-hosted, sin CLS).
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Garrón — Derechos del consumidor, claros",
  description:
    "La guía clara cuando compraste, salió mal y toca reclamar. Cada respuesta cita la Ley 24.240.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={inter.variable}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
