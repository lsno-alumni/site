import {
  Laptop, Stethoscope, Cog, Sigma, ChartColumn, Sprout, BookOpen,
  Scale, Shield, Palette, Sparkles, GraduationCap,
  Briefcase, Building2, Plane, ChartPie,
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
  commerce: Briefcase,
  archi: Building2,
  aero: Plane,
  stats: ChartPie,
  eleve: GraduationCap,
  autre: Sparkles,
};

export default function IconeDomaine({ domaine, taille = 20 }) {
  const Icone = ICONES[domaine] ?? Sparkles;
  return <Icone size={taille} strokeWidth={1.8} aria-hidden />;
}
