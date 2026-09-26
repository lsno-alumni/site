"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Send, CornerDownRight, MoreHorizontal } from "lucide-react";
import Avatar from "@/components/Avatar";
import { commentairesDe, envoyerCommentaire, depuis, signaler, moderer } from "@/lib/fil";
import * as memoire from "@/lib/memoire";

// Les commentaires d'une cible (publication ou offre) et la saisie collée en
// bas. Réponse à un commentaire = même liste, indentée sous son parent.
// `initial` (facultatif) évite le chargement quand le serveur les a déjà lus.
export default function Commentaires({ type, id, moi, initial = null, onNombre, moderateur = false }) {
  const [liste, setListe] = useState(initial ?? []);
  const [charge, setCharge] = useState(initial !== null);
  const [texte, setTexte] = useState("");
  const [reponseA, setReponseA] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const [menu, setMenu] = useState(null);     // id du commentaire dont le menu ⋯ est ouvert
  const [toast, setToast] = useState("");
  const signale = (m) => { setToast(m); setTimeout(() => setToast(""), 2600); };

  const recharger = async () => {
    try { const l = await commentairesDe(type, id); setListe(l); onNombre?.(l.filter((c) => !c.masque).length); }
    catch { /* la liste reste telle quelle */ }
    setCharge(true);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
  useEffect(() => { if (initial === null) recharger(); }, []);

  const envoyer = async (e) => {
    e.preventDefault();
    if (!texte.trim() || envoi) return;
    setEnvoi(true);
    try {
      await envoyerCommentaire(type, id, texte, reponseA?.id ?? null);
      setTexte(""); setReponseA(null);
      memoire.ecrire("fil.items", null);   // le compteur de la carte du Fil suivra au retour
      await recharger();
    } catch (err) { signale("Envoi impossible : " + (err.message ?? "")); }
    setEnvoi(false);
  };

  const agir = async (c, action) => {
    setMenu(null);
    try {
      if (action === "signaler") { await signaler("commentaire", c.id, "Commentaire signalé depuis l'application"); signale("Merci, les modérateurs sont prévenus."); }
      if (action === "masquer") { await moderer("commentaire", c.id, !c.masque); await recharger(); }
    } catch (err) { signale("Action impossible : " + (err.message ?? "")); }
  };

  const visibles = liste.filter((c) => !c.masque || moderateur || c.auteur.id === moi.id);

  return (
    <>
      <section className="pu-commentaires">
        {!charge && <p className="pu-vide">Chargement…</p>}
        {charge && visibles.length === 0 && <p className="pu-vide">Sois le premier à répondre.</p>}
        {visibles.map((c) => {
          const parent = c.reponse_a ? liste.find((x) => x.id === c.reponse_a) : null;
          return (
            <div key={c.id} className={`com${c.reponse_a ? " com-reponse" : ""}${c.masque ? " com-masque" : ""}`}>
              <Link href={`/profil/${c.auteur.id}`}>
                <Avatar profil={{ prenom: c.auteur.prenom, nom: c.auteur.nom, photo: c.auteur.photo_url }} className="com-avatar" />
              </Link>
              <div className="com-corps">
                <div className="com-bulle">
                  <b>{c.auteur.prenom} {c.auteur.nom}</b>
                  {parent && <small className="com-vers"><CornerDownRight size={11} aria-hidden /> en réponse à {parent.auteur.prenom}</small>}
                  {c.masque && <small className="com-vers">masqué par la modération</small>}
                  <p>{c.texte}</p>
                </div>
                <div className="com-meta">
                  <span>{depuis(c.cree_le)}</span>
                  <button type="button" onClick={() => { setReponseA(c); document.getElementById("com-saisie")?.focus(); }}>Répondre</button>
                  {c.auteur.id !== moi.id && (
                    <span className="com-menu">
                      <button type="button" aria-label="Options" onClick={() => setMenu(menu === c.id ? null : c.id)}><MoreHorizontal size={14} aria-hidden /></button>
                      {menu === c.id && (
                        <span className="com-menu-liste">
                          <button type="button" onClick={() => agir(c, "signaler")}>Signaler</button>
                          {moderateur && <button type="button" onClick={() => agir(c, "masquer")}>{c.masque ? "Rétablir" : "Masquer"}</button>}
                        </span>
                      )}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </section>

      <form className="com-saisie" onSubmit={envoyer}>
        {reponseA && (
          <div className="com-saisie-vers">
            <CornerDownRight size={12} aria-hidden /> Réponse à {reponseA.auteur.prenom}
            <button type="button" onClick={() => setReponseA(null)} aria-label="Annuler la réponse">×</button>
          </div>
        )}
        <div className="com-saisie-ligne">
          <Avatar profil={moi} className="com-avatar" />
          <input id="com-saisie" className="saisie" placeholder={reponseA ? `Répondre à ${reponseA.auteur.prenom}…` : "Écrire un commentaire…"}
            value={texte} onChange={(e) => setTexte(e.target.value)} maxLength={600} />
          <button type="submit" className="com-envoyer" disabled={!texte.trim() || envoi} aria-label="Envoyer"><Send size={17} aria-hidden /></button>
        </div>
      </form>
      <div className={`toast${toast ? " la" : ""}`} role="status">{toast}</div>
    </>
  );
}
