import { dateLimite } from "@/lib/offres";

// L'échéance d'une offre, comme un tampon d'agenda : le jour en gros, le mois
// dessous. À 7 jours ou moins, le tampon passe en bleu avec le compte à
// rebours (« J-3 », « dernier jour »). `jours` est calculé par l'appelant
// (côté serveur pour les pages, à l'affichage pour la liste) pour que le rendu
// serveur et le navigateur montrent la même chose.
export default function TamponDate({ date, jours }) {
  const d = dateLimite(date);
  if (!d) return null;
  const urgent = jours != null && jours <= 7;
  const mois = d.toLocaleDateString("fr-FR", { month: "short" }).replace(".", "");
  return (
    <span className={`o-tampon${urgent ? " urgent" : ""}`}
      aria-label={`avant le ${d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}`}>
      <b>{d.getDate()}</b>
      <small>{mois}</small>
      {urgent && <i>{jours <= 0 ? "dernier jour" : `J-${jours}`}</i>}
    </span>
  );
}
