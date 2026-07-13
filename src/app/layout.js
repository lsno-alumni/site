import { Fraunces, Space_Grotesk } from "next/font/google";
import "./globals.css";
import "./ecrans.css";

const titres = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["500", "600"],
  variable: "--font-titres",
});

const ui = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-ui",
});

export const metadata = {
  metadataBase: new URL("https://lsno-alumni.vercel.app"),
  title: "LSNO Amicale — Le réseau des anciens du Lycée Scientifique National de Ouagadougou",
  description:
    "Retrouve les anciens du Lycée Scientifique National de Ouagadougou par domaine, promotion ou pays. Parcours, conseils aux cadets et mise en réseau. Travail · Excellence · Discipline.",
  openGraph: {
    title: "LSNO Amicale — Le réseau des anciens du LSNO",
    description:
      "Retrouve les anciens du Lycée Scientifique National de Ouagadougou par domaine, promotion ou pays.",
    url: "/",
    siteName: "LSNO Amicale",
    locale: "fr_FR",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body className={`${titres.variable} ${ui.variable}`}>{children}</body>
    </html>
  );
}
