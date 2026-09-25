import Link from "next/link";
import { ExternalLink, FileText, Image as ImageIcon } from "lucide-react";
import Avatar from "@/components/Avatar";
import TamponDate from "@/components/TamponDate";
import { DOMAINES, nomPays } from "@/lib/donnees";
import { nomType, echeanceLongue, urlFichier, ilYA } from "@/lib/offres";
import PartagerOffre from "./PartagerOffre";

// Le contenu visuel d'une offre, PARTAGÉ entre la vraie page (/offres/[id])
// et la feuille glissante ouverte depuis la liste (@modal). Même découpe que
// le profil : CouvertureOffre + TeteOffre (purement visuels, zone glissable
// de la feuille) et SuiteOffre (liens, boutons — jamais glissable).

export function metaOffre(o) {
  const domaine = DOMAINES.find((d) => d.cle === o.domaine)?.nom.split(" &")[0];
  const lieu = [o.ville, o.pays ? nomPays(o.pays) : null].filter(Boolean).join(", ");
  return [domaine, lieu].filter(Boolean).join(" · ");
}

// bande bleu nuit sur grain kraft : le type en filigrane, l'étiquette en bas
// à gauche, le tampon d'échéance en bas à droite
export function CouvertureOffre({ o, jours, children }) {
  return (
    <div className="o-cover">
      <span className="filigrane" aria-hidden>{nomType(o.type)}</span>
      <span className="o-type">{nomType(o.type)}</span>
      <TamponDate date={o.date_limite} jours={jours} />
      {children}
    </div>
  );
}

export function TeteOffre({ o }) {
  const echeance = echeanceLongue(o.date_limite);
  return (
    <div className="o-corps">
      <h1>{o.titre}</h1>
      <span className="o-meta">{metaOffre(o)}</span>
      {echeance && <span className="o-echeance">À saisir avant le {echeance}</span>}
    </div>
  );
}

export function SuiteOffre({ o, moiId }) {
  const p = o.posteur;
  const mienne = moiId && p?.id === moiId;
  return (
    <>
      <p className="o-desc">{o.description}</p>

      <div className="o-actions">
        {o.lien && (
          <a href={o.lien} target="_blank" rel="noopener noreferrer" className="btn btn-or" style={{ padding: "11px 18px", fontSize: 13.5 }}>
            Voir l&apos;annonce <ExternalLink size={13} aria-hidden />
          </a>
        )}
        <PartagerOffre o={o} />
      </div>

      {o.fichiers?.length > 0 && (
        <div className="o-fichiers o-fichiers-page">
          {o.fichiers.map((f) => (
            <a key={f.id} className="o-fichier" href={urlFichier(f.chemin)} target="_blank" rel="noopener noreferrer" download={f.nom}>
              {f.type === "application/pdf" ? <FileText size={14} aria-hidden /> : <ImageIcon size={14} aria-hidden />}
              <span className="o-fichier-nom">{f.nom}</span>
            </a>
          ))}
        </div>
      )}

      {p && (
        <section className="o-posteur">
          <h4>Proposée par</h4>
          <Link href={`/profil/${p.id}`} className="contact">
            <Avatar profil={{ prenom: p.prenom ?? "?", nom: p.nom ?? "", photo: p.photo_url }} className="offre-avatar" />
            <span className="val">
              <b style={{ display: "block", fontSize: 14 }}>{p.prenom} {p.nom}</b>
              <small style={{ color: "var(--texte-2)" }}>Promo {p.promotions?.numero} · publiée {ilYA(o.cree_le)}</small>
            </span>
            <span className="visi">{mienne ? "mon profil" : "contacter ↗"}</span>
          </Link>
        </section>
      )}
    </>
  );
}
