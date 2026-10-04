"use client";

import { useEffect, useState } from "react";
import { creerClientNavigateur } from "@/lib/supabase/client";

// Le tour des nouveautés (migration 72) : ce qu'on montre, et ce que le
// compte a déjà vu. La version augmente quand on ajoute des nouveautés :
// seuls ceux qui ne l'ont pas vue la reçoivent — et ils revoient tout le
// tour, pas seulement les ajouts (choix du 04/10).
// v2 (04/10) : bibliothèque « Annales et sujets » ; carte « Ta promo » pour
// les délégués et admins (photos du carrousel, relecture des documents).
export const TOUR_VERSION = 2;

export const CARTES = [
  { cle: "fil", titre: "Le Fil", accroche: "Ce qui se passe dans le réseau, en une page.", image: "/img/tour/fil.jpg", lien: "/fil",
    points: ["Publie un texte, jusqu’à dix photos ou une vidéo courte.", "Choisis qui voit : tout le réseau, ta promo ou ton domaine.", "Bravo, commentaires, et @ pour mentionner quelqu’un."] },
  { cle: "messages", titre: "Messages", accroche: "Écris à une personne ou à un groupe, en direct.", image: "/img/tour/messages.jpg", lien: "/messages",
    points: ["Photos, PDF, vocaux, sondages : tout passe.", "Glisse un message vers la droite pour y répondre.", "Appui long pour réagir, transférer, épingler, copier."] },
  { cle: "questions", titre: "Questions aux anciens", accroche: "Tu hésites ? Quelqu’un est passé par là.", image: "/img/tour/questions.jpg", lien: "/questions",
    points: ["Pose ta question à visage découvert ou en anonyme.", "Les anciens répondent, tu retiens la meilleure réponse.", "Joins une photo ou un PDF quand ça aide."] },
  { cle: "moments", titre: "Moments", accroche: "Une photo ou une vidéo qui vit 24 h, 3 jours ou 7 jours.", image: "/img/tour/moments.jpg", lien: "/fil",
    points: ["Le rail en haut du Fil : un anneau bleu, c’est du nouveau.", "Réagis d’un emoji ou réponds en privé sans quitter.", "Garde un moment en publication d’un tap, avant qu’il s’efface."] },
  { cle: "evenements", titre: "Événements", accroche: "Dîners de promo, visios, retrouvailles.", image: "/img/tour/evenements.jpg", lien: "/evenements",
    points: ["Dis « J’y vais », ajoute-le à ton agenda.", "Un rappel la veille, et si la date change.", "Après coup, les participants y déposent leurs photos."] },
  { cle: "groupes", titre: "Groupes", accroche: "Rejoins des groupes, ou ouvre le tien.", image: "/img/tour/groupes.jpg", lien: "/messages/groupes",
    points: ["« Découvrir des groupes » dans Messages : ouverts ou sur demande.", "Le créateur accepte qui entre, d’un tap.", "Rends ton groupe visible dans ses réglages."] },
  { cle: "bibliotheque", titre: "Annales et sujets", accroche: "Les sujets du bac et de l’école, gardés par les anciens pour les cadets.", image: "/img/tour/bibliotheque.jpg", lien: "/bibliotheque",
    points: ["Annales, devoirs, cours et corrigés, par matière, classe et année.", "Tu en as un ? Propose-le, fichier ou lien : un délégué relit, puis c’est publié.", "Depuis l’accueil, Conseils ou Offres : « Annales »."] },
  { cle: "promo", titre: "Ta promo", accroche: "Ses photos dans le carrousel, et la relecture des documents : c’est toi.", image: "/img/tour/promo.jpg", lien: "/admin#sec-bibliotheque", roles: ["delegue", "admin"],
    points: ["Dans Validation : deux photos de ta promo, avec leur titre, dans « Le lycée, en images ».", "Les documents proposés passent par toi : publier, ou refuser avec un mot.", "Ce que tu proposes toi-même est publié d’emblée."] },
];

// les cartes qu'un compte voit : toutes, sauf celles réservées à un rôle qu'il n'a pas
export function cartesPour(role) {
  return CARTES.filter((c) => !c.roles || c.roles.includes(role));
}

export const GESTES = [
  { titre: "Glisser vers la droite", texte: "sur un message : tu y réponds." },
  { titre: "Appui long", texte: "sur un message ou une conversation : les options." },
  { titre: "Tirer vers le bas", texte: "en haut d’une liste : elle se recharge." },
  { titre: "Taper l’onglet déjà ouvert", texte: "remonte en haut ; en haut, recharge." },
  { titre: "Glisser vers le bas", texte: "ferme une feuille ou le lecteur de moments." },
  { titre: "Taper une photo", texte: "l’ouvre en grand ; glisse pour passer à la suivante." },
];

// les pastilles « Nouveau », par écran
export const PASTILLES = {
  publier: "Touche ici pour publier : texte, photos, vidéo, et choisis qui voit.",
  moments: "Les moments : des photos et vidéos qui s’effacent d’elles-mêmes. Le + pour en publier un.",
  questions: "Pose une question aux anciens, ou réponds à celles des cadets.",
  evenements: "Les événements du réseau : dis si tu viens, ajoute-les à ton agenda.",
  groupes: "Des groupes à rejoindre d’un tap ou sur demande.",
  bibliotheque: "Annales du bac, devoirs, cours et corrigés, gardés par les anciens. Tu en as ? Propose-les.",
};

// ---- ce que le compte a déjà vu (une lecture par session, partagée) ----
let etat = null;           // { tour_version, decouvertes, role }
let enCours = null;
const abonnes = new Set();
async function lireEtat() {
  if (etat) return etat;
  if (!enCours) {
    enCours = (async () => {
      const supabase = creerClientNavigateur();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("tour_version, decouvertes, role").eq("id", user.id).maybeSingle();
      etat = data ? { tour_version: data.tour_version ?? 0, decouvertes: data.decouvertes ?? [], role: data.role ?? "membre" } : null;
      return etat;
    })().finally(() => { enCours = null; });
  }
  return enCours;
}
function prevenir() { abonnes.forEach((f) => f(etat ? { ...etat } : null)); }

export function useTourEtat(initial = null) {
  const [valeur, setValeur] = useState(() => etat ?? initial);
  useEffect(() => {
    abonnes.add(setValeur);
    let vivant = true;
    lireEtat().then((e) => { if (vivant && e) setValeur({ ...e }); });
    return () => { vivant = false; abonnes.delete(setValeur); };
  }, []);
  return valeur;
}

export async function marquerTourVu() {
  const supabase = creerClientNavigateur();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  etat = { ...(etat ?? { decouvertes: [] }), tour_version: TOUR_VERSION };
  prevenir();
  await supabase.from("profiles").update({ tour_version: TOUR_VERSION }).eq("id", user.id);
}

// Les pastilles s'effacent d'elles-mêmes : dès qu'on se sert de la fonction
// (tap sur l'élément), sur « Compris », et de toute façon 30 jours après la
// première fois qu'on les a vues (jeton « depuis:AAAA-MM-JJ » dans la liste).
export const PASTILLES_JOURS = 30;
export function pastillesExpirees(e) {
  const jeton = e?.decouvertes?.find((d) => d.startsWith("depuis:"));
  if (!jeton) return false;
  return Date.now() - new Date(jeton.slice(7)).getTime() > PASTILLES_JOURS * 86400000;
}
export async function marquerDecouverte(cle) {
  if (etat?.decouvertes?.includes(cle)) return;   // déjà su : rien à écrire
  const supabase = creerClientNavigateur();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const liste = Array.from(new Set([...(etat?.decouvertes ?? []), cle]));
  etat = { ...(etat ?? { tour_version: 0 }), decouvertes: liste };
  prevenir();
  await supabase.from("profiles").update({ decouvertes: liste }).eq("id", user.id);
}
