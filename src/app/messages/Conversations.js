"use client";

import { useEffect, useRef, useState } from "react";
import { texteErreur, avecReprise } from "@/lib/erreurs";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { MessageCircle, PenLine, Users, Search, Pin, PinOff, BellOff, Bell, CheckCheck, LogOut, Trash2, X, ChevronRight } from "lucide-react";
import Avatar from "@/components/Avatar";
import Nouveau, { decouvrir } from "@/components/Nouveau";
import GlisserRafraichir from "@/components/GlisserRafraichir";
import { RestaurerDefilement } from "@/components/SuiviNavigation";
import { SqueletteFiche } from "@/components/Squelettes";
import * as memoire from "@/lib/memoire";
import { depuis } from "@/lib/fil";
import { mesConversations, nomConversation, ecouterTousMessages, ecouterConversations, ecouterFrappes, chercherMessages, libellePiece, reglerConversation, marquerLu, retirerMembre, JOURS_CONSERVATION } from "@/lib/messages";

// La liste des conversations : la plus récente en haut, pastille des non
// lus, aperçu du dernier message. Une ligne = une conversation (à deux ou
// groupe), qui s'ouvre en pleine page (/messages/[id]).

function Vignette({ c }) {
  if (c.type === "groupe") {
    if (c.photo_url) return <img src={c.photo_url} alt="" className="msg-vignette" />;
    const deux = (c.membres ?? []).slice(0, 2);
    return (
      <span className="msg-vignette groupe" aria-hidden>
        {deux.length === 0 && <Users size={18} strokeWidth={1.8} />}
        {deux.map((m, i) => <Avatar key={m.id} profil={{ prenom: m.prenom, nom: m.nom, photo: m.photo_url }} className={`msg-mini m${i}`} />)}
      </span>
    );
  }
  const a = c.membres?.[0];
  return a ? <Avatar profil={{ prenom: a.prenom, nom: a.nom, photo: a.photo_url }} className="msg-vignette" /> : <span className="msg-vignette avatar-init">?</span>;
}

export default function Conversations({ moi }) {
  const routeur = useRouter();
  const chemin = usePathname();
  const [liste, setListe] = useState(() => memoire.lire("messages.liste") ?? null);
  const [souci, setSouci] = useState("");
  const [q, setQ] = useState("");
  const [resultats, setResultats] = useState(null);   // null = pas de recherche en cours
  useEffect(() => {
    const t = q.trim();
    if (t.length < 2) return;
    const minuteur = setTimeout(() => chercherMessages(t).then(setResultats).catch(() => setResultats([])), 300);
    return () => clearTimeout(minuteur);
  }, [q]);
  const recherche = q.trim().length >= 2 ? resultats : null;   // null = liste normale
  // brouillons laissés dans des conversations (stockage du téléphone)
  const [brouillons, setBrouillons] = useState({});
  useEffect(() => {
    const b = {};
    try { for (const c of liste ?? []) { const t = localStorage.getItem(`brouillon-conv-${c.id}`); if (t?.trim()) b[c.id] = t.trim(); } } catch { /* stockage indisponible */ }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBrouillons(b);
  }, [liste, chemin]);
  // « Ana écrit… » sur la ligne d'une conversation, même sans l'ouvrir
  const [frappes, setFrappes] = useState({});   // conversationId → prenom
  const minuteurs = useRef({});
  useEffect(() => {
    const ids = (liste ?? []).map((c) => c.id);
    if (!ids.length) return;
    const stop = ecouterFrappes(ids, (cid, p) => {
      if (!p || p.membre === moi.id) return;
      setFrappes((f) => ({ ...f, [cid]: p.prenom ?? "Quelqu'un" }));
      clearTimeout(minuteurs.current[cid]);
      minuteurs.current[cid] = setTimeout(() => setFrappes((f) => { const n = { ...f }; delete n[cid]; return n; }), 3500);
    });
    const m = minuteurs.current;
    return () => { stop(); Object.values(m).forEach(clearTimeout); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liste?.map((c) => c.id).join(",")]);

  const charger = async () => {
    try { setListe(await avecReprise(() => mesConversations())); setSouci(""); }
    catch (e) { setSouci("Les messages ne répondent pas : " + texteErreur(e)); if (liste === null) setListe([]); }
  };
  // au montage et à chaque retour sur /messages (une conversation lue change les compteurs)
  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
  useEffect(() => { if (chemin === "/messages") charger(); }, [chemin]);
  useEffect(() => { if (liste !== null) memoire.ecrire("messages.liste", liste); }, [liste]);
  // temps réel : un message qui arrive (ou que j'envoie ailleurs) remet la liste à jour
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => ecouterTousMessages(() => charger()), []);
  // … et les conversations elles-mêmes (renommage, photo, nouveau groupe, départ, suppression)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => ecouterConversations(() => charger()), []);

  const rafraichir = async () => { await charger(); routeur.refresh(); };

  // appui long (ou clic droit) sur une conversation : ses actions, sans l'ouvrir
  const [menuConv, setMenuConv] = useState(null);
  const [toast, setToast] = useState("");
  const signale = (m) => { setToast(m); setTimeout(() => setToast(""), 2600); };
  const geste = useRef(null);
  const debutGeste = (c) => (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    geste.current = { x: e.clientX, y: e.clientY, long: false, minuteur: setTimeout(() => { if (geste.current) { geste.current.long = true; setMenuConv(c); } }, 450) };
  };
  const bougeGeste = (e) => { const g = geste.current; if (g && (Math.abs(e.clientX - g.x) > 10 || Math.abs(e.clientY - g.y) > 10)) { clearTimeout(g.minuteur); geste.current = null; } };
  const finGeste = () => { const g = geste.current; if (!g) return; clearTimeout(g.minuteur); if (g.long) { const bloque = (ev) => { ev.preventDefault(); ev.stopPropagation(); }; document.addEventListener("click", bloque, { capture: true, once: true }); setTimeout(() => document.removeEventListener("click", bloque, { capture: true }), 400); } geste.current = null; };
  const agirConv = async (action) => {
    const c = menuConv; setMenuConv(null);
    if (!c) return;
    try {
      if (action === "ouvrir") routeur.push(`/messages/${c.id}`);
      if (action === "epingle") { await reglerConversation(c.id, { epingle: !c.epingle }); await charger(); signale(c.epingle ? "Désépinglée" : "Épinglée en haut"); }
      if (action === "sourdine") { await reglerConversation(c.id, { muet: !c.muet }); await charger(); signale(c.muet ? "Notifications rétablies" : "Conversation en sourdine"); }
      if (action === "lu") { await marquerLu(c.id); await charger(); signale("Marquée comme lue"); }
      if (action === "quitter") {
        if (!confirm(c.type === "groupe" ? `Quitter le groupe « ${nomConversation(c)} » ?` : `Supprimer la conversation avec ${nomConversation(c)} ? Elle disparaît de ta liste ; l'autre garde la sienne.`)) return;
        await retirerMembre(c.id, moi.id); await charger(); signale(c.type === "groupe" ? "Groupe quitté" : "Conversation supprimée");
      }
    } catch (e) { signale("Action impossible : " + texteErreur(e)); }
  };

  return (
    <GlisserRafraichir onRafraichir={rafraichir}>
    <>
      <header className="n-tete tete-portail tete-messages">
        <h1>Messages</h1>
        <p className="cpt">Entre membres, à deux ou en groupe. Les messages s&apos;effacent après {JOURS_CONSERVATION} jours.</p>
      </header>

      <div className="msg-recherche msg-recherche-liste">
        <Search size={16} strokeWidth={1.9} aria-hidden />
        <input className="saisie" placeholder="Rechercher dans les messages…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {recherche === null && (
        <div className="avec-nouveau">
        <Link href="/messages/groupes" className="gr-decouvrir" onClick={decouvrir("groupes")}><Users size={16} strokeWidth={1.9} aria-hidden /> <span>Découvrir des groupes</span><small>ouverts ou sur demande</small><ChevronRight size={16} aria-hidden /></Link>
        <Nouveau cle="groupes" className="nouveau-bandeau" />
        </div>
      )}
      {recherche !== null && (
        <div className="msg-liste msg-resultats">
          {recherche.length === 0 && <p className="pu-vide">Rien ne correspond.</p>}
          {recherche.map((r) => (
            <Link key={r.id} href={`/messages/${r.conversation_id}`} className="msg-ligne">
              <span className="msg-ligne-corps">
                <span className="msg-ligne-haut"><b>{r.conversation}</b><small>{depuis(r.cree_le)}</small></span>
                <span className="msg-apercu msg-apercu-long">{r.prenom} : {r.texte}</span>
              </span>
            </Link>
          ))}
        </div>
      )}
      <div className="msg-liste" hidden={recherche !== null}>
        {liste === null && [0, 1, 2].map((i) => <SqueletteFiche key={i} />)}
        {liste?.length === 0 && (
          <div className="vide" style={{ paddingTop: 40 }}>
            <div className="gros" aria-hidden><MessageCircle size={30} strokeWidth={1.6} /></div>
            <b>Aucune conversation</b>{" "}
            Écris à un membre depuis son profil, ou commence ici avec la plume.
          </div>
        )}
        {liste?.map((c) => {
          const d = c.dernier;
          const contenu = d ? (d.texte?.trim() ? d.texte : libellePiece(d)) : "";
          const apercu = d ? `${d.auteur === moi.id ? "Toi" : d.prenom} : ${contenu}` : "Nouvelle conversation";
          return (
            <Link key={c.id} href={`/messages/${c.id}`} className={`msg-ligne${c.non_lus > 0 ? " non-lu" : ""}`} draggable={false}
              onPointerDown={debutGeste(c)} onPointerMove={bougeGeste} onPointerUp={finGeste} onPointerCancel={finGeste}
              onContextMenu={(e) => { e.preventDefault(); setMenuConv(c); }}>
              <Vignette c={c} />
              <span className="msg-ligne-corps">
                <span className="msg-ligne-haut">
                  <b>{c.epingle && <Pin size={12} aria-label="Épinglée" className="msg-ico" />}{c.muet && <BellOff size={12} aria-label="En sourdine" className="msg-ico" />}{nomConversation(c)}</b>
                  <small>{d ? depuis(d.cree_le) : ""}</small>
                </span>
                <span className="msg-ligne-bas">
                  <span className={`msg-apercu${frappes[c.id] ? " msg-frappe" : brouillons[c.id] ? " msg-brouillon" : ""}`}>
                    {frappes[c.id] ? `${frappes[c.id]} écrit…` : brouillons[c.id] ? <><b>Brouillon :</b> {brouillons[c.id]}</> : apercu}
                  </span>
                  {c.non_lus > 0 && <span className="msg-pastille">{c.non_lus > 99 ? "99+" : c.non_lus}</span>}
                </span>
                {c.type === "groupe" && <small className="msg-ligne-meta">{c.nb_membres} membres</small>}
              </span>
            </Link>
          );
        })}
        {souci && <p className="vide">{souci}</p>}
      </div>

      <Link href="/messages/nouveau" className="fil-fab" aria-label="Nouvelle conversation"><PenLine size={20} strokeWidth={2} aria-hidden /></Link>

      {menuConv && (
        <div className="fg-scrim msg-voile" role="presentation" onClick={() => setMenuConv(null)}>
          <div className="msg-panneau" onClick={(e) => e.stopPropagation()}>
            <div className="msg-panneau-tete">
              <b>{nomConversation(menuConv)}</b>
              <button type="button" className="cp-fermer" onClick={() => setMenuConv(null)} aria-label="Fermer"><X size={18} aria-hidden /></button>
            </div>
            <div className="msg-actions-conv">
              <button type="button" onClick={() => agirConv("ouvrir")}><MessageCircle size={16} aria-hidden /> Ouvrir</button>
              {menuConv.non_lus > 0 && <button type="button" onClick={() => agirConv("lu")}><CheckCheck size={16} aria-hidden /> Marquer comme lue</button>}
              <button type="button" onClick={() => agirConv("epingle")}>{menuConv.epingle ? <><PinOff size={16} aria-hidden /> Désépingler</> : <><Pin size={16} aria-hidden /> Épingler en haut</>}</button>
              <button type="button" onClick={() => agirConv("sourdine")}>{menuConv.muet ? <><Bell size={16} aria-hidden /> Rétablir les notifications</> : <><BellOff size={16} aria-hidden /> Mettre en sourdine</>}</button>
              <button type="button" className="danger" onClick={() => agirConv("quitter")}>{menuConv.type === "groupe" ? <><LogOut size={16} aria-hidden /> Quitter le groupe</> : <><Trash2 size={16} aria-hidden /> Supprimer la conversation</>}</button>
            </div>
          </div>
        </div>
      )}
      <div className={`toast${toast ? " la" : ""}`} role="status">{toast}</div>
      <RestaurerDefilement />
    </>
    </GlisserRafraichir>
  );
}
