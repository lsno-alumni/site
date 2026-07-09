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
  title: "LSNO Alumni — Le réseau des anciens du Lycée Scientifique National de Ouagadougou",
  description:
    "Retrouve les anciens du LSNO par domaine, promotion ou pays. Travail · Excellence · Discipline.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body className={`${titres.variable} ${ui.variable}`}>{children}</body>
    </html>
  );
}
