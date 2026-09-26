"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Send, MoreHorizontal, Users, Trash2, LogOut, Pencil, UserPlus, X, Check, Paperclip, FileText, Play,
  Mic, Square, Reply, BellOff, Bell, Pin, PinOff, Link as LienIcone, CheckCheck,
} from "lucide-react";
import Avatar from "@/components/Avatar";
import useClicDehors from "@/lib/useClicDehors";
import { peutRevenir } from "@/components/SuiviNavigation";
import * as memoire from "@/lib/memoire";
import { useMentions, SuggestionsMention, TexteMentions, carnet as carnetMembres } from "@/lib/mentions";
import {
  lireConversation, chargerMessages, envoyerMessage, modifierMessage, supprimerMessage, marquerLu, ecouterMessages,
  ecouterModifications, ecouterLecture, ecouterReactions, canalFrappe, reactionsDe, reagir, reglerConversation,
  renommerGroupe, ajouterMembres, retirerMembre, supprimerGroupe, membresJoignables,
  televerserPiece, urlsPieces, tailleLisible, libellePiece,
  nomConversation, heure, jour, MESSAGE_MAX, PIECE_VIDEO_SECONDES, PIECE_VIDEO_MO, PIECE_PDF_MO, VOCAL_SECONDES,
  EMOJIS, MODIF_MINUTES, JOURS_PIECE,
} from "@/lib/messages";

// Le fil d'une conversation : bulles (les miennes à droite, en bleu ; les
// autres à gauche, papier, avec le prénom dans les groupes), séparateurs de
// jour, saisie collée en bas, arrivée en temps réel, lecture marquée à
// l'ouverture et à chaque message reçu. Enrichie le 26/09 : pièces jointes,
// vocal, « vu », « … écrit », réponse citée, réactions, sourdine/épingle,
// modification dans les 5 minutes, liens partagés.

export default function Conversation({ id, moi }) {
  const routeur = useRouter();
  const [conv, setConv] = useState(null);
  const [messages, setMessages] = useState(null);
  const [debut, setDebut] = useState(false);      // tout l'historique chargé
  const [texte, setTexte] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [menu, setMenu] = useState(false);
  const [panneau, setPanneau] = useState(null);   // "membres" | "renommer" | "ajouter"
  const [nom, setNom] = useState("");
  const [carnet, setCarnet] = useState(null);
  const [ajout, setAjout] = useState([]);
  const [souci, setSouci] = useState("");
  const [toast, setToast] = useState("");
  const [menuMsg, setMenuMsg] = useState(null);
  const [reponseA, setReponseA] = useState(null);   // message cité
  const [edition, setEdition] = useState(null);     // message en cours de modification
  const [reactions, setReactions] = useState({});   // messageId → [{membre, emoji}]
  const [lectures, setLectures] = useState({});     // membre → lu_le
  const [frappe, setFrappe] = useState(null);       // { prenom } ou null
  const [enregistrement, setEnregistrement] = useState(null); // { debut } pendant un vocal
  const [secondes, setSecondes] = useState(0);      // compteur du vocal en cours
  const [maintenant, setMaintenant] = useState(0);  // figé à l'ouverture d'un menu (« modifiable ? »)
  const bas = useRef(null);
  const zone = useRef(null);
  const champ = useRef(null);
  const mentions = useMentions(texte, setTexte, champ);
  const [annuaire, setAnnuaire] = useState({});   // id → {prenom, nom}, pour les mentions hors conversation
  useEffect(() => { carnetMembres().then((l) => setAnnuaire(Object.fromEntries(l.map((m) => [m.id, m])))).catch(() => {}); }, []);
  const fichierRef = useRef(null);
  const [piece, setPiece] = useState(null);      // { type, fichier, url (aperçu), duree }
  const [urls, setUrls] = useState({});          // chemin → URL signée
  const enregistreur = useRef(null);
  const frappeRef = useRef({ canal: null, dernier: 0, minuteur: null });
  const signale = (m) => { setToast(m); setTimeout(() => setToast(""), 2600); };
  useClicDehors(menu, (e) => !!e.target.closest?.(".msg-menu"), () => setMenu(false));
  useClicDehors(menuMsg !== null, (e) => !!e.target.closest?.(".msg-bulle-menu"), () => setMenuMsg(null));

  const membres = useMemo(() => (conv?.membres ?? []).map((m) => m.profil).filter(Boolean), [conv]);
  const parId = useMemo(() => Object.fromEntries(membres.map((m) => [m.id, m])), [membres]);
  const moiMembre = useMemo(() => (conv?.membres ?? []).find((m) => m.membre === moi.id), [conv, moi.id]);
  const vue = conv ? { ...conv, membres: membres.filter((m) => m.id !== moi.id) } : null;
  const anime = conv?.type === "groupe" && conv?.cree_par === moi.id;
  const descendre = (doux = false) => bas.current?.scrollIntoView({ block: "end", behavior: doux ? "smooth" : "instant" });

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

  // chargement + temps réel (messages, modifications, lectures, réactions, frappe)
  useEffect(() => {
    let vivant = true;
    (async () => {
      try {
        const [c, m] = await Promise.all([lireConversation(id), chargerMessages(id)]);
        if (!vivant) return;
        if (!c) { setSouci("Cette conversation n'existe pas, ou tu n'en fais pas partie."); setMessages([]); return; }
        setConv(c); setMessages(m); setDebut(m.length < 50);
        setLectures(Object.fromEntries((c.membres ?? []).map((x) => [x.membre, x.lu_le])));
        signer(m); chargerReactions(m);
        marquerLu(id); memoire.ecrire("messages.liste", null);
        requestAnimationFrame(() => descendre());
      } catch (e) { if (vivant) { setSouci(e.message ?? "Erreur"); setMessages([]); } }
    })();
    const stops = [
      ecouterMessages(id, {
        surInsertion: (m) => {
          setMessages((l) => (l && !l.some((x) => x.id === m.id) ? [...l, m] : l));
          signer([m]);
          if (m.auteur !== moi.id) { marquerLu(id); memoire.ecrire("messages.liste", null); setFrappe(null); }
          requestAnimationFrame(() => descendre(true));
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
    const h = zone.current?.scrollHeight ?? 0;
    const anciens = await chargerMessages(id, { avant });
    signer(anciens); chargerReactions(anciens);
    setMessages((l) => [...anciens, ...l]);
    setDebut(anciens.length < 50);
    requestAnimationFrame(() => { if (zone.current) zone.current.scrollTop += zone.current.scrollHeight - h; });
  };

  // « … écrit » : au plus un signal toutes les 2 s
  const surSaisie = (e) => {
    mentions.surChangement(e);
    const t = Date.now();
    if (t - frappeRef.current.dernier > 2000 && e.target.value.trim()) {
      frappeRef.current.dernier = t;
      frappeRef.current.canal?.signaler({ membre: moi.id, prenom: moi.prenom });
    }
  };

  // ---- pièces jointes ----
  const choisirPiece = (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setSouci("");
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
  const retirerPiece = () => { if (piece?.url) URL.revokeObjectURL(piece.url); setPiece(null); };

  // ---- message vocal (MediaRecorder ; webm/opus, sinon mp4 sur iPhone) ----
  const demarrerVocal = async () => {
    try {
      const flux = await navigator.mediaDevices.getUserMedia({ audio: true });
      const type = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((t) => window.MediaRecorder?.isTypeSupported?.(t)) || "";
      const rec = new MediaRecorder(flux, type ? { mimeType: type } : undefined);
      const morceaux = [];
      const debut = Date.now();
      rec.ondataavailable = (e) => { if (e.data.size) morceaux.push(e.data); };
      rec.onstop = () => {
        flux.getTracks().forEach((t) => t.stop());
        const mime = rec.mimeType || type || "audio/webm";
        const ext = mime.includes("mp4") ? "m4a" : mime.includes("ogg") ? "ogg" : "webm";
        const blob = new Blob(morceaux, { type: mime });
        const fichier = new File([blob], `vocal.${ext}`, { type: mime });
        setPiece({ type: "audio", fichier, url: URL.createObjectURL(blob), duree: Math.round((Date.now() - debut) / 1000) });
        setEnregistrement(null);
        enregistreur.current = null;
      };
      rec.start(250);
      enregistreur.current = { rec, limite: setTimeout(() => rec.state === "recording" && rec.stop(), VOCAL_SECONDES * 1000) };
      setEnregistrement({ debut });
    } catch { signale("Micro indisponible ou refusé."); }
  };
  const arreterVocal = () => { const r = enregistreur.current; if (r) { clearTimeout(r.limite); if (r.rec.state === "recording") r.rec.stop(); } };

  const annulerSaisie = () => { setReponseA(null); setEdition(null); setTexte(""); mentions.vider(); };

  const envoyer = async (e) => {
    e.preventDefault();
    if ((!texte.trim() && !piece) || envoi) return;
    setEnvoi(true);
    try {
      if (edition) {
        const m = await modifierMessage(edition.id, texte, mentions.idsPour(texte));
        setMessages((l) => l.map((x) => (x.id === m.id ? { ...x, ...m } : x)));
      } else {
        const jointe = piece ? await televerserPiece(id, piece) : null;
        const m = await envoyerMessage(id, texte, mentions.idsPour(texte), jointe, reponseA?.id ?? null);
        setMessages((l) => (l && !l.some((x) => x.id === m.id) ? [...l, m] : l));
        signer([m]); setReactions((p) => ({ ...p, [m.id]: [] }));
        retirerPiece();
        requestAnimationFrame(() => descendre(true));
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
      if (action === "renommer") { setNom(conv.nom ?? ""); setPanneau("renommer"); }
      if (action === "ajouter") { setPanneau("ajouter"); setAjout([]); if (!carnet) setCarnet(await membresJoignables()); }
      if (action === "sourdine") { const muet = !moiMembre?.muet; await reglerConversation(id, { muet }); setConv(await lireConversation(id)); memoire.ecrire("messages.liste", null); signale(muet ? "Conversation en sourdine" : "Notifications rétablies"); }
      if (action === "epingle") { const epingle = !moiMembre?.epingle; await reglerConversation(id, { epingle }); setConv(await lireConversation(id)); memoire.ecrire("messages.liste", null); signale(epingle ? "Épinglée en haut de la liste" : "Désépinglée"); }
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
  const validerNom = async () => {
    try { await renommerGroupe(id, nom); setConv((c) => ({ ...c, nom: nom.trim() })); setPanneau(null); memoire.ecrire("messages.liste", null); }
    catch (e) { signale("Impossible de renommer : " + (e.message ?? "")); }
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

  // ---- actions sur une bulle ----
  const effacer = async (m) => {
    setMenuMsg(null);
    if (!confirm("Supprimer ce message ?")) return;
    try { await supprimerMessage(m.id); setMessages((l) => l.filter((x) => x.id !== m.id)); }
    catch (e) { signale("Impossible de supprimer : " + (e.message ?? "")); }
  };
  const repondre = (m) => { setMenuMsg(null); setEdition(null); setReponseA(m); champ.current?.focus(); };
  const modifier = (m) => { setMenuMsg(null); setReponseA(null); setEdition(m); setTexte(m.texte ?? ""); mentions.reprendre((m.mentions ?? []).map((x) => parId[x] ?? annuaire[x]).filter(Boolean)); champ.current?.focus(); };
  const reaction = async (m, emoji) => {
    setMenuMsg(null);
    const mienne = (reactions[m.id] ?? []).find((r) => r.membre === moi.id)?.emoji;
    const nouvelle = mienne === emoji ? null : emoji;
    setReactions((p) => ({ ...p, [m.id]: [...(p[m.id] ?? []).filter((r) => r.membre !== moi.id), ...(nouvelle ? [{ membre: moi.id, emoji: nouvelle }] : [])] }));
    try { await reagir(m.id, nouvelle); } catch (e) { signale("Réaction impossible : " + (e.message ?? "")); }
  };
  const modifiable = (m) => m.auteur === moi.id && !m.fichier_chemin && maintenant - new Date(m.cree_le).getTime() < MODIF_MINUTES * 60000;
  // eslint-disable-next-line react-hooks/purity
  const ouvrirMenuMsg = (mid) => { setMaintenant(Date.now()); setMenuMsg(mid); };

  // « vu » : mon dernier message, lu par les autres ?
  const dernierMien = useMemo(() => (messages ?? []).filter((m) => m.auteur === moi.id).at(-1), [messages, moi.id]);
  const vuPar = useMemo(() => {
    if (!dernierMien) return [];
    return membres.filter((m) => m.id !== moi.id && lectures[m.id] && new Date(lectures[m.id]) >= new Date(dernierMien.cree_le));
  }, [dernierMien, membres, lectures, moi.id]);

  const autre = vue?.type === "duo" ? vue.membres[0] : null;
  const parIdMsg = useMemo(() => Object.fromEntries((messages ?? []).map((m) => [m.id, m])), [messages]);
  const nomDe = (uid) => (uid === moi.id ? "Toi" : (parId[uid] ?? annuaire[uid])?.prenom ?? "Membre");

  const Citation = ({ mid }) => {
    const c = parIdMsg[mid];
    if (!c) return <div className="msg-citation"><small>Message plus ancien</small></div>;
    return <div className="msg-citation"><b>{nomDe(c.auteur)}</b><span>{c.texte?.trim() ? c.texte.slice(0, 90) : libellePiece(c)}</span></div>;
  };

  const Piece = ({ m }) => {
    if (m.fichier_expiree) return <p className="msg-piece-expiree">{libellePiece(m)} expirée, gardée {JOURS_PIECE[m.fichier_type] ?? 30} jours.</p>;
    if (!m.fichier_chemin) return null;
    const u = urls[m.fichier_chemin];
    if (m.fichier_type === "lien") {
      const genre = m.fichier_chemin.startsWith("/offres") ? "Offre" : m.fichier_chemin.startsWith("/publication") ? "Publication" : m.fichier_chemin.startsWith("/profil") ? "Profil" : "Lien";
      return (
        <Link href={m.fichier_chemin} className="msg-piece-pdf msg-piece-lien">
          <LienIcone size={20} strokeWidth={1.7} aria-hidden />
          <span><b>{m.fichier_nom || "Voir"}</b><small>{genre} · ouvrir</small></span>
        </Link>
      );
    }
    if (m.fichier_type === "photo") return u ? <a href={u} target="_blank" rel="noopener noreferrer" className="msg-piece-photo"><img src={u} alt="" loading="lazy" /></a> : <span className="msg-piece-attente" aria-hidden />;
    if (m.fichier_type === "video") return u ? <video className="msg-piece-video" src={u} controls playsInline preload="metadata" /> : <span className="msg-piece-attente" aria-hidden><Play size={20} /></span>;
    if (m.fichier_type === "audio") return u ? <audio className="msg-piece-audio" src={u} controls preload="metadata" /> : <span className="msg-piece-attente courte" aria-hidden><Mic size={18} /></span>;
    return (
      <a href={u ?? "#"} target="_blank" rel="noopener noreferrer" className="msg-piece-pdf">
        <FileText size={22} strokeWidth={1.7} aria-hidden />
        <span><b>{m.fichier_nom ?? "document.pdf"}</b><small>PDF · {tailleLisible(m.fichier_taille)}</small></span>
      </a>
    );
  };

  const Reactions = ({ m }) => {
    const liste = reactions[m.id] ?? [];
    if (!liste.length) return null;
    const groupes = {};
    for (const r of liste) (groupes[r.emoji] ??= []).push(r.membre);
    return (
      <div className={`msg-reactions${m.auteur === moi.id ? " mien" : ""}`}>
        {Object.entries(groupes).map(([e, qui]) => (
          <button key={e} type="button" className={`msg-reaction${qui.includes(moi.id) ? " on" : ""}`} onClick={() => reaction(m, e)}
            title={qui.map(nomDe).join(", ")}>
            {e}{qui.length > 1 && <small>{qui.length}</small>}
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="msg-page">
      <header className="msg-tete">
        <button type="button" className="cp-fermer" onClick={retour} aria-label="Retour"><ArrowLeft size={20} aria-hidden /></button>
        {vue && (
          autre ? (
            <Link href={`/profil/${autre.id}`} className="msg-tete-qui">
              <Avatar profil={{ prenom: autre.prenom, nom: autre.nom, photo: autre.photo_url }} className="pub-avatar" />
              <span><b>{nomConversation(vue)}</b><small className={frappe ? "msg-frappe" : ""}>{frappe ? "écrit…" : "voir le profil"}</small></span>
            </Link>
          ) : (
            <button type="button" className="msg-tete-qui" onClick={() => agir("membres")}>
              <span className="msg-vignette groupe petite" aria-hidden><Users size={16} strokeWidth={1.9} /></span>
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
                {anime && <button type="button" onClick={() => agir("renommer")}><Pencil size={15} aria-hidden /> Renommer</button>}
                {anime && <button type="button" onClick={() => agir("ajouter")}><UserPlus size={15} aria-hidden /> Ajouter des membres</button>}
                {vue.type === "groupe" && <button type="button" onClick={() => agir("quitter")}><LogOut size={15} aria-hidden /> Quitter le groupe</button>}
                {vue.type === "groupe" && (anime || moi.role === "admin") && <button type="button" className="danger" onClick={() => agir("supprimer")}><Trash2 size={15} aria-hidden /> Supprimer le groupe</button>}
              </span>
            )}
          </span>
        )}
      </header>

      <div className="msg-zone" ref={zone}>
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
          return (
            <div key={m.id}>
              {nouveauJour && <div className="msg-jour"><span>{jour(m.cree_le)}</span></div>}
              <div className={`msg-rang${mien ? " mien" : ""}${suite ? " suite" : ""}`}>
                {!mien && conv?.type === "groupe" && (
                  <span className="msg-rang-avatar">{!suite && a && <Avatar profil={{ prenom: a.prenom, nom: a.nom, photo: a.photo_url }} className="com-avatar" />}</span>
                )}
                <div className="msg-bulle-menu">
                  <div className={`msg-bulle${mien ? " mienne" : ""}`}
                    onContextMenu={(e) => { e.preventDefault(); ouvrirMenuMsg(m.id); }}
                    onDoubleClick={() => ouvrirMenuMsg(m.id)}>
                    {!mien && conv?.type === "groupe" && !suite && <b className="msg-auteur">{a ? a.prenom : "Membre"}</b>}
                    {m.reponse_a && <Citation mid={m.reponse_a} />}
                    <Piece m={m} />
                    {m.texte?.trim() && <p><TexteMentions texte={m.texte} mentions={(m.mentions ?? []).map((x) => parId[x] ?? annuaire[x]).filter(Boolean)} /></p>}
                    <time>{m.modifie_le && <em>modifié · </em>}{heure(m.cree_le)}</time>
                  </div>
                  <Reactions m={m} />
                  {menuMsg === m.id && (
                    <span className="pub-menu-liste msg-bulle-liste">
                      <span className="msg-emojis">
                        {EMOJIS.map((e) => <button key={e} type="button" className={(reactions[m.id] ?? []).some((r) => r.membre === moi.id && r.emoji === e) ? "on" : ""} onClick={() => reaction(m, e)} aria-label={`Réagir ${e}`}>{e}</button>)}
                      </span>
                      <button type="button" onClick={() => repondre(m)}><Reply size={14} aria-hidden /> Répondre</button>
                      {modifiable(m) && <button type="button" onClick={() => modifier(m)}><Pencil size={14} aria-hidden /> Modifier</button>}
                      {(mien || moi.role === "admin") && <button type="button" className="danger" onClick={() => effacer(m)}><Trash2 size={14} aria-hidden /> Supprimer</button>}
                    </span>
                  )}
                </div>
              </div>
              {mien && dernierMien?.id === m.id && vuPar.length > 0 && (
                <div className="msg-vu"><CheckCheck size={13} aria-hidden /> {conv?.type === "groupe" ? `Vu par ${vuPar.length === membres.length - 1 ? "tous" : vuPar.map((x) => x.prenom).join(", ")}` : "Vu"}</div>
              )}
            </div>
          );
        })}
        <div ref={bas} />
      </div>

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
            {piece.type === "video" && <video src={piece.url} muted playsInline preload="metadata" />}
            {piece.type === "audio" && <audio src={piece.url} controls preload="metadata" className="msg-piece-audio" />}
            {piece.type === "pdf" && <span className="msg-piece-pdf statique"><FileText size={20} strokeWidth={1.7} aria-hidden /><span><b>{piece.fichier.name}</b><small>PDF · {tailleLisible(piece.fichier.size)}</small></span></span>}
            <span className="msg-piece-note">{piece.type === "video" || piece.type === "audio" ? `${piece.duree} s · gardé ${JOURS_PIECE[piece.type]} jours` : piece.type === "photo" ? `réduite avant l'envoi · gardée ${JOURS_PIECE.photo} jours` : `gardé ${JOURS_PIECE.pdf} jours`}</span>
            <button type="button" className="cp-photo-retirer" onClick={retirerPiece} aria-label="Retirer la pièce jointe"><X size={14} aria-hidden /></button>
          </div>
        )}
        <div className="msg-saisie-ligne">
          {!edition && (
            <button type="button" className="msg-joindre" onClick={() => fichierRef.current?.click()} aria-label="Joindre une photo, une vidéo ou un PDF" disabled={envoi || !!enregistrement}>
              <Paperclip size={19} strokeWidth={1.9} aria-hidden />
            </button>
          )}
          <input ref={fichierRef} type="file" accept="image/*,video/*,application/pdf" hidden onChange={choisirPiece} />
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

      {panneau && (
        <div className="fg-scrim msg-voile" role="presentation" onClick={() => setPanneau(null)}>
          <div className="msg-panneau" onClick={(e) => e.stopPropagation()}>
            <div className="msg-panneau-tete">
              <b>{panneau === "membres" ? `${membres.length} membres` : panneau === "renommer" ? "Renommer le groupe" : "Ajouter des membres"}</b>
              <button type="button" className="cp-fermer" onClick={() => setPanneau(null)} aria-label="Fermer"><X size={18} aria-hidden /></button>
            </div>
            {panneau === "membres" && membres.map((m) => (
              <div key={m.id} className="msg-personne statique">
                <Link href={`/profil/${m.id}`} className="msg-personne-lien">
                  <Avatar profil={{ prenom: m.prenom, nom: m.nom, photo: m.photo_url }} className="pub-avatar" />
                  <span><b>{m.prenom} {m.nom}</b><small>{m.id === conv.cree_par ? "a créé le groupe" : m.id === moi.id ? "toi" : ""}</small></span>
                </Link>
                {anime && m.id !== moi.id && <button type="button" className="btn btn-nu msg-retirer" onClick={() => retirer(m)}>Retirer</button>}
              </div>
            ))}
            {panneau === "renommer" && (
              <div className="msg-panneau-form">
                <input className="saisie" value={nom} maxLength={60} onChange={(e) => setNom(e.target.value)} autoFocus />
                <button type="button" className="btn btn-or" disabled={!nom.trim()} onClick={validerNom}>Enregistrer</button>
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
          </div>
        </div>
      )}
      <div className={`toast${toast ? " la" : ""}`} role="status">{toast}</div>
    </div>
  );
}
