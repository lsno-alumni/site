"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, ArrowDown, Send, MoreHorizontal, Users, Trash2, LogOut, Pencil, UserPlus, X, Check, Paperclip, FileText, Play,
  Mic, Square, Reply, BellOff, Bell, Pin, PinOff, Link as LienIcone, CheckCheck, Plus, Minus,
  Ban, Flag, Forward, MessageSquare, Image as ImageIcone, BarChart3, Info, Camera,
} from "lucide-react";
import Avatar from "@/components/Avatar";
import LecteurAudio from "@/components/LecteurAudio";
import Sondage from "./Sondage";
import useClicDehors from "@/lib/useClicDehors";
import { peutRevenir } from "@/components/SuiviNavigation";
import * as memoire from "@/lib/memoire";
import { useMentions, SuggestionsMention, TexteMentions, carnet as carnetMembres } from "@/lib/mentions";
import {
  lireConversation, chargerMessages, lireMessage, envoyerMessage, modifierMessage, supprimerMessage, marquerLu, ecouterMessages,
  ecouterModifications, ecouterLecture, ecouterReactions, canalFrappe, reactionsDe, reagir, reglerConversation,
  renommerGroupe, ajouterMembres, retirerMembre, supprimerGroupe, membresJoignables, mesConversations,
  televerserPiece, urlsPieces, tailleLisible, libellePiece,
  mesBlocages, bloquer, debloquer, signalerMessage, majGroupe, televerserPhotoGroupe, epinglerMessage,
  creerSondage, lireSondages, ecouterVotes, transfererMessage, ouvrirDuo,
  nomConversation, heure, jour, MESSAGE_MAX, PIECE_VIDEO_SECONDES, PIECE_VIDEO_MO, PIECE_PDF_MO, VOCAL_SECONDES,
  EMOJIS, EMOJIS_PLUS, MODIF_MINUTES, JOURS_PIECE,
} from "@/lib/messages";

// Le fil d'une conversation : bulles (les miennes à droite, en bleu ; les
// autres à gauche, papier, avec le prénom dans les groupes), séparateurs de
// jour, saisie collée en bas, arrivée en temps réel, lecture marquée à
// l'ouverture et à chaque message reçu. Pièces jointes (plusieurs photos
// d'un coup), vocal, coches « vu » par message, « … écrit », réponse citée
// (menu ou glissement vers la droite), réactions (six + grille), sourdine /
// épingle, modification dans les 5 minutes, liens partagés, transfert,
// signalement, blocage, message épinglé, sondages, photo et description de
// groupe, réponse en privé depuis un groupe, brouillon gardé. Appui long
// (ou clic droit, ou double clic) sur une bulle = ses actions.

const SEUIL_REPONSE = 56;   // px de glissement vers la droite pour répondre
const APPUI_LONG = 450;     // ms
const cleBrouillon = (id) => `brouillon-conv-${id}`;

function Citation({ c, nom }) {
  if (!c) return <div className="msg-citation"><small>Message plus ancien</small></div>;
  return <div className="msg-citation"><b>{nom}</b><span>{c.texte?.trim() ? c.texte.slice(0, 90) : libellePiece(c)}</span></div>;
}

function Piece({ m, url, mienne }) {
  if (m.fichier_expiree) return <p className="msg-piece-expiree">{libellePiece(m)} expirée, gardée {JOURS_PIECE[m.fichier_type] ?? 30} jours.</p>;
  if (!m.fichier_chemin) return null;
  if (m.fichier_type === "lien") {
    const genre = m.fichier_chemin.startsWith("/offres") ? "Offre" : m.fichier_chemin.startsWith("/publication") ? "Publication" : m.fichier_chemin.startsWith("/profil") ? "Profil" : "Lien";
    return (
      <Link href={m.fichier_chemin} className="msg-piece-pdf msg-piece-lien" draggable={false}>
        <LienIcone size={20} strokeWidth={1.7} aria-hidden />
        <span><b>{m.fichier_nom || "Voir"}</b><small>{genre} · ouvrir</small></span>
      </Link>
    );
  }
  if (m.fichier_type === "photo") return url ? <a href={url} target="_blank" rel="noopener noreferrer" className="msg-piece-photo" draggable={false}><img src={url} alt="" loading="lazy" draggable={false} /></a> : <span className="msg-piece-attente" aria-hidden />;
  if (m.fichier_type === "video") return url ? <video className="msg-piece-video" src={url} controls playsInline preload="metadata" /> : <span className="msg-piece-attente" aria-hidden><Play size={20} /></span>;
  if (m.fichier_type === "audio") return url ? <LecteurAudio src={url} mienne={mienne} /> : <span className="msg-piece-attente courte" aria-hidden><Mic size={18} /></span>;
  return (
    <a href={url ?? "#"} target="_blank" rel="noopener noreferrer" className="msg-piece-pdf" draggable={false}>
      <FileText size={22} strokeWidth={1.7} aria-hidden />
      <span><b>{m.fichier_nom ?? "document.pdf"}</b><small>PDF · {tailleLisible(m.fichier_taille)}</small></span>
    </a>
  );
}

function Reactions({ liste, moiId, nomDe, mienne, onTap }) {
  if (!liste?.length) return null;
  const groupes = {};
  for (const r of liste) (groupes[r.emoji] ??= []).push(r.membre);
  return (
    <div className={`msg-reactions${mienne ? " mien" : ""}`}>
      {Object.entries(groupes).map(([e, qui]) => (
        <button key={e} type="button" className={`msg-reaction${qui.includes(moiId) ? " on" : ""}`} onClick={(ev) => { ev.stopPropagation(); onTap(e); }}
          title={qui.map(nomDe).join(", ")}>
          {e}{qui.length > 1 && <small>{qui.length}</small>}
        </button>
      ))}
    </div>
  );
}

// une ligne = une bulle, avec ses gestes : appui long / clic droit / double
// clic → menu ; glissement vers la droite → répondre
function Rang({ mid, mien, suite, groupe, auteur, enfants, onMenu, onRepondre }) {
  const geste = useRef(null);
  const bulle = useRef(null);
  const [decal, setDecal] = useState(0);
  const poser = (d, anime) => { setDecal(d); if (bulle.current) bulle.current.style.transition = anime ? "transform .18s ease-out" : "none"; };
  const debut = (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    geste.current = { x0: e.clientX, y0: e.clientY, long: false, glisse: false, id: e.pointerId,
      minuteur: setTimeout(() => { if (geste.current && !geste.current.glisse) { geste.current.long = true; onMenu(); } }, APPUI_LONG) };
  };
  const bouge = (e) => {
    const g = geste.current;
    if (!g || g.long) return;
    const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
    if (!g.glisse && Math.abs(dy) > 10 && Math.abs(dy) >= Math.abs(dx)) { clearTimeout(g.minuteur); geste.current = null; poser(0, true); return; }
    if (dx > 12 && Math.abs(dx) > Math.abs(dy)) {
      if (!g.glisse) { g.glisse = true; clearTimeout(g.minuteur); e.currentTarget.setPointerCapture?.(g.id); }
      poser(Math.min(dx - 12, 80), false);
    }
  };
  const fin = () => {
    const g = geste.current;
    if (!g) return;
    clearTimeout(g.minuteur);
    if (g.glisse && decal >= SEUIL_REPONSE) onRepondre();
    poser(0, true);
    if (g.long || g.glisse) { const bloque = (ev) => { ev.preventDefault(); ev.stopPropagation(); }; document.addEventListener("click", bloque, { capture: true, once: true }); setTimeout(() => document.removeEventListener("click", bloque, { capture: true }), 400); }
    geste.current = null;
  };
  return (
    <div className={`msg-rang${mien ? " mien" : ""}${suite ? " suite" : ""}`} id={`m-${mid}`}
      onPointerDown={debut} onPointerMove={bouge} onPointerUp={fin} onPointerCancel={fin}
      onContextMenu={(e) => { e.preventDefault(); if (!geste.current?.long) onMenu(); }}
      onDoubleClick={onMenu}>
      {!mien && groupe && (
        <span className="msg-rang-avatar">{!suite && auteur && <Avatar profil={{ prenom: auteur.prenom, nom: auteur.nom, photo: auteur.photo_url }} className="com-avatar" />}</span>
      )}
      <span className={`msg-glisse-reponse${decal >= SEUIL_REPONSE ? " pret" : ""}`} style={{ opacity: Math.min(1, decal / SEUIL_REPONSE) }} aria-hidden><Reply size={16} /></span>
      <div className="msg-bulle-menu" ref={bulle} style={{ transform: decal ? `translateX(${decal}px)` : undefined }}>
        {enfants}
      </div>
    </div>
  );
}

export default function Conversation({ id, moi }) {
  const routeur = useRouter();
  const [conv, setConv] = useState(null);
  const [messages, setMessages] = useState(null);
  const [debut, setDebut] = useState(false);
  const [texte, setTexte] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [menu, setMenu] = useState(false);
  const [panneau, setPanneau] = useState(null);   // "membres" | "renommer" | "ajouter" | "infos" | "transfert" | "sondage"
  const [nom, setNom] = useState("");
  const [description, setDescription] = useState("");
  const [carnet, setCarnet] = useState(null);
  const [ajout, setAjout] = useState([]);
  const [souci, setSouci] = useState("");
  const [toast, setToast] = useState("");
  const [menuMsg, setMenuMsg] = useState(null);
  const [plusEmojis, setPlusEmojis] = useState(false);
  const [reponseA, setReponseA] = useState(null);
  const [edition, setEdition] = useState(null);
  const [reactions, setReactions] = useState({});
  const [lectures, setLectures] = useState({});
  const [frappe, setFrappe] = useState(null);
  const [enregistrement, setEnregistrement] = useState(null);
  const [secondes, setSecondes] = useState(0);
  const [maintenant, setMaintenant] = useState(0);
  const [nouveaux, setNouveaux] = useState(0);
  const [blocages, setBlocages] = useState([]);      // ids que J'AI bloqués
  const [epingle, setEpingle] = useState(null);      // le message épinglé (objet)
  const [sondages, setSondages] = useState({});      // id → sondage
  const [votes, setVotes] = useState({});            // sondageId → [{membre, choix}]
  const [joindreMenu, setJoindreMenu] = useState(false);
  const [aTransferer, setATransferer] = useState(null);
  const [convs, setConvs] = useState(null);          // pour le transfert
  const [sondageForm, setSondageForm] = useState({ question: "", choix: ["", ""], multiple: false });
  const [photoGroupe, setPhotoGroupe] = useState(null);
  const enBas = useRef(true);
  const bas = useRef(null);
  const champ = useRef(null);
  const mentions = useMentions(texte, setTexte, champ);
  const [annuaire, setAnnuaire] = useState({});
  useEffect(() => { carnetMembres().then((l) => setAnnuaire(Object.fromEntries(l.map((m) => [m.id, m])))).catch(() => {}); }, []);
  const fichierRef = useRef(null);
  const pdfRef = useRef(null);
  const photoGroupeRef = useRef(null);
  const [piece, setPiece] = useState(null);      // { type, fichier, url, duree } ou { type: "photos", fichiers: [{fichier, url}] }
  const [urls, setUrls] = useState({});
  const enregistreur = useRef(null);
  const frappeRef = useRef({ canal: null, dernier: 0, minuteur: null });
  const signale = (m) => { setToast(m); setTimeout(() => setToast(""), 2600); };
  useClicDehors(menu, (e) => !!e.target.closest?.(".msg-menu"), () => setMenu(false));
  useClicDehors(menuMsg !== null, (e) => !!e.target.closest?.(".msg-bulle-liste"), () => { setMenuMsg(null); setPlusEmojis(false); });
  useClicDehors(joindreMenu, (e) => !!e.target.closest?.(".msg-joindre-conteneur"), () => setJoindreMenu(false));

  const membres = useMemo(() => (conv?.membres ?? []).map((m) => m.profil).filter(Boolean), [conv]);
  const parId = useMemo(() => Object.fromEntries(membres.map((m) => [m.id, m])), [membres]);
  const moiMembre = useMemo(() => (conv?.membres ?? []).find((m) => m.membre === moi.id), [conv, moi.id]);
  const vue = conv ? { ...conv, membres: membres.filter((m) => m.id !== moi.id) } : null;
  const anime = conv?.type === "groupe" && conv?.cree_par === moi.id;
  const autre = vue?.type === "duo" ? vue.membres[0] : null;
  const bloqueParMoi = !!autre && blocages.includes(autre.id);
  const descendre = (doux = false) => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: doux ? "smooth" : "instant" });
  const doitDescendre = useRef(null);
  useEffect(() => {
    if (!doitDescendre.current || !messages) return;
    const mode = doitDescendre.current; doitDescendre.current = null;
    descendre(mode === "smooth");
    const t = setTimeout(() => descendre(mode === "smooth"), 350);
    return () => clearTimeout(t);
  }, [messages]);

  useEffect(() => {
    const verif = () => {
      const b = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 140;
      enBas.current = b;
      if (b) setNouveaux(0);
    };
    verif();
    window.addEventListener("scroll", verif, { passive: true });
    return () => window.removeEventListener("scroll", verif);
  }, []);

  // brouillon : gardé par conversation, restitué au retour, effacé à l'envoi
  useEffect(() => {
    let initial = "";
    try {
      const b = localStorage.getItem(cleBrouillon(id));
      const citer = new URLSearchParams(window.location.search).get("citer");
      if (citer) { initial = `« ${citer.slice(0, 200)} »
`; window.history.replaceState(null, "", window.location.pathname); }
      else if (b) initial = b;
    } catch { /* stockage indisponible */ }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (initial) setTexte(initial);
  }, [id]);
  useEffect(() => {
    if (edition) return;
    try { if (texte.trim()) localStorage.setItem(cleBrouillon(id), texte); else localStorage.removeItem(cleBrouillon(id)); } catch { /* idem */ }
  }, [texte, id, edition]);

  const signer = async (liste) => {
    const manquants = [...new Set((liste ?? []).filter((m) => m.fichier_chemin && m.fichier_type !== "lien" && !m.fichier_expiree && !urls[m.fichier_chemin]).map((m) => m.fichier_chemin))];
    if (!manquants.length) return;
    const nouvelles = await urlsPieces(manquants);
    setUrls((u) => ({ ...u, ...nouvelles }));
  };
  const chargerReactions = async (liste) => {
    const ids = (liste ?? []).map((m) => m.id);
    if (!ids.length) return;
    const r = await reactionsDe(ids);
    setReactions((prev) => {
      const n = { ...prev };
      for (const i of ids) n[i] = [];
      for (const x of r) (n[x.message_id] ??= []).push({ membre: x.membre, emoji: x.emoji });
      return n;
    });
  };
  const chargerSondages = async (liste) => {
    const ids = [...new Set((liste ?? []).map((m) => m.sondage_id).filter(Boolean))].filter((i) => !sondages[i]);
    if (!ids.length) return;
    const r = await lireSondages(ids);
    setSondages((s) => ({ ...s, ...r.sondages }));
    setVotes((v) => ({ ...v, ...r.votes }));
  };
  const chargerEpingle = async (c, liste) => {
    if (!c?.message_epingle) { setEpingle(null); return; }
    const local = (liste ?? []).find((m) => m.id === c.message_epingle);
    setEpingle(local ?? (await lireMessage(c.message_epingle)));
  };

  useEffect(() => {
    let vivant = true;
    (async () => {
      try {
        const [c, m, b] = await Promise.all([lireConversation(id), chargerMessages(id), mesBlocages().catch(() => [])]);
        if (!vivant) return;
        if (!c) { setSouci("Cette conversation n'existe pas, ou tu n'en fais pas partie."); setMessages([]); return; }
        setConv(c); setMessages(m); setDebut(m.length < 50); setBlocages(b);
        setLectures(Object.fromEntries((c.membres ?? []).map((x) => [x.membre, x.lu_le])));
        signer(m); chargerReactions(m); chargerSondages(m); chargerEpingle(c, m);
        marquerLu(id); memoire.ecrire("messages.liste", null);
        doitDescendre.current = "instant";
      } catch (e) { if (vivant) { setSouci(e.message ?? "Erreur"); setMessages([]); } }
    })();
    const stops = [
      ecouterMessages(id, {
        surInsertion: (m) => {
          setMessages((l) => (l && !l.some((x) => x.id === m.id) ? [...l, m] : l));
          signer([m]); chargerSondages([m]);
          if (m.auteur !== moi.id) { marquerLu(id); memoire.ecrire("messages.liste", null); setFrappe(null); }
          if (m.auteur === moi.id || enBas.current) doitDescendre.current = "smooth";
          else setNouveaux((n) => n + 1);
        },
        surSuppression: (mid) => setMessages((l) => (l ? l.filter((x) => x.id !== mid) : l)),
      }),
      ecouterModifications(id, (m) => setMessages((l) => (l ? l.map((x) => (x.id === m.id ? { ...x, ...m } : x)) : l))),
      ecouterLecture(id, (x) => setLectures((p) => ({ ...p, [x.membre]: x.lu_le }))),
      ecouterReactions((p) => {
        const mid = p.new?.message_id ?? p.old?.message_id;
        const qui = p.new?.membre ?? p.old?.membre;
        if (!mid) return;
        setReactions((prev) => {
          if (!(mid in prev)) return prev;
          const sans = (prev[mid] ?? []).filter((r) => r.membre !== qui);
          return { ...prev, [mid]: p.eventType === "DELETE" ? sans : [...sans, { membre: p.new.membre, emoji: p.new.emoji }] };
        });
      }),
      ecouterVotes((p) => {
        const sid = p.new?.sondage_id ?? p.old?.sondage_id;
        const qui = p.new?.membre ?? p.old?.membre;
        if (!sid) return;
        setVotes((prev) => {
          const sans = (prev[sid] ?? []).filter((v) => v.membre !== qui);
          return { ...prev, [sid]: p.eventType === "DELETE" ? sans : [...sans, { membre: p.new.membre, choix: p.new.choix }] };
        });
      }),
    ];
    const f = canalFrappe(id, (p) => {
      if (!p || p.membre === moi.id) return;
      setFrappe({ prenom: p.prenom ?? "Quelqu'un" });
      clearTimeout(frappeRef.current.minuteur);
      frappeRef.current.minuteur = setTimeout(() => setFrappe(null), 3500);
    });
    frappeRef.current.canal = f;
    const refFrappe = frappeRef.current;
    return () => { vivant = false; stops.forEach((s) => s()); f.arreter(); clearTimeout(refFrappe.minuteur); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  useEffect(() => {
    if (!enregistrement) return;
    const i = setInterval(() => setSecondes(Math.min(VOCAL_SECONDES, Math.round((Date.now() - enregistrement.debut) / 1000))), 500);
    return () => { clearInterval(i); setSecondes(0); };
  }, [enregistrement]);

  const plusAncien = async () => {
    if (!messages?.length || debut) return;
    const avant = messages[0].cree_le;
    const h = document.documentElement.scrollHeight;
    const anciens = await chargerMessages(id, { avant });
    signer(anciens); chargerReactions(anciens); chargerSondages(anciens);
    setMessages((l) => [...anciens, ...l]);
    setDebut(anciens.length < 50);
    requestAnimationFrame(() => window.scrollBy({ top: document.documentElement.scrollHeight - h, behavior: "instant" }));
  };

  const surSaisie = (e) => {
    mentions.surChangement(e);
    const t = Date.now();
    if (t - frappeRef.current.dernier > 2000 && e.target.value.trim()) {
      frappeRef.current.dernier = t;
      frappeRef.current.canal?.signaler({ membre: moi.id, prenom: moi.prenom, conversation_id: id });
    }
  };

  // ---- pièces jointes (plusieurs photos d'un coup, une vidéo, un PDF) ----
  const choisirPiece = (e) => {
    const fichiers = Array.from(e.target.files ?? []);
    e.target.value = "";
    setJoindreMenu(false);
    if (!fichiers.length) return;
    setSouci("");
    const images = fichiers.filter((f) => f.type.startsWith("image/"));
    if (images.length > 1) { setPiece({ type: "photos", fichiers: images.slice(0, 10).map((f) => ({ fichier: f, url: URL.createObjectURL(f) })) }); return; }
    const f = fichiers[0];
    if (f.type.startsWith("image/")) { setPiece({ type: "photo", fichier: f, url: URL.createObjectURL(f) }); return; }
    if (f.type === "application/pdf") {
      if (f.size > PIECE_PDF_MO * 1048576) { signale(`PDF trop lourd (${tailleLisible(f.size)}). ${PIECE_PDF_MO} Mo au maximum.`); return; }
      setPiece({ type: "pdf", fichier: f }); return;
    }
    if (f.type.startsWith("video/")) {
      if (f.size > PIECE_VIDEO_MO * 1048576) { signale(`Vidéo trop lourde (${tailleLisible(f.size)}). ${PIECE_VIDEO_MO} Mo au maximum.`); return; }
      const url = URL.createObjectURL(f);
      const v = document.createElement("video");
      v.preload = "metadata";
      v.onloadedmetadata = () => {
        if (v.duration > PIECE_VIDEO_SECONDES + 0.5) { signale(`Vidéo trop longue (${Math.round(v.duration)} s). ${PIECE_VIDEO_SECONDES} secondes au maximum.`); URL.revokeObjectURL(url); return; }
        setPiece({ type: "video", fichier: f, url, duree: Math.round(v.duration) });
      };
      v.onerror = () => { signale("Cette vidéo ne peut pas être lue ici."); URL.revokeObjectURL(url); };
      v.src = url;
      return;
    }
    signale("Photo, vidéo ou PDF seulement.");
  };
  const retirerPiece = () => {
    if (piece?.url) URL.revokeObjectURL(piece.url);
    if (piece?.type === "photos") piece.fichiers.forEach((p) => URL.revokeObjectURL(p.url));
    setPiece(null);
  };

  const demarrerVocal = async () => {
    try {
      const flux = await navigator.mediaDevices.getUserMedia({ audio: true });
      const type = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((t) => window.MediaRecorder?.isTypeSupported?.(t)) || "";
      const rec = new MediaRecorder(flux, type ? { mimeType: type } : undefined);
      const morceaux = [];
      const debutEnr = Date.now();
      rec.ondataavailable = (e) => { if (e.data.size) morceaux.push(e.data); };
      rec.onstop = () => {
        flux.getTracks().forEach((t) => t.stop());
        const mime = rec.mimeType || type || "audio/webm";
        const ext = mime.includes("mp4") ? "m4a" : mime.includes("ogg") ? "ogg" : "webm";
        const blob = new Blob(morceaux, { type: mime });
        const fichier = new File([blob], `vocal.${ext}`, { type: mime });
        setPiece({ type: "audio", fichier, url: URL.createObjectURL(blob), duree: Math.round((Date.now() - debutEnr) / 1000) });
        setEnregistrement(null);
        enregistreur.current = null;
      };
      rec.start(250);
      enregistreur.current = { rec, limite: setTimeout(() => rec.state === "recording" && rec.stop(), VOCAL_SECONDES * 1000) };
      setEnregistrement({ debut: debutEnr });
    } catch { signale("Micro indisponible ou refusé."); }
  };
  const arreterVocal = () => { const r = enregistreur.current; if (r) { clearTimeout(r.limite); if (r.rec.state === "recording") r.rec.stop(); } };

  const annulerSaisie = () => { setReponseA(null); setEdition(null); setTexte(""); mentions.vider(); try { localStorage.removeItem(cleBrouillon(id)); } catch { /* idem */ } };

  const envoyer = async (e) => {
    e.preventDefault();
    if ((!texte.trim() && !piece) || envoi) return;
    setEnvoi(true);
    try {
      if (edition) {
        const m = await modifierMessage(edition.id, texte, mentions.idsPour(texte));
        setMessages((l) => l.map((x) => (x.id === m.id ? { ...x, ...m } : x)));
      } else if (piece?.type === "photos") {
        // un message par photo, le texte avec la première
        let premier = true;
        for (const p of piece.fichiers) {
          const jointe = await televerserPiece(id, { type: "photo", fichier: p.fichier });
          const m = await envoyerMessage(id, premier ? texte : "", premier ? mentions.idsPour(texte) : [], jointe, premier ? (reponseA?.id ?? null) : null);
          premier = false;
          setMessages((l) => (l && !l.some((x) => x.id === m.id) ? [...l, m] : l));
          signer([m]); setReactions((r) => ({ ...r, [m.id]: [] }));
        }
        retirerPiece();
        doitDescendre.current = "smooth";
      } else {
        const jointe = piece ? await televerserPiece(id, piece) : null;
        const m = await envoyerMessage(id, texte, mentions.idsPour(texte), jointe, reponseA?.id ?? null);
        setMessages((l) => (l && !l.some((x) => x.id === m.id) ? [...l, m] : l));
        signer([m]); setReactions((p) => ({ ...p, [m.id]: [] }));
        retirerPiece();
        doitDescendre.current = "smooth";
      }
      annulerSaisie(); memoire.ecrire("messages.liste", null);
    } catch (err) { signale("Envoi impossible : " + (err.message ?? "")); }
    setEnvoi(false);
  };

  const retour = () => { if (peutRevenir()) routeur.back(); else routeur.push("/messages"); };

  const agir = async (action) => {
    setMenu(false); setSouci("");
    try {
      if (action === "membres") setPanneau("membres");
      if (action === "infos") { setNom(conv.nom ?? ""); setDescription(conv.description ?? ""); setPhotoGroupe(null); setPanneau("infos"); }
      if (action === "ajouter") { setPanneau("ajouter"); setAjout([]); if (!carnet) setCarnet(await membresJoignables()); }
      if (action === "sourdine") { const muet = !moiMembre?.muet; await reglerConversation(id, { muet }); setConv(await lireConversation(id)); memoire.ecrire("messages.liste", null); signale(muet ? "Conversation en sourdine" : "Notifications rétablies"); }
      if (action === "epingle") { const ep = !moiMembre?.epingle; await reglerConversation(id, { epingle: ep }); setConv(await lireConversation(id)); memoire.ecrire("messages.liste", null); signale(ep ? "Épinglée en haut de la liste" : "Désépinglée"); }
      if (action === "bloquer" && autre) {
        if (bloqueParMoi) { await debloquer(autre.id); setBlocages((b) => b.filter((x) => x !== autre.id)); signale(`${autre.prenom} débloqué·e`); }
        else {
          if (!confirm(`Bloquer ${autre.prenom} ? Plus de conversation possible entre vous.`)) return;
          await bloquer(autre.id); setBlocages((b) => [...b, autre.id]); signale(`${autre.prenom} bloqué·e`);
        }
      }
      if (action === "quitter") {
        if (!confirm("Quitter ce groupe ?")) return;
        await retirerMembre(id, moi.id); memoire.ecrire("messages.liste", null); routeur.replace("/messages");
      }
      if (action === "supprimer") {
        if (!confirm("Supprimer ce groupe pour tout le monde ? Les messages seront perdus.")) return;
        await supprimerGroupe(id); memoire.ecrire("messages.liste", null); routeur.replace("/messages");
      }
    } catch (e) { signale("Action impossible : " + (e.message ?? "")); }
  };
  const validerInfos = async () => {
    try {
      const champs = { nom: nom.trim() || conv.nom, description: description.trim() || null };
      if (photoGroupe) champs.photo_url = await televerserPhotoGroupe(id, photoGroupe);
      await majGroupe(id, champs);
      if (champs.nom !== conv.nom) await renommerGroupe(id, champs.nom);
      setConv(await lireConversation(id)); setPanneau(null); memoire.ecrire("messages.liste", null); signale("Groupe mis à jour");
    } catch (e) { signale("Impossible d'enregistrer : " + (e.message ?? "")); }
  };
  const validerAjout = async () => {
    try { await ajouterMembres(id, ajout); setConv(await lireConversation(id)); setPanneau(null); signale(`${ajout.length} membre${ajout.length > 1 ? "s" : ""} ajouté${ajout.length > 1 ? "s" : ""}`); }
    catch (e) { signale("Impossible d'ajouter : " + (e.message ?? "")); }
  };
  const retirer = async (m) => {
    if (!confirm(`Retirer ${m.prenom} du groupe ?`)) return;
    try { await retirerMembre(id, m.id); setConv(await lireConversation(id)); }
    catch (e) { signale("Impossible de retirer : " + (e.message ?? "")); }
  };
  const validerSondage = async () => {
    const choix = sondageForm.choix.map((c) => c.trim()).filter(Boolean);
    if (!sondageForm.question.trim() || choix.length < 2) { signale("Une question et au moins deux choix."); return; }
    try {
      const m = await creerSondage(id, sondageForm.question, choix, sondageForm.multiple);
      setMessages((l) => (l && !l.some((x) => x.id === m.id) ? [...l, m] : l));
      chargerSondages([m]); setReactions((p) => ({ ...p, [m.id]: [] }));
      setPanneau(null); setSondageForm({ question: "", choix: ["", ""], multiple: false });
      doitDescendre.current = "smooth"; memoire.ecrire("messages.liste", null);
    } catch (e) { signale("Sondage impossible : " + (e.message ?? "")); }
  };

  // ---- actions sur une bulle ----
  const fermerMenuMsg = () => { setMenuMsg(null); setPlusEmojis(false); };
  // eslint-disable-next-line react-hooks/purity
  const ouvrirMenuMsg = (mid) => { setMaintenant(Date.now()); setPlusEmojis(false); setMenuMsg(mid); window.getSelection?.()?.removeAllRanges(); };
  const effacer = async (m) => {
    fermerMenuMsg();
    if (!confirm("Supprimer ce message ?")) return;
    try { await supprimerMessage(m.id); setMessages((l) => l.filter((x) => x.id !== m.id)); }
    catch (e) { signale("Impossible de supprimer : " + (e.message ?? "")); }
  };
  const repondre = (m) => { fermerMenuMsg(); setEdition(null); setReponseA(m); champ.current?.focus(); };
  const modifier = (m) => { fermerMenuMsg(); setReponseA(null); setEdition(m); setTexte(m.texte ?? ""); mentions.reprendre((m.mentions ?? []).map((x) => parId[x] ?? annuaire[x]).filter(Boolean)); champ.current?.focus(); };
  const reaction = async (m, emoji) => {
    fermerMenuMsg();
    const mienne = (reactions[m.id] ?? []).find((r) => r.membre === moi.id)?.emoji;
    const nouvelle = mienne === emoji ? null : emoji;
    setReactions((p) => ({ ...p, [m.id]: [...(p[m.id] ?? []).filter((r) => r.membre !== moi.id), ...(nouvelle ? [{ membre: moi.id, emoji: nouvelle }] : [])] }));
    try { await reagir(m.id, nouvelle); }
    catch { setReactions((p) => ({ ...p, [m.id]: (p[m.id] ?? []).filter((r) => r.membre !== moi.id) })); signale("Réaction impossible pour l'instant."); }
  };
  const modifiable = (m) => m.auteur === moi.id && !m.fichier_chemin && !m.sondage_id && maintenant - new Date(m.cree_le).getTime() < MODIF_MINUTES * 60000;
  const epinglerMsg = async (m) => {
    fermerMenuMsg();
    try {
      const retirerEp = epingle?.id === m.id;
      await epinglerMessage(id, retirerEp ? null : m.id);
      setEpingle(retirerEp ? null : m); setConv((c) => ({ ...c, message_epingle: retirerEp ? null : m.id }));
      signale(retirerEp ? "Message désépinglé" : "Message épinglé en haut");
    } catch (e) { signale("Impossible d'épingler : " + (e.message ?? "")); }
  };
  const signalerMsg = async (m) => {
    fermerMenuMsg();
    if (!confirm("Signaler ce message aux modérateurs ?")) return;
    try { await signalerMessage(m, nomDe(m.auteur)); signale("Merci, les modérateurs sont prévenus."); }
    catch (e) { signale("Signalement impossible : " + (e.message ?? "")); }
  };
  const transferer = async (m) => { fermerMenuMsg(); setATransferer(m); setPanneau("transfert"); if (!convs) setConvs(await mesConversations().catch(() => [])); };
  const validerTransfert = async (c) => {
    try { await transfererMessage(aTransferer, c.id); setPanneau(null); setATransferer(null); signale(`Transféré à ${nomConversation(c)}`); }
    catch (e) { signale("Transfert impossible : " + (e.message ?? "")); }
  };
  const repondreEnPrive = async (m) => {
    fermerMenuMsg();
    try { const cid = await ouvrirDuo(m.auteur); routeur.push(`/messages/${cid}?citer=${encodeURIComponent(m.texte?.trim() ? m.texte.slice(0, 200) : libellePiece(m))}`); }
    catch (e) { signale("Impossible : " + (e.message ?? "")); }
  };
  const allerA = (mid) => {
    const el = document.getElementById(`m-${mid}`);
    if (!el) { signale("Ce message n'est plus dans la conversation chargée."); return; }
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    const b = el.querySelector(".msg-bulle"); b?.classList.add("cible"); setTimeout(() => b?.classList.remove("cible"), 1800);
  };

  const autres = useMemo(() => membres.filter((m) => m.id !== moi.id), [membres, moi.id]);
  const estLu = (m) => autres.length > 0 && autres.every((x) => lectures[x.id] && new Date(lectures[x.id]) >= new Date(m.cree_le));
  const estLuParUn = (m) => autres.some((x) => lectures[x.id] && new Date(lectures[x.id]) >= new Date(m.cree_le));
  const parIdMsg = useMemo(() => Object.fromEntries((messages ?? []).map((m) => [m.id, m])), [messages]);
  const nomDe = (uid) => (uid === moi.id ? "Toi" : (parId[uid] ?? annuaire[uid])?.prenom ?? "Membre");
  const majChoix = (i, v) => setSondageForm((f) => { const c = [...f.choix]; c[i] = v; return { ...f, choix: c }; });

  return (
    <div className="msg-page">
      <header className="msg-tete">
        <button type="button" className="cp-fermer" onClick={retour} aria-label="Retour"><ArrowLeft size={20} aria-hidden /></button>
        {vue && (
          autre ? (
            <Link href={`/profil/${autre.id}`} className="msg-tete-qui">
              <Avatar profil={{ prenom: autre.prenom, nom: autre.nom, photo: autre.photo_url }} className="pub-avatar" />
              <span><b>{nomConversation(vue)}</b><small className={frappe ? "msg-frappe" : ""}>{frappe ? "écrit…" : bloqueParMoi ? "bloqué·e" : "voir le profil"}</small></span>
            </Link>
          ) : (
            <button type="button" className="msg-tete-qui" onClick={() => agir("membres")}>
              {vue.photo_url ? <img src={vue.photo_url} alt="" className="msg-vignette" /> : <span className="msg-vignette groupe petite" aria-hidden><Users size={16} strokeWidth={1.9} /></span>}
              <span><b>{nomConversation(vue)}</b><small className={frappe ? "msg-frappe" : ""}>{frappe ? `${frappe.prenom} écrit…` : `${membres.length} membres · voir`}</small></span>
            </button>
          )
        )}
        {!vue && <span className="cp-titre">Conversation</span>}
        {vue && (
          <span className="msg-menu">
            <button type="button" className="pub-plus" aria-label="Options" onClick={() => setMenu(!menu)}><MoreHorizontal size={20} aria-hidden /></button>
            {menu && (
              <span className="pub-menu-liste">
                <button type="button" onClick={() => agir("epingle")}>{moiMembre?.epingle ? <><PinOff size={15} aria-hidden /> Désépingler</> : <><Pin size={15} aria-hidden /> Épingler en haut</>}</button>
                <button type="button" onClick={() => agir("sourdine")}>{moiMembre?.muet ? <><Bell size={15} aria-hidden /> Rétablir les notifications</> : <><BellOff size={15} aria-hidden /> Mettre en sourdine</>}</button>
                {vue.type === "groupe" && <button type="button" onClick={() => agir("membres")}><Users size={15} aria-hidden /> Membres</button>}
                {vue.type === "groupe" && <button type="button" onClick={() => agir("infos")}><Info size={15} aria-hidden /> {anime ? "Photo, nom, description" : "Infos du groupe"}</button>}
                {anime && <button type="button" onClick={() => agir("ajouter")}><UserPlus size={15} aria-hidden /> Ajouter des membres</button>}
                {autre && <button type="button" className={bloqueParMoi ? "" : "danger"} onClick={() => agir("bloquer")}><Ban size={15} aria-hidden /> {bloqueParMoi ? `Débloquer ${autre.prenom}` : `Bloquer ${autre.prenom}`}</button>}
                {vue.type === "groupe" && <button type="button" onClick={() => agir("quitter")}><LogOut size={15} aria-hidden /> Quitter le groupe</button>}
                {vue.type === "groupe" && (anime || moi.role === "admin") && <button type="button" className="danger" onClick={() => agir("supprimer")}><Trash2 size={15} aria-hidden /> Supprimer le groupe</button>}
              </span>
            )}
          </span>
        )}
      </header>
      {vue?.type === "groupe" && vue.description && <p className="msg-description">{vue.description}</p>}

      {epingle && (
        <div className="msg-epingle" role="button" tabIndex={0} onClick={() => allerA(epingle.id)} onKeyDown={(e) => e.key === "Enter" && allerA(epingle.id)}>
          <Pin size={15} aria-hidden />
          <span><small>Message épinglé · {nomDe(epingle.auteur)}</small>{epingle.texte?.trim() ? epingle.texte : libellePiece({ ...epingle, sondage: sondages[epingle.sondage_id]?.question })}</span>
          <button type="button" onClick={(e) => { e.stopPropagation(); epinglerMsg(epingle); }} aria-label="Désépingler"><X size={14} aria-hidden /></button>
        </div>
      )}

      <div className="msg-zone">
        {messages === null && <p className="pu-vide">Chargement…</p>}
        {messages && !debut && <button type="button" className="btn btn-nu msg-plus" onClick={plusAncien}>Messages plus anciens</button>}
        {messages?.length === 0 && !souci && <p className="pu-vide">Personne n&apos;a encore écrit. À toi.</p>}
        {souci && <p className="pu-vide">{souci}</p>}
        {messages?.map((m, i) => {
          const mien = m.auteur === moi.id;
          const prec = messages[i - 1];
          const nouveauJour = !prec || new Date(prec.cree_le).toDateString() !== new Date(m.cree_le).toDateString();
          const suite = prec && prec.auteur === m.auteur && !nouveauJour && new Date(m.cree_le) - new Date(prec.cree_le) < 5 * 60000;
          const a = parId[m.auteur];
          const lu = mien && estLu(m);
          const luUn = mien && !lu && estLuParUn(m);
          return (
            <div key={m.id}>
              {nouveauJour && <div className="msg-jour"><span>{jour(m.cree_le)}</span></div>}
              <Rang mid={m.id} mien={mien} suite={suite} groupe={conv?.type === "groupe"} auteur={a}
                onMenu={() => ouvrirMenuMsg(m.id)} onRepondre={() => repondre(m)}
                enfants={<>
                  <div className={`msg-bulle${mien ? " mienne" : ""}`}>
                    {!mien && conv?.type === "groupe" && !suite && <b className="msg-auteur">{a ? a.prenom : "Membre"}</b>}
                    {m.reponse_a && <Citation c={parIdMsg[m.reponse_a]} nom={parIdMsg[m.reponse_a] ? nomDe(parIdMsg[m.reponse_a].auteur) : ""} />}
                    <Piece m={m} url={urls[m.fichier_chemin]} mienne={mien} />
                    {m.sondage_id && <Sondage sondage={sondages[m.sondage_id]} votes={votes[m.sondage_id] ?? []} moiId={moi.id} nomDe={nomDe}
                      onMaj={(choix) => setVotes((v) => ({ ...v, [m.sondage_id]: [...(v[m.sondage_id] ?? []).filter((x) => x.membre !== moi.id), ...(choix.length ? [{ membre: moi.id, choix }] : [])] }))} />}
                    {m.texte?.trim() && <p><TexteMentions texte={m.texte} mentions={(m.mentions ?? []).map((x) => parId[x] ?? annuaire[x]).filter(Boolean)} /></p>}
                    <time>
                      {m.modifie_le && <em>modifié · </em>}{heure(m.cree_le)}
                      {mien && (lu ? <CheckCheck size={14} className="msg-coches lu" aria-label="Lu" /> : luUn ? <CheckCheck size={14} className="msg-coches" aria-label="Lu par une partie" /> : <Check size={14} className="msg-coches" aria-label="Envoyé" />)}
                    </time>
                  </div>
                  <Reactions liste={reactions[m.id]} moiId={moi.id} nomDe={nomDe} mienne={mien} onTap={(e) => reaction(m, e)} />
                  {menuMsg === m.id && (
                    <span className="pub-menu-liste msg-bulle-liste" onPointerDown={(e) => e.stopPropagation()}>
                      <span className="msg-emojis">
                        {EMOJIS.map((e) => <button key={e} type="button" className={(reactions[m.id] ?? []).some((r) => r.membre === moi.id && r.emoji === e) ? "on" : ""} onClick={() => reaction(m, e)} aria-label={`Réagir ${e}`}>{e}</button>)}
                        <button type="button" className={`msg-emojis-plus${plusEmojis ? " on" : ""}`} onClick={() => setPlusEmojis(!plusEmojis)} aria-label={plusEmojis ? "Moins d'emoji" : "Plus d'emoji"} aria-expanded={plusEmojis}>{plusEmojis ? <Minus size={16} aria-hidden /> : <Plus size={16} aria-hidden />}</button>
                      </span>
                      {plusEmojis && (
                        <span className="msg-emojis-grille">
                          {EMOJIS_PLUS.map((e) => <button key={e} type="button" className={(reactions[m.id] ?? []).some((r) => r.membre === moi.id && r.emoji === e) ? "on" : ""} onClick={() => reaction(m, e)} aria-label={`Réagir ${e}`}>{e}</button>)}
                        </span>
                      )}
                      <button type="button" onClick={() => repondre(m)}><Reply size={14} aria-hidden /> Répondre</button>
                      {!mien && conv?.type === "groupe" && <button type="button" onClick={() => repondreEnPrive(m)}><MessageSquare size={14} aria-hidden /> Répondre en privé</button>}
                      <button type="button" onClick={() => transferer(m)}><Forward size={14} aria-hidden /> Transférer</button>
                      <button type="button" onClick={() => epinglerMsg(m)}><Pin size={14} aria-hidden /> {epingle?.id === m.id ? "Désépingler" : "Épingler en haut"}</button>
                      {modifiable(m) && <button type="button" onClick={() => modifier(m)}><Pencil size={14} aria-hidden /> Modifier</button>}
                      {!mien && <button type="button" onClick={() => signalerMsg(m)}><Flag size={14} aria-hidden /> Signaler</button>}
                      {(mien || moi.role === "admin") && <button type="button" className="danger" onClick={() => effacer(m)}><Trash2 size={14} aria-hidden /> Supprimer</button>}
                    </span>
                  )}
                </>}
              />
            </div>
          );
        })}
        <div ref={bas} />
      </div>

      {nouveaux > 0 && (
        <button type="button" className="msg-nouveaux" onClick={() => { descendre(true); setNouveaux(0); }}>
          <ArrowDown size={14} aria-hidden /> {nouveaux} nouveau{nouveaux > 1 ? "x" : ""} message{nouveaux > 1 ? "s" : ""}
        </button>
      )}

      {bloqueParMoi ? (
        <div className="msg-saisie" style={{ alignItems: "center", textAlign: "center", fontSize: 13, color: "var(--texte-2)" }}>
          Tu as bloqué {autre.prenom}. <button type="button" className="btn btn-nu" style={{ padding: "8px 12px", fontSize: 12 }} onClick={() => agir("bloquer")}>Débloquer</button>
        </div>
      ) : (
      <form className="msg-saisie" onSubmit={envoyer}>
        <SuggestionsMention suggestions={mentions.suggestions} choisir={mentions.choisir} className="mention-liste-haut" />
        {(reponseA || edition) && (
          <div className="msg-saisie-contexte">
            {edition
              ? <><Pencil size={13} aria-hidden /> <span>Modification de ton message</span></>
              : <><Reply size={13} aria-hidden /> <span>Réponse à <b>{reponseA.auteur === moi.id ? "toi-même" : nomDe(reponseA.auteur)}</b> : {reponseA.texte?.trim() ? reponseA.texte.slice(0, 60) : libellePiece(reponseA)}</span></>}
            <button type="button" onClick={annulerSaisie} aria-label="Annuler"><X size={14} aria-hidden /></button>
          </div>
        )}
        {piece && (
          <div className="msg-piece-apercu">
            {piece.type === "photo" && <img src={piece.url} alt="" />}
            {piece.type === "photos" && <span className="msg-piece-photos">{piece.fichiers.slice(0, 4).map((p, i) => <img key={i} src={p.url} alt="" />)}</span>}
            {piece.type === "video" && <video src={piece.url} muted playsInline preload="metadata" />}
            {piece.type === "audio" && <LecteurAudio src={piece.url} />}
            {piece.type === "pdf" && <span className="msg-piece-pdf statique"><FileText size={20} strokeWidth={1.7} aria-hidden /><span><b>{piece.fichier.name}</b><small>PDF · {tailleLisible(piece.fichier.size)}</small></span></span>}
            <span className="msg-piece-note">
              {piece.type === "photos" ? `${piece.fichiers.length} photos · réduites avant l'envoi · gardées ${JOURS_PIECE.photo} jours`
                : piece.type === "video" || piece.type === "audio" ? `${piece.duree} s · gardé ${JOURS_PIECE[piece.type]} jours`
                : piece.type === "photo" ? `réduite avant l'envoi · gardée ${JOURS_PIECE.photo} jours` : `gardé ${JOURS_PIECE.pdf} jours`}
            </span>
            <button type="button" className="cp-photo-retirer" onClick={retirerPiece} aria-label="Retirer la pièce jointe"><X size={14} aria-hidden /></button>
          </div>
        )}
        <div className="msg-saisie-ligne">
          {!edition && (
            <span className="msg-joindre-conteneur">
              <button type="button" className="msg-joindre" onClick={() => setJoindreMenu(!joindreMenu)} aria-label="Joindre" aria-expanded={joindreMenu} disabled={envoi || !!enregistrement}>
                <Paperclip size={19} strokeWidth={1.9} aria-hidden />
              </button>
              {joindreMenu && (
                <span className="msg-joindre-menu">
                  <button type="button" onClick={() => fichierRef.current?.click()}><ImageIcone size={16} aria-hidden /> Photos ou vidéo</button>
                  <button type="button" onClick={() => pdfRef.current?.click()}><FileText size={16} aria-hidden /> Document PDF</button>
                  <button type="button" onClick={() => { setJoindreMenu(false); setPanneau("sondage"); }}><BarChart3 size={16} aria-hidden /> Sondage</button>
                </span>
              )}
            </span>
          )}
          <input ref={fichierRef} type="file" accept="image/*,video/*" multiple hidden onChange={choisirPiece} />
          <input ref={pdfRef} type="file" accept="application/pdf" hidden onChange={choisirPiece} />
          {enregistrement ? (
            <div className="msg-enregistre" aria-live="polite">
              <span className="msg-enregistre-point" aria-hidden />
              Enregistrement… {secondes} s / {VOCAL_SECONDES}
            </div>
          ) : (
            <textarea ref={champ} className="saisie" placeholder={edition ? "Nouveau texte…" : piece ? "Un mot avec la pièce jointe ? (facultatif)" : "Écrire un message…"} rows={1} value={texte} maxLength={MESSAGE_MAX}
              onChange={surSaisie}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); envoyer(e); } if (e.key === "Escape") annulerSaisie(); }} />
          )}
          {!texte.trim() && !piece && !edition ? (
            enregistrement
              ? <button type="button" className="com-envoyer msg-stop" onClick={arreterVocal} aria-label="Arrêter et joindre le vocal"><Square size={16} aria-hidden /></button>
              : <button type="button" className="com-envoyer" onClick={demarrerVocal} aria-label="Enregistrer un message vocal"><Mic size={18} aria-hidden /></button>
          ) : (
            <button type="submit" className="com-envoyer" disabled={(!texte.trim() && !piece) || envoi} aria-label={edition ? "Enregistrer" : "Envoyer"}>
              {envoi ? <span className="msg-envoi-attente" aria-hidden /> : edition ? <Check size={18} aria-hidden /> : <Send size={17} aria-hidden />}
            </button>
          )}
        </div>
      </form>
      )}

      {panneau && (
        <div className="fg-scrim msg-voile" role="presentation" onClick={() => setPanneau(null)}>
          <div className="msg-panneau" onClick={(e) => e.stopPropagation()}>
            <div className="msg-panneau-tete">
              <b>{panneau === "membres" ? `${membres.length} membres` : panneau === "infos" ? "Le groupe" : panneau === "ajouter" ? "Ajouter des membres" : panneau === "transfert" ? "Transférer à…" : "Nouveau sondage"}</b>
              <button type="button" className="cp-fermer" onClick={() => setPanneau(null)} aria-label="Fermer"><X size={18} aria-hidden /></button>
            </div>
            {panneau === "membres" && (
              <>
                {vue?.description && <p className="msg-aide" style={{ padding: "0 10px 10px" }}>{vue.description}</p>}
                {membres.map((m) => (
                  <div key={m.id} className="msg-personne statique">
                    <Link href={`/profil/${m.id}`} className="msg-personne-lien">
                      <Avatar profil={{ prenom: m.prenom, nom: m.nom, photo: m.photo_url }} className="pub-avatar" />
                      <span><b>{m.prenom} {m.nom}</b><small>{m.id === conv.cree_par ? "a créé le groupe" : m.id === moi.id ? "toi" : ""}</small></span>
                    </Link>
                    {anime && m.id !== moi.id && <button type="button" className="btn btn-nu msg-retirer" onClick={() => retirer(m)}>Retirer</button>}
                  </div>
                ))}
              </>
            )}
            {panneau === "infos" && (
              <div className="groupe-infos">
                <div className="groupe-infos-photo">
                  {photoGroupe ? <img src={URL.createObjectURL(photoGroupe)} alt="" /> : vue.photo_url ? <img src={vue.photo_url} alt="" /> : <span className="msg-vignette groupe" aria-hidden><Users size={22} /></span>}
                  {anime && <>
                    <button type="button" className="btn btn-nu" style={{ padding: "9px 13px", fontSize: 12.5 }} onClick={() => photoGroupeRef.current?.click()}><Camera size={14} aria-hidden /> {vue.photo_url ? "Changer la photo" : "Ajouter une photo"}</button>
                    <input ref={photoGroupeRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) setPhotoGroupe(f); }} />
                  </>}
                </div>
                {anime ? (
                  <>
                    <input className="saisie" value={nom} maxLength={60} onChange={(e) => setNom(e.target.value)} placeholder="Nom du groupe" />
                    <textarea className="saisie" value={description} maxLength={300} onChange={(e) => setDescription(e.target.value)} placeholder="Description (facultative) : à quoi sert ce groupe, pour qui…" />
                    <button type="button" className="btn btn-or" disabled={!nom.trim()} onClick={validerInfos}>Enregistrer</button>
                  </>
                ) : (
                  <>
                    <b style={{ fontSize: 16 }}>{vue.nom}</b>
                    <p className="msg-aide" style={{ padding: 0 }}>{vue.description || "Pas de description."}</p>
                    <small style={{ color: "var(--brume)", fontSize: 12 }}>Seule la personne qui a créé le groupe peut modifier ces informations.</small>
                  </>
                )}
              </div>
            )}
            {panneau === "ajouter" && (
              <>
                <div className="msg-carnet court">
                  {carnet === null && <p className="pu-vide">Chargement…</p>}
                  {carnet?.filter((m) => !parId[m.id]).map((m) => {
                    const on = ajout.includes(m.id);
                    return (
                      <button key={m.id} type="button" className={`msg-personne${on ? " on" : ""}`} aria-pressed={on}
                        onClick={() => setAjout((l) => (on ? l.filter((x) => x !== m.id) : [...l, m.id]))}>
                        <Avatar profil={{ prenom: m.prenom, nom: m.nom, photo: m.photo_url }} className="pub-avatar" />
                        <span><b>{m.prenom} {m.nom}</b><small>Promo {m.promotions?.numero}</small></span>
                        <span className="msg-coche" aria-hidden>{on && <Check size={14} strokeWidth={2.6} />}</span>
                      </button>
                    );
                  })}
                  {carnet && carnet.filter((m) => !parId[m.id]).length === 0 && <p className="pu-vide">Tout le monde est déjà là.</p>}
                </div>
                <div className="msg-panneau-form">
                  <button type="button" className="btn btn-or" disabled={ajout.length === 0} onClick={validerAjout}>Ajouter {ajout.length > 0 ? `(${ajout.length})` : ""}</button>
                </div>
              </>
            )}
            {panneau === "transfert" && (
              <div className="msg-carnet court">
                {convs === null && <p className="pu-vide">Chargement…</p>}
                {convs?.filter((c) => c.id !== id).map((c) => (
                  <button key={c.id} type="button" className="msg-personne" onClick={() => validerTransfert(c)}>
                    {c.type === "groupe"
                      ? (c.photo_url ? <img src={c.photo_url} alt="" className="pub-avatar" /> : <span className="msg-vignette groupe petite" aria-hidden><Users size={16} /></span>)
                      : <Avatar profil={{ prenom: c.membres?.[0]?.prenom ?? "?", nom: c.membres?.[0]?.nom ?? "", photo: c.membres?.[0]?.photo_url }} className="pub-avatar" />}
                    <span><b>{nomConversation(c)}</b><small>{c.type === "groupe" ? `${c.nb_membres} membres` : "conversation à deux"}</small></span>
                  </button>
                ))}
                {convs && convs.filter((c) => c.id !== id).length === 0 && <p className="pu-vide">Aucune autre conversation.</p>}
              </div>
            )}
            {panneau === "sondage" && (
              <div className="sondage-form">
                <input className="saisie" placeholder="La question" value={sondageForm.question} maxLength={200} onChange={(e) => setSondageForm((f) => ({ ...f, question: e.target.value }))} autoFocus />
                {sondageForm.choix.map((c, i) => (
                  <input key={i} className="saisie" placeholder={`Choix ${i + 1}`} value={c} maxLength={80} onChange={(e) => majChoix(i, e.target.value)} />
                ))}
                {sondageForm.choix.length < 6 && <button type="button" className="btn btn-nu" style={{ padding: "8px 12px", fontSize: 12.5 }} onClick={() => setSondageForm((f) => ({ ...f, choix: [...f.choix, ""] }))}><Plus size={14} aria-hidden /> Un choix de plus</button>}
                <label><input type="checkbox" checked={sondageForm.multiple} onChange={(e) => setSondageForm((f) => ({ ...f, multiple: e.target.checked }))} /> Plusieurs réponses possibles</label>
                <button type="button" className="btn btn-or" onClick={validerSondage}>Envoyer le sondage</button>
              </div>
            )}
          </div>
        </div>
      )}
      <div className={`toast${toast ? " la" : ""}`} role="status">{toast}</div>
    </div>
  );
}
