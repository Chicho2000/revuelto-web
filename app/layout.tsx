import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import "./public.css";

const ohnoSoftie = localFont({
  src: "../src/assets/fonts/fonnts.com-Ohno_Softie_Variable.otf",
  variable: "--font-ohno-softie",
  display: "swap",
});

const revueltoRegular = localFont({
  src: "../src/assets/fonts/Revuelto-Regular.ttf",
  variable: "--font-revuelto",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Revuelto | Fresco, nutritivo, resuelto",
  description: "Bowls de huevos revueltos hechos para resolver tu día.",
  icons: {
    icon: [{ url: "/brand/logos/logo-egg-rev.svg", type: "image/svg+xml" }],
    shortcut: ["/brand/logos/logo-egg-rev.svg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${ohnoSoftie.variable} ${revueltoRegular.variable}`}>
      <body>{children}</body>
    </html>
  );
}
