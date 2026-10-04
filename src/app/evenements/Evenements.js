"use client";

import ImageRobuste from "@/components/MediaRobuste";

import { useEffect, useState } from "react";
import { texteErreur, avecReprise } from "@/lib/erreurs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, MapPin, Video, Users, PenLine, Award, Ban } from "lucide-react";
import Avatar from "@/components/Avatar";
import GlisserRafraichir from "@/components/GlisserRafraichir";
import RetourDynamique from "@/components/RetourDynamique";
import { RestaurerDefilement } from "@/components/SuiviNavigation";
import { SqueletteOffre } from "@/components/Squelettes";
import * as memoire from "@/lib/memoire";
import { listeEvenements, quand, dansCombien, ou, urlAffiche, estPasse } from "@/lib/evenements";
import useTempsReel from "@/lib/tempsReel";

// La liste des événements : « À venir » (du plus proche au plus lointain)
// et « Passés ». Une carte par événement, qui s'ouvre en feuille.

export function CarteEvenement({ e, compacte = false }) {
  const o = e.organisateur ?? {};
  const affiche = urlAffiche(e);
  const d = new Date(e.debut);
  const passe = estPasse(e);
  return (
    <Link href={`/evenements/${e.id}`} className={`ev-carte${e.annule ? " annule" : ""}${e.masque ? " pub-masquee" : ""}${passe ? " passe" : ""}${compacte ? " compacte" : ""}`}>
      <span className="ev-date" aria-hidden>
        <b>{d.getDate()}</b>
        <small>{d.toLocaleDateString("fr-FR", { month: "short" }).replace(".", "")}</small>
      </span>
      <span className="ev-corps">
        <span className="ev-haut">
          {e.officiel && <span className="ev-officiel"><Award size={11} aria-hidden /> Amicale</span>}
          {e.annule && <span className="ev-annule"><Ban size={11} aria-hidden /> Annulé</span>}
          {e.masque && <span className="ev-annule">masqué</span>}
          {!e.annule && !passe && dansCombien(e) && <span className="ev-dans">{dansCombien(e)}</span>}
        </span>
        <b className="ev-titre">{e.titre}</b>
        <small className="ev-quand"><CalendarDays size={13} aria-hidden /> {quand(e)}</small>
        <small className="ev-ou">{e.lieu_type === "en_ligne" ? <Video size={13} aria-hidden /> : <MapPin size={13} aria-hidden />} {ou(e) || "Lieu à préciser"}</small>
        <span className="ev-bas">
          <span className="qa-qui"><Avatar profil={{ prenom: o.prenom ?? "?", nom: o.nom ?? "", photo: o.photo_url }} className="com-avatar" />{o.prenom} {o.nom}</span>
          <span className={`ev-nb${e.nb_oui > 0 ? "" : " zero"}`}><Users size={13} aria-hidden /> {e.nb_oui > 0 ? `${e.nb_oui} y ${e.nb_oui > 1 ? "vont" : "va"}` : "Personne pour l’instant"}{e.nb_peut_etre > 0 ? ` · ${e.nb_peut_etre} peut-être` : ""}</span>
          {e.ma_reponse && <span className="ev-moi">{e.ma_reponse === "oui" ? "Tu y vas" : "Peut-être"}</span>}
        </span>
      </span>
      {affiche && !compacte && <ImageRobuste className="ev-affiche-mini" src={affiche} alt="" loading="lazy" />}
    </Link>
  );
}

export default function Evenements() {
  const chemin = usePathname();
  const [quandListe, setQuandListe] = useState(() => memoire.lire("evenements.quand") ?? "a_venir");
  const [liste, setListe] = useState(() => memoire.lire(`evenements.${memoire.lire("evenements.quand") ?? "a_venir"}`) ?? null);
  const [toast, setToast] = useState("");

  const charger = async (q = quandListe) => {
    try { const l = await avecReprise(() => listeEvenements({ quand: q, limite: 50 })); setListe(l); memoire.ecrire(`evenements.${q}`, l); }
    catch (e) { setToast("La liste ne répond pas : " + texteErreur(e)); setTimeout(() => setToast(""), 2600); }
  };
  useTempsReel(["evenements", "evenement_reponses"], () => charger());
  useEffect(() => {
    memoire.ecrire("evenements.quand", quandListe);
    const t = setTimeout(() => { setListe(memoire.lire(`evenements.${quandListe}`) ?? null); charger(quandListe); }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quandListe, chemin]);
  useEffect(() => { const sur = () => charger(); window.addEventListener("lsno:rafraichir", sur); return () => window.removeEventListener("lsno:rafraichir", sur); });

  return (
    <GlisserRafraichir onRafraichir={() => charger()}>
    <>
      <header className="n-tete tete-ev">
        <RetourDynamique secours="/fil" />
        <h1>Les <em>événements</em></h1>
        <p className="cpt">Rencontres, dîners de promo, visios : on s’y retrouve.</p>
      </header>
      <div className="n-panneau fil-filtres">
        <div className="n-filtres">
          <button className={`puce${quandListe === "a_venir" ? " active" : ""}`} onClick={() => setQuandListe("a_venir")}>À venir</button>
          <button className={`puce${quandListe === "passes" ? " active" : ""}`} onClick={() => setQuandListe("passes")}>Passés</button>
        </div>
      </div>
      <div className="fil-liste qa-liste">
        {liste === null && [0, 1].map((i) => <SqueletteOffre key={i} />)}
        {liste?.length === 0 && (
          <p className="ev-vide">{quandListe === "a_venir" ? "Rien de prévu pour l’instant. Lance quelque chose !" : "Aucun événement passé."}</p>
        )}
        {(liste ?? []).map((e) => <CarteEvenement key={e.id} e={e} />)}
      </div>
      <Link href="/evenements/nouveau" className="fil-fab" aria-label="Organiser un événement"><PenLine size={20} strokeWidth={2} aria-hidden /></Link>
      <RestaurerDefilement />
      <div className={`toast${toast ? " la" : ""}`} role="status">{toast}</div>
    </>
    </GlisserRafraichir>
  );
}
