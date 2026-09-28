import type { Metadata } from "next";
import { Manrope, Playfair_Display } from "next/font/google";

import { CANONICAL_SITE_URL } from "@/lib/site-url";

import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap",
  variable: "--font-manrope-next",
});

const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  weight: ["600", "700"],
  display: "swap",
  variable: "--font-playfair-next",
});

const SITE_NAME = "Il Tecnico di Fiducia";

const SITE_DESCRIPTION =
  "Trova professionisti qualificati in Italia, confronta profili, competenze e recensioni e contatta il tecnico più adatto alle tue esigenze.";

export const metadata: Metadata = {
  metadataBase: new URL(CANONICAL_SITE_URL),

  title: "Il Tecnico di Fiducia | Trova professionisti qualificati",

  description: SITE_DESCRIPTION,

  applicationName: SITE_NAME,

  alternates: {
    canonical: "/",
  },

  openGraph: {
    type: "website",
    locale: "it_IT",
    url: "/",
    siteName: SITE_NAME,
    title: "Il Tecnico di Fiducia | Trova professionisti qualificati",
    description: SITE_DESCRIPTION,
    images: [
      {
        url: "/img/logo-mark.png",
        alt: "Il Tecnico di Fiducia",
      },
    ],
  },

  twitter: {
    card: "summary",
    title: "Il Tecnico di Fiducia | Trova professionisti qualificati",
    description: SITE_DESCRIPTION,
    images: ["/img/logo-mark.png"],
  },

  manifest: "/manifest.webmanifest",

  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="it"
      className={`${manrope.variable} ${playfairDisplay.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-on-background font-body-md">
        {children}
      </body>
    </html>
  );
}
