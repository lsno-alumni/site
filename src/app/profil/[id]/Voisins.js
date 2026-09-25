import Link from "next/link";
import { nomDomaine } from "@/lib/donnees";

// Fin de page du profil consulté : d'autres anciens à découvrir, « aussi dans
// la promo » puis « dans le même domaine ». Cartes polaroïd (mêmes classes
// que l'éventail de l'accueil) posées en rangée qui défile au doigt. Un
// profil léger ne se termine plus sur du papier vide, et un cadet passe
// d'aîné en aîné sans repasser par l'annuaire.
function Carte({ m }) {
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
        <small>{nomDomaine(m.domaine, m.domaine_precision, true)}</small>
      </span>
    </Link>
  );
}

export default function Voisins({ voisins, promotion }) {
  const { promo = [], domaine = [] } = voisins ?? {};
  if (promo.length === 0 && domaine.length === 0) return null;
  return (
    <section className="p-voisins">
      {promo.length > 0 && (
        <>
          <h4>Aussi dans la promo {promotion}</h4>
          <div className="voisins">{promo.map((m) => <Carte key={m.id} m={m} />)}</div>
        </>
      )}
      {domaine.length > 0 && (
        <>
          <h4>Dans le même domaine</h4>
          <div className="voisins">{domaine.map((m) => <Carte key={m.id} m={m} />)}</div>
        </>
      )}
    </section>
  );
}
