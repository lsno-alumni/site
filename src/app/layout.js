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
    "LSNO Amicale (LSNO Alumni) : retrouve les anciens du Lycée Scientifique National de Ouagadougou par domaine, promotion ou pays. Parcours, conseils aux cadets et mise en réseau. Travail · Excellence · Discipline.",
  keywords: [
    "LSNO", "LSNO Amicale", "LSNO Alumni", "amicale LSNO", "anciens LSNO",
    "Lycée Scientifique National de Ouagadougou", "lycée scientifique Ouagadougou",
    "lycée scientifique Burkina Faso", "réseau des anciens LSNO",
  ],
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

// Données structurées : aide Google à relier le site à ses noms alternatifs
// (LSNO, LSNO Alumni, le nom complet du lycée…) quelle que soit la recherche.
const ORGANISATION = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "LSNO Amicale",
  alternateName: [
    "LSNO Alumni",
    "Amicale du LSNO",
    "Réseau des anciens du LSNO",
    "Anciens du Lycée Scientifique National de Ouagadougou",
  ],
  url: "https://lsno-alumni.vercel.app",
  logo: "https://lsno-alumni.vercel.app/img/logo.jpg",
  email: "lsno.alumni@gmail.com",
  description:
    "Le réseau des ancien·nes du Lycée Scientifique National de Ouagadougou (Burkina Faso).",
  areaServed: "Burkina Faso",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body className={`${titres.variable} ${ui.variable}`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANISATION) }}
        />
        {children}
      </body>
    </html>
  );
}
