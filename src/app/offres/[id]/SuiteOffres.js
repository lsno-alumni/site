import Link from "next/link";
import TamponDate from "@/components/TamponDate";
import { nomType, joursRestants } from "@/lib/offres";
import { metaOffre } from "./ContenuOffre";
import { nomDomaine } from "@/lib/donnees";

// Fin de page d'une offre ouverte : « D'autres offres à saisir » (les plus
// urgentes, avec leur tampon) puis « Des anciens dans ce domaine » (ceux qui
// répondent aux cadets d'abord). Une offre lue en informatique mène tout de
// suite à qui contacter pour en parler.
function Polaroid({ m }) {
  return (
    <Link href={`/profil/${m.id}`} className="polaroid" draggable={false}>
      {m.photo_url
        ? <img className="polaroid-photo" src={m.photo_url} alt="" draggable={false} />
        : <>
            <span className="polaroid-photo polaroid-init">{(m.prenom[0] + (m.nom?.[0] ?? "")).toUpperCase()}</span>
            <img className="polaroid-blason" src="/img/logo.jpg" alt="" draggable={false} />
          </>}
      <span className="polaroid-promo">P{m.promotions?.numero}</span>
      <span className="polaroid-nom">
        <b>{m.prenom}</b>
        <small>{m.repond_cadets ? "Répond aux cadets" : nomDomaine(m.domaine, m.domaine_precision, true)}</small>
      </span>
    </Link>
  );
}

export default function SuiteOffres({ suite, domaine }) {
  const { offres = [], anciens = [] } = suite ?? {};
  if (offres.length === 0 && anciens.length === 0) return null;
  return (
    <section className="p-voisins o-suite">
      {offres.length > 0 && (
        <>
          <h4>D&apos;autres offres à saisir</h4>
          <div className="voisins">
            {offres.map((o) => (
              <Link key={o.id} href={`/offres/${o.id}`} className="o-mini" draggable={false}>
                <TamponDate date={o.date_limite} jours={joursRestants(o.date_limite)} />
                <span className="o-type">{nomType(o.type)}</span>
                <b>{o.titre}</b>
                <small>{metaOffre(o)}</small>
              </Link>
            ))}
          </div>
        </>
      )}
      {anciens.length > 0 && (
        <>
          <h4>Des anciens en {domaine}</h4>
          <div className="voisins">{anciens.map((m) => <Polaroid key={m.id} m={m} />)}</div>
        </>
      )}
    </section>
  );
}
