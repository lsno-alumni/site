"use client";

import { useState } from "react";
import Link from "next/link";
import { Camera, ThumbsUp, MessageCircle, Share2, MoreHorizontal, PenLine, ArrowRight } from "lucide-react";
import Avatar from "@/components/Avatar";
import TamponDate from "@/components/TamponDate";
import RafraichirPage from "@/components/RafraichirPage";
import { RestaurerDefilement } from "@/components/SuiviNavigation";
import { joursRestants } from "@/lib/offres";

// Le Fil : ce qui se passe dans le réseau. Les publications des membres
// (texte, photo) se mêlent à des cartes AUTOMATIQUES — arrivées, offres,
// conseils — pour que le fil ne paraisse jamais vide, même quand personne
// n'a rien écrit depuis des jours. Chaque famille a sa matière (papier /
// bleu nuit / tampon / citation) : la variété des fonds fait le rythme.
//
// MAQUETTE (branche `social`) : données de démonstration, pas encore de base.

const FILTRES = [
  { cle: "tout", nom: "Tout" },
  { cle: "publication", nom: "Publications" },
  { cle: "arrivee", nom: "Arrivées" },
  { cle: "offre", nom: "Offres" },
  { cle: "conseil", nom: "Conseils" },
];

function Publication({ p }) {
  const [bravo, setBravo] = useState(p.jai_bravo);
  const n = p.bravos + (bravo ? 1 : 0) - (p.jai_bravo ? 1 : 0);
  return (
    <article className="pub">
      <header className="pub-tete">
        <Link href={`/profil/${p.auteur.id}`} className="pub-qui">
          <Avatar profil={{ prenom: p.auteur.prenom, nom: p.auteur.nom, photo: p.auteur.photo }} className="pub-avatar" />
          <span>
            <b>{p.auteur.prenom} {p.auteur.nom}</b>
            <small>Promo {p.auteur.promo} · {p.il_y_a}</small>
          </span>
        </Link>
        <button type="button" className="pub-plus" aria-label="Options"><MoreHorizontal size={18} aria-hidden /></button>
      </header>
      <p className="pub-texte">{p.texte}</p>
      {p.photo && <img className="pub-photo" src={p.photo} alt="" />}
      <footer className="pub-pied">
        <button type="button" className={`pub-action${bravo ? " on" : ""}`} onClick={() => setBravo(!bravo)} aria-pressed={bravo}>
          <ThumbsUp size={16} strokeWidth={bravo ? 2.4 : 1.9} aria-hidden /> Bravo{n > 0 && <b>{n}</b>}
        </button>
        <button type="button" className="pub-action">
          <MessageCircle size={16} strokeWidth={1.9} aria-hidden /> {p.commentaires > 0 ? <>Commenter<b>{p.commentaires}</b></> : "Commenter"}
        </button>
        <button type="button" className="pub-action" aria-label="Partager"><Share2 size={16} strokeWidth={1.9} aria-hidden /></button>
      </footer>
    </article>
  );
}

// carte automatique : un membre validé vient d'arriver — bleu nuit, comme la
// première voix d'un chapitre de conseils
function Arrivee({ a }) {
  const m = a.membre;
  return (
    <article className="pub pub-arrivee">
      <Link href={`/profil/${m.id}`} className="pub-arrivee-corps">
        <Avatar profil={{ prenom: m.prenom, nom: m.nom, photo: m.photo }} className="pub-avatar grand" />
        <span>
          <small className="pub-etiquette">Nouveau membre · {a.il_y_a}</small>
          <b>{m.prenom} {m.nom}</b>
          <span className="pub-arrivee-meta">Promo {m.promo} · {m.domaine}{m.ville ? ` · ${m.ville}` : ""}</span>
        </span>
      </Link>
      <Link href={`/profil/${m.id}`} className="btn btn-nu pub-arrivee-btn">Dire bonjour <ArrowRight size={13} aria-hidden /></Link>
    </article>
  );
}

// carte automatique : une offre vient d'être partagée — le tampon d'échéance
function Offre({ o }) {
  const f = o.offre;
  return (
    <Link href={`/offres/${f.id}`} className="pub pub-offre">
      <TamponDate date={f.date_limite} jours={joursRestants(f.date_limite)} />
      <small className="pub-etiquette">Nouvelle offre · {o.il_y_a}</small>
      <span className="o-type">{f.type === "stage" ? "Stage" : f.type}</span>
      <b className="pub-offre-titre">{f.titre}</b>
      <span className="o-meta">{f.domaine} · {f.lieu}</span>
      <span className="pub-offre-par">partagée par {f.posteur}</span>
    </Link>
  );
}

// carte automatique : un conseil — la citation, comme sur l'accueil
function Conseil({ c }) {
  const k = c.conseil;
  return (
    <article className="a-temoin pub-conseil">
      <small className="pub-etiquette">Conseil aux cadets · {k.theme}</small>
      <p>{k.texte}</p>
      <Link href={`/profil/${k.id}`} className="qui">
        <Avatar profil={{ prenom: k.prenom, nom: k.nom, photo: k.photo }} className="am-conseil-photo" />
        <div>
          <b>{k.prenom} {k.nom}</b>
          <span>Promotion {k.promo} · voir son parcours</span>
        </div>
      </Link>
    </article>
  );
}

export default function Fil({ moi, fil }) {
  const [filtre, setFiltre] = useState("tout");
  const visibles = filtre === "tout" ? fil : fil.filter((x) => x.type === filtre);

  return (
    <RafraichirPage>
    <>
      <header className="n-tete tete-fil">
        <h1>Le <em>fil</em></h1>
        <p className="cpt">Ce qui se passe dans le réseau.</p>
      </header>

      {/* composer : une feuille de papier qui chevauche la photo */}
      <button type="button" className="fil-compose">
        <Avatar profil={moi} className="pub-avatar" />
        <span className="fil-compose-texte">Quoi de neuf, {moi.prenom} ?</span>
        <span className="fil-compose-photo" aria-hidden><Camera size={18} strokeWidth={1.9} /></span>
      </button>

      <div className="n-panneau fil-filtres">
        <div className="n-filtres">
          {FILTRES.map((f) => (
            <button key={f.cle} className={`puce${filtre === f.cle ? " active" : ""}`} onClick={() => setFiltre(f.cle)}>{f.nom}</button>
          ))}
        </div>
      </div>

      <div className="fil-liste">
        {visibles.map((x) => {
          if (x.type === "publication") return <Publication key={x.id} p={x} />;
          if (x.type === "arrivee") return <Arrivee key={x.id} a={x} />;
          if (x.type === "offre") return <Offre key={x.id} o={x} />;
          if (x.type === "conseil") return <Conseil key={x.id} c={x} />;
          return null;
        })}
        <p className="fil-fin">Tu es à jour.</p>
      </div>

      {/* écrire depuis n'importe où dans le fil */}
      <button type="button" className="fil-fab" aria-label="Publier"><PenLine size={20} strokeWidth={2} aria-hidden /></button>

      <RestaurerDefilement />
    </>
    </RafraichirPage>
  );
}
