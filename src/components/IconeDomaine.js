import {
  Laptop, Stethoscope, Cog, Sigma, ChartColumn, Sprout, BookOpen,
  Scale, Shield, Palette, Sparkles,
} from "lucide-react";

const ICONES = {
  info: Laptop,
  sante: Stethoscope,
  inge: Cog,
  maths: Sigma,
  eco: ChartColumn,
  agro: Sprout,
  enseignement: BookOpen,
  droit: Scale,
  defense: Shield,
  arts: Palette,
  autre: Sparkles,
};

export default function IconeDomaine({ domaine, taille = 20 }) {
  const Icone = ICONES[domaine] ?? Sparkles;
  return <Icone size={taille} strokeWidth={1.8} aria-hidden />;
}
