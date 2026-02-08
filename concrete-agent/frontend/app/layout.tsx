import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "STAVAGENT — Inteligentní analýza stavební dokumentace",
  description:
    "AI asistent pro české stavebnictví. Okamžitá kontrola souladu s ČSN, analýza PDF výkresů a expertní technické zprávy.",
  keywords: [
    "stavební dokumentace",
    "ČSN normy",
    "AI stavebnictví",
    "analýza výkresů",
    "STAVAGENT",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="cs">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
