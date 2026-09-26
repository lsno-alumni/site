"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Camera, MessageCircle, Share2, MoreHorizontal, PenLine, ArrowRight, Play } from "lucide-react";
import Avatar from "@/components/Avatar";
import Bravo from "@/components/Bravo";
import TamponDate from "@/components/TamponDate";
import GlisserRafraichir from "@/components/GlisserRafraichir";
import { RestaurerDefilement } from "@/components/SuiviNavigation";
import { SqueletteOffre } from "@/components/Squelettes";
import * as memoire from "@/lib/memoire";
import { joursRestants, nomType } from "@/lib/offres";
import { nomDomaine, nomPays, DOMAINES } from "@/lib/donnees";
import { chargerFil, depuis, urlMedia, signaler, moderer, supprimerPublication, VISIBILITES } from "@/lib/fil";
import useClicDehors from "@/lib/useClicDehors";

// Le Fil : ce qui se passe dans le réseau. Les publications des membres
// (texte, photo ou vidéo) se mêlent à des cartes AUTOMATIQUES — arrivées,
// offres, conseils — pour que le fil ne paraisse jamais vide. Chaque famille
// a sa matière (papier / bleu nuit / tampon / citation).

const FILTRES = [
  { cle: "tout", nom: "Tout" },
  { cle: "publication", nom: "Publications" },
  { cle: "arrivee", nom: "Arrivées" },
  { cle: "offre", nom: "Offres" },
  { cle: "conseil", nom: "Conseils" },
];

function Publication({ p, moi, moderateur, onChange, signale }) {
  const [menu, setMenu] = useState(false);
  const menuRef = useRef(null);
  useClicDehors(menu, (e) => menuRef.current?.contains(e.target), () => setMenu(false));
  const mienne = p.auteur.id === moi.id;
  const agir = async (action) => {
    setMenu(false);
    try {
      if (action === "supprimer") {
        if (!confirm("Supprimer cette publication ?")) return;
        await supprimerPublication(p); onChange(); signale("Publication supprimée");
      }
      if (action === "signaler") { await signaler("publication", p.id, "Publication signalée depuis l'application"); signale("Merci, les modérateurs sont prévenus."); }
      if (action === "masquer") { await moderer("publication", p.id, !p.masquee); onChange(); }
      if (action === "partager") {
        const url = `${window.location.origin}/publication/${p.id}`;
        if (navigator.share) await navigator.share({ title: `${p.auteur.prenom} sur LSNO Amicale`, url });
        else { await navigator.clipboard.writeText(url); signale("Lien copié"); }
      }
    } catch (e) { if (e?.name !== "AbortError") signale("Action impossible : " + (e.message ?? "")); }
  };
  return (
    <article className={`pub${p.masquee ? " pub-masquee" : ""}`}>
      <header className="pub-tete">
        <Link href={`/profil/${p.auteur.id}`} className="pub-qui">
          <Avatar profil={{ prenom: p.auteur.prenom, nom: p.auteur.nom, photo: p.auteur.photo_url }} className="pub-avatar" />
          <span>
            <b>{p.auteur.prenom} {p.auteur.nom}</b>
            <small>Promo {p.auteur.promo} · {depuis(p.cree_le)}{p.masquee ? " · masquée" : ""}
              {p.visibilite && p.visibilite !== "tous" && <span className="pub-visi">{VISIBILITES.find((v) => v.cle === p.visibilite)?.court}</span>}</small>
          </span>
        </Link>
        <span className="pub-menu" ref={menuRef}>
          <button type="button" className="pub-plus" aria-label="Options" onClick={() => setMenu(!menu)}><MoreHorizontal size={18} aria-hidden /></button>
          {menu && (
            <span className="pub-menu-liste">
              <button type="button" onClick={() => agir("partager")}>Partager</button>
              {!mienne && <button type="button" onClick={() => agir("signaler")}>Signaler</button>}
              {moderateur && <button type="button" onClick={() => agir("masquer")}>{p.masquee ? "Rétablir" : "Masquer"}</button>}
              {(mienne || moi.role === "admin") && <button type="button" className="danger" onClick={() => agir("supprimer")}>Supprimer</button>}
            </span>
          )}
        </span>
      </header>
      <Link href={`/publication/${p.id}`} className="pub-ouvrir">
        {p.texte && <p className="pub-texte">{p.texte}</p>}
        {p.media_type === "photo" && p.media_chemin && <img className="pub-photo" src={urlMedia(p.media_chemin)} alt="" loading="lazy" />}
        {p.media_type === "video" && p.media_chemin && (
          <span className="pub-video"><video src={urlMedia(p.media_chemin)} preload="metadata" playsInline muted /><span className="pub-video-lire"><Play size={22} aria-hidden /></span></span>
        )}
        {p.media_type === "video_expiree" && <p className="pub-expiree">Vidéo expirée (les vidéos restent 14 jours).</p>}
      </Link>
      <footer className="pub-pied">
        <Bravo type="publication" id={p.id} nombre={p.bravos} actif={p.jai_bravo} />
        <Link href={`/publication/${p.id}`} className="pub-action">
          <MessageCircle size={16} strokeWidth={1.9} aria-hidden /> Commenter{p.commentaires > 0 && <b>{p.commentaires}</b>}
        </Link>
        <button type="button" className="pub-action" aria-label="Partager" onClick={() => agir("partager")}><Share2 size={16} strokeWidth={1.9} aria-hidden /></button>
      </footer>
    </article>
  );
}

function Arrivee({ m }) {
  return (
    <article className="pub pub-arrivee">
      <Link href={`/profil/${m.id}`} className="pub-arrivee-corps">
        <Avatar profil={{ prenom: m.prenom, nom: m.nom, photo: m.photo_url }} className="pub-avatar grand" />
        <span>
          <small className="pub-etiquette">Nouveau membre · {depuis(m.valide_le)}</small>
          <b>{m.prenom} {m.nom}</b>
          <span className="pub-arrivee-meta">Promo {m.promotions?.numero} · {nomDomaine(m.domaine, m.domaine_precision, true)}{m.ville ? ` · ${m.ville}` : ""}</span>
        </span>
      </Link>
      <Link href={`/profil/${m.id}`} className="btn btn-nu pub-arrivee-btn">Dire bonjour <ArrowRight size={13} aria-hidden /></Link>
    </article>
  );
}

function Offre({ o }) {
  const domaine = DOMAINES.find((d) => d.cle === o.domaine)?.nom.split(" &")[0];
  const lieu = [o.ville, o.pays ? nomPays(o.pays) : null].filter(Boolean).join(", ");
  return (
    <Link href={`/offres/${o.id}`} className="pub pub-offre">
      <TamponDate date={o.date_limite} jours={joursRestants(o.date_limite)} />
      <small className="pub-etiquette">Nouvelle offre · {depuis(o.cree_le)}</small>
      <span className="o-type">{nomType(o.type)}</span>
      <b className="pub-offre-titre">{o.titre}</b>
      <span className="o-meta">{[domaine, lieu].filter(Boolean).join(" · ")}</span>
      {o.posteur && <span className="pub-offre-par">partagée par {o.posteur.prenom} {o.posteur.nom}</span>}
    </Link>
  );
}

function Conseil({ c }) {
  return (
    <article className="a-temoin pub-conseil">
      <small className="pub-etiquette">Conseil aux cadets{c.conseil_theme ? ` · ${c.conseil_theme}` : ""}</small>
      <p>{c.conseil}</p>
      <Link href={`/profil/${c.id}`} className="qui">
        <Avatar profil={{ prenom: c.prenom, nom: c.nom, photo: c.photo_url }} className="am-conseil-photo" />
        <div>
          <b>{c.prenom} {c.nom}</b>
          <span>Promotion {c.promotions?.numero} · voir son parcours</span>
        </div>
      </Link>
    </article>
  );
}

export default function Fil({ moi, moderateur }) {
  const routeur = useRouter();
  const chemin = usePathname();
  const [filtre, setFiltre] = useState("tout");
  const [items, setItems] = useState(() => memoire.lire("fil.items") ?? null);
  const [fin, setFin] = useState(false);
  const [dernierePub, setDernierePub] = useState(null);
  const [encore, setEncore] = useState(false);
  const [toast, setToast] = useState("");
  const signale = (m) => { setToast(m); setTimeout(() => setToast(""), 2600); };

  const charger = async () => {
    try {
      const r = await chargerFil();
      setItems(r.items); setFin(r.fin); setDernierePub(r.dernierePub);
    } catch (e) { signale("Le fil ne répond pas : " + (e.message ?? "")); }
  };
  // au montage, et au retour du composer (qui vide la mémoire du fil pour
  // dire « il y a du neuf » : le Fil reste monté sous la feuille)
  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
  useEffect(() => { if (chemin === "/fil" && (items === null || memoire.lire("fil.items") === null)) charger(); }, [chemin]);
  useEffect(() => { if (items !== null) memoire.ecrire("fil.items", items); }, [items]);

  const suite = async () => {
    if (encore || fin || !dernierePub) return;
    setEncore(true);
    try {
      const r = await chargerFil({ avant: dernierePub });
      setItems((l) => [...l, ...r.items]); setFin(r.fin); setDernierePub(r.dernierePub);
    } catch { /* on réessaiera */ }
    setEncore(false);
  };
  const rafraichir = async () => { await charger(); routeur.refresh(); };

  const visibles = (items ?? []).filter((x) => filtre === "tout" || x.type === filtre);

  return (
    <GlisserRafraichir onRafraichir={rafraichir}>
    <>
      <header className="n-tete tete-fil">
        <h1>Le <em>fil</em></h1>
        <p className="cpt">Ce qui se passe dans le réseau.</p>
      </header>

      <Link href="/fil/nouvelle" className="fil-compose">
        <Avatar profil={moi} className="pub-avatar" />
        <span className="fil-compose-texte">Quoi de neuf, {moi.prenom} ?</span>
        <span className="fil-compose-photo" aria-hidden><Camera size={18} strokeWidth={1.9} /></span>
      </Link>

      <div className="n-panneau fil-filtres">
        <div className="n-filtres">
          {FILTRES.map((f) => (
            <button key={f.cle} className={`puce${filtre === f.cle ? " active" : ""}`} onClick={() => setFiltre(f.cle)}>{f.nom}</button>
          ))}
        </div>
      </div>

      <div className="fil-liste">
        {items === null && [0, 1, 2].map((i) => <SqueletteOffre key={i} />)}
        {visibles.map((x) => {
          if (x.type === "publication") return <Publication key={x.id} p={x.p} moi={moi} moderateur={moderateur} onChange={charger} signale={signale} />;
          if (x.type === "arrivee") return <Arrivee key={x.id} m={x.m} />;
          if (x.type === "offre") return <Offre key={x.id} o={x.o} />;
          if (x.type === "conseil") return <Conseil key={x.id} c={x.c} />;
          return null;
        })}
        {items !== null && visibles.length === 0 && (
          <div className="vide" style={{ paddingTop: 30 }}>
            <b>Rien par ici pour l&apos;instant</b>{" "}
            {filtre === "publication" ? "Sois le premier à publier quelque chose." : "Reviens un peu plus tard."}
          </div>
        )}
        {items !== null && !fin && filtre === "tout" && (
          <button type="button" className="btn btn-nu fil-suite" onClick={suite} disabled={encore}>{encore ? "Chargement…" : "Voir plus"}</button>
        )}
        {items !== null && (fin || filtre !== "tout") && visibles.length > 0 && <p className="fil-fin">Tu es à jour.</p>}
      </div>

      <Link href="/fil/nouvelle" className="fil-fab" aria-label="Publier"><PenLine size={20} strokeWidth={2} aria-hidden /></Link>
      <div className={`toast${toast ? " la" : ""}`} role="status">{toast}</div>
      <RestaurerDefilement />
    </>
    </GlisserRafraichir>
  );
}
