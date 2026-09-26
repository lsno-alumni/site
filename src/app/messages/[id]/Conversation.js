"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Send, MoreHorizontal, Users, Trash2, LogOut, Pencil, UserPlus, X, Check, Paperclip, FileText, Play } from "lucide-react";
import Avatar from "@/components/Avatar";
import useClicDehors from "@/lib/useClicDehors";
import { peutRevenir } from "@/components/SuiviNavigation";
import * as memoire from "@/lib/memoire";
import { useMentions, SuggestionsMention, TexteMentions, carnet as carnetMembres } from "@/lib/mentions";
import {
  lireConversation, chargerMessages, envoyerMessage, supprimerMessage, marquerLu, ecouterMessages,
  renommerGroupe, ajouterMembres, retirerMembre, supprimerGroupe, membresJoignables,
  televerserPiece, urlsPieces, tailleLisible,
  nomConversation, heure, jour, MESSAGE_MAX, PIECE_VIDEO_SECONDES, PIECE_VIDEO_MO, PIECE_PDF_MO,
} from "@/lib/messages";

// Le fil d'une conversation : bulles (les miennes à droite, en bleu ; les
// autres à gauche, papier, avec le prénom dans les groupes), séparateurs de
// jour, saisie collée en bas, arrivée en temps réel, lecture marquée à
// l'ouverture et à chaque message reçu.

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
  const bas = useRef(null);
  const zone = useRef(null);
  const champ = useRef(null);
  const mentions = useMentions(texte, setTexte, champ);
  const fichierRef = useRef(null);
  const [piece, setPiece] = useState(null);      // { type, fichier, url (aperçu), duree }
  const [urls, setUrls] = useState({});          // chemin → URL signée
  const signer = async (liste) => {
    const manquants = (liste ?? []).map((m) => m.fichier_chemin).filter((c) => c && !urls[c]);
    if (!manquants.length) return;
    const nouvelles = await urlsPieces(manquants);
    setUrls((u) => ({ ...u, ...nouvelles }));
  };
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
  const [annuaire, setAnnuaire] = useState({});   // id → {prenom, nom}, pour les mentions hors conversation
  useEffect(() => { carnetMembres().then((l) => setAnnuaire(Object.fromEntries(l.map((m) => [m.id, m])))).catch(() => {}); }, []);
  const signale = (m) => { setToast(m); setTimeout(() => setToast(""), 2600); };
  useClicDehors(menu, (e) => !!e.target.closest?.(".msg-menu"), () => setMenu(false));
  useClicDehors(menuMsg !== null, (e) => !!e.target.closest?.(".msg-bulle-menu"), () => setMenuMsg(null));

  const membres = useMemo(() => (conv?.membres ?? []).map((m) => m.profil).filter(Boolean), [conv]);
  const parId = useMemo(() => Object.fromEntries(membres.map((m) => [m.id, m])), [membres]);
  const vue = conv ? { ...conv, membres: membres.filter((m) => m.id !== moi.id) } : null;
  const anime = conv?.type === "groupe" && conv?.cree_par === moi.id;
  const descendre = (doux = false) => bas.current?.scrollIntoView({ block: "end", behavior: doux ? "smooth" : "instant" });

  // chargement + temps réel
  useEffect(() => {
    let vivant = true;
    (async () => {
      try {
        const [c, m] = await Promise.all([lireConversation(id), chargerMessages(id)]);
        if (!vivant) return;
        if (!c) { setSouci("Cette conversation n'existe pas, ou tu n'en fais pas partie."); setMessages([]); return; }
        setConv(c); setMessages(m); setDebut(m.length < 50);
        signer(m);
        marquerLu(id); memoire.ecrire("messages.liste", null);
        requestAnimationFrame(() => descendre());
      } catch (e) { if (vivant) { setSouci(e.message ?? "Erreur"); setMessages([]); } }
    })();
    const stop = ecouterMessages(id, {
      surInsertion: (m) => {
        setMessages((l) => (l && !l.some((x) => x.id === m.id) ? [...l, m] : l));
        signer([m]);
        if (m.auteur !== moi.id) { marquerLu(id); memoire.ecrire("messages.liste", null); }
        requestAnimationFrame(() => descendre(true));
      },
      surSuppression: (mid) => setMessages((l) => (l ? l.filter((x) => x.id !== mid) : l)),
    });
    return () => { vivant = false; stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const plusAncien = async () => {
    if (!messages?.length || debut) return;
    const avant = messages[0].cree_le;
    const h = zone.current?.scrollHeight ?? 0;
    const anciens = await chargerMessages(id, { avant });
    signer(anciens);
    setMessages((l) => [...anciens, ...l]);
    setDebut(anciens.length < 50);
    requestAnimationFrame(() => { if (zone.current) zone.current.scrollTop += zone.current.scrollHeight - h; });
  };

  const envoyer = async (e) => {
    e.preventDefault();
    if ((!texte.trim() && !piece) || envoi) return;
    setEnvoi(true);
    try {
      const jointe = piece ? await televerserPiece(id, piece) : null;
      const m = await envoyerMessage(id, texte, mentions.idsPour(texte), jointe);
      setMessages((l) => (l && !l.some((x) => x.id === m.id) ? [...l, m] : l));
      signer([m]);
      setTexte(""); mentions.vider(); retirerPiece(); memoire.ecrire("messages.liste", null);
      requestAnimationFrame(() => descendre(true));
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
  const effacer = async (m) => {
    setMenuMsg(null);
    if (!confirm("Supprimer ce message ?")) return;
    try { await supprimerMessage(m.id); setMessages((l) => l.filter((x) => x.id !== m.id)); }
    catch (e) { signale("Impossible de supprimer : " + (e.message ?? "")); }
  };

  const autre = vue?.type === "duo" ? vue.membres[0] : null;

  return (
    <div className="msg-page">
      <header className="msg-tete">
        <button type="button" className="cp-fermer" onClick={retour} aria-label="Retour"><ArrowLeft size={20} aria-hidden /></button>
        {vue && (
          autre ? (
            <Link href={`/profil/${autre.id}`} className="msg-tete-qui">
              <Avatar profil={{ prenom: autre.prenom, nom: autre.nom, photo: autre.photo_url }} className="pub-avatar" />
              <span><b>{nomConversation(vue)}</b><small>voir le profil</small></span>
            </Link>
          ) : (
            <button type="button" className="msg-tete-qui" onClick={() => agir("membres")}>
              <span className="msg-vignette groupe petite" aria-hidden><Users size={16} strokeWidth={1.9} /></span>
              <span><b>{nomConversation(vue)}</b><small>{membres.length} membres · voir</small></span>
            </button>
          )
        )}
        {!vue && <span className="cp-titre">Conversation</span>}
        {vue?.type === "groupe" && (
          <span className="msg-menu">
            <button type="button" className="pub-plus" aria-label="Options" onClick={() => setMenu(!menu)}><MoreHorizontal size={20} aria-hidden /></button>
            {menu && (
              <span className="pub-menu-liste">
                <button type="button" onClick={() => agir("membres")}><Users size={15} aria-hidden /> Membres</button>
                {anime && <button type="button" onClick={() => agir("renommer")}><Pencil size={15} aria-hidden /> Renommer</button>}
                {anime && <button type="button" onClick={() => agir("ajouter")}><UserPlus size={15} aria-hidden /> Ajouter des membres</button>}
                <button type="button" onClick={() => agir("quitter")}><LogOut size={15} aria-hidden /> Quitter le groupe</button>
                {(anime || moi.role === "admin") && <button type="button" className="danger" onClick={() => agir("supprimer")}><Trash2 size={15} aria-hidden /> Supprimer le groupe</button>}
              </span>
            )}
          </span>
        )}
      </header>

      <div className="msg-zone" ref={zone}>
        {messages === null && <p className="pu-vide">Chargement…</p>}
        {messages && !debut && <button type="button" className="btn btn-nu msg-plus" onClick={plusAncien}>Messages plus anciens</button>}
        {messages?.length === 0 && !souci && (
          <p className="pu-vide">Personne n&apos;a encore écrit. À toi.</p>
        )}
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
                    onContextMenu={(e) => { if (mien || moi.role === "admin") { e.preventDefault(); setMenuMsg(m.id); } }}
                    onDoubleClick={() => { if (mien || moi.role === "admin") setMenuMsg(m.id); }}>
                    {!mien && conv?.type === "groupe" && !suite && <b className="msg-auteur">{a ? a.prenom : "Membre"}</b>}
                    {m.fichier_chemin && (
                      m.fichier_type === "photo" ? (
                        urls[m.fichier_chemin]
                          ? <a href={urls[m.fichier_chemin]} target="_blank" rel="noopener noreferrer" className="msg-piece-photo"><img src={urls[m.fichier_chemin]} alt="" loading="lazy" /></a>
                          : <span className="msg-piece-attente" aria-hidden />
                      ) : m.fichier_type === "video" ? (
                        urls[m.fichier_chemin]
                          ? <video className="msg-piece-video" src={urls[m.fichier_chemin]} controls playsInline preload="metadata" />
                          : <span className="msg-piece-attente" aria-hidden><Play size={20} /></span>
                      ) : (
                        <a href={urls[m.fichier_chemin] ?? "#"} target="_blank" rel="noopener noreferrer" className="msg-piece-pdf">
                          <FileText size={22} strokeWidth={1.7} aria-hidden />
                          <span><b>{m.fichier_nom ?? "document.pdf"}</b><small>PDF · {tailleLisible(m.fichier_taille)}</small></span>
                        </a>
                      )
                    )}
                    {m.texte?.trim() && <p><TexteMentions texte={m.texte} mentions={(m.mentions ?? []).map((x) => parId[x] ?? annuaire[x]).filter(Boolean)} /></p>}
                    <time>{heure(m.cree_le)}</time>
                  </div>
                  {menuMsg === m.id && (
                    <span className="pub-menu-liste msg-bulle-liste">
                      <button type="button" className="danger" onClick={() => effacer(m)}><Trash2 size={14} aria-hidden /> Supprimer</button>
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bas} />
      </div>

      <form className="msg-saisie" onSubmit={envoyer}>
        <SuggestionsMention suggestions={mentions.suggestions} choisir={mentions.choisir} className="mention-liste-haut" />
        {piece && (
          <div className="msg-piece-apercu">
            {piece.type === "photo" && <img src={piece.url} alt="" />}
            {piece.type === "video" && <video src={piece.url} muted playsInline preload="metadata" />}
            {piece.type === "pdf" && <span className="msg-piece-pdf statique"><FileText size={20} strokeWidth={1.7} aria-hidden /><span><b>{piece.fichier.name}</b><small>PDF · {tailleLisible(piece.fichier.size)}</small></span></span>}
            <span className="msg-piece-note">{piece.type === "video" ? `${piece.duree} s` : piece.type === "photo" ? "réduite avant l'envoi" : ""}</span>
            <button type="button" className="cp-photo-retirer" onClick={retirerPiece} aria-label="Retirer la pièce jointe"><X size={14} aria-hidden /></button>
          </div>
        )}
        <div className="msg-saisie-ligne">
          <button type="button" className="msg-joindre" onClick={() => fichierRef.current?.click()} aria-label="Joindre une photo, une vidéo ou un PDF" disabled={envoi}>
            <Paperclip size={19} strokeWidth={1.9} aria-hidden />
          </button>
          <input ref={fichierRef} type="file" accept="image/*,video/*,application/pdf" hidden onChange={choisirPiece} />
          <textarea ref={champ} className="saisie" placeholder={piece ? "Un mot avec la pièce jointe ? (facultatif)" : "Écrire un message…"} rows={1} value={texte} maxLength={MESSAGE_MAX}
            onChange={mentions.surChangement}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); envoyer(e); } }} />
          <button type="submit" className="com-envoyer" disabled={(!texte.trim() && !piece) || envoi} aria-label="Envoyer">
            {envoi ? <span className="msg-envoi-attente" aria-hidden /> : <Send size={17} aria-hidden />}
          </button>
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
