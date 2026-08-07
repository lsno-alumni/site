// recherche qui pardonne : minuscules ET sans accents (« economie » trouve « Économie »)
export const plat = (s) => s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

// entoure la portion d'un texte qui correspond au terme recherché — la
// comparaison se fait sur la version « à plat » (sans accents/majuscules)
// mais le découpage sur le texte ORIGINAL, les deux ayant la même longueur
// (un accent se réduit à sa lettre de base, jamais à plus d'un caractère)
export default function Surligne({ texte, terme }) {
  if (!terme || !texte) return texte;
  const t = plat(texte);
  const q = plat(terme);
  const i = t.indexOf(q);
  if (i === -1) return texte;
  return (
    <>
      {texte.slice(0, i)}
      <span className="n-surligne">{texte.slice(i, i + q.length)}</span>
      {texte.slice(i + q.length)}
    </>
  );
}
