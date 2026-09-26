"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Send, CornerDownRight, MoreHorizontal, Pencil } from "lucide-react";
import Avatar from "@/components/Avatar";
import { commentairesDe, envoyerCommentaire, modifierCommentaire, supprimerCommentaire, depuis, signaler, moderer } from "@/lib/fil";
import * as memoire from "@/lib/memoire";
import useClicDehors from "@/lib/useClicDehors";

// Les commentaires d'une cible (publication ou offre) et la saisie collée en
// bas. Réponse à un commentaire = même liste, indentée sous son parent.
// `initial` (facultatif) évite le chargement quand le serveur les a déjà lus.
// `fixe` : dans une feuille glissante, la saisie est posée au bas de l'ÉCRAN
// (portail) plutôt qu'au bas de la feuille, qui peut dépasser sous l'écran.
export default function Commentaires({ type, id, moi, initial = null, onNombre, moderateur = false, fixe = false, inline = false }) {
  const [liste, setListe] = useState(initial ?? []);
  const [charge, setCharge] = useState(initial !== null);
  const [texte, setTexte] = useState("");
  const [reponseA, setReponseA] = useState(null);
  const [edition, setEdition] = useState(null);   // commentaire en cours de modification
  const [envoi, setEnvoi] = useState(false);
  const [menu, setMenu] = useState(null);         // id du commentaire dont le menu ⋯ est ouvert
  const [toast, setToast] = useState("");
  const [monte, setMonte] = useState(false);
  const signale = (m) => { setToast(m); setTimeout(() => setToast(""), 2600); };
  // dedans = le menu OUVERT (celui qui porte la liste), pas celui d'un autre commentaire
  useClicDehors(menu !== null, (e) => !!e.target.closest?.(".com-menu")?.querySelector(".com-menu-liste"), () => setMenu(null));

  const recharger = async () => {
    try { const l = await commentairesDe(type, id); setListe(l); onNombre?.(l.filter((c) => !c.masque).length); }
    catch { /* la liste reste telle quelle */ }
    setCharge(true);
    memoire.ecrire("fil.items", null);   // le compteur de la carte du Fil suivra au retour
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
  useEffect(() => { setMonte(true); if (initial === null) recharger(); }, []);

  const focus = () => document.getElementById("com-saisie")?.focus();
  const annuler = () => { setReponseA(null); setEdition(null); setTexte(""); };

  const envoyer = async (e) => {
    e.preventDefault();
    if (!texte.trim() || envoi) return;
    setEnvoi(true);
    try {
      if (edition) await modifierCommentaire(edition.id, texte);
      else await envoyerCommentaire(type, id, texte, reponseA?.id ?? null);
      annuler();
      await recharger();
    } catch (err) { signale("Envoi impossible : " + (err.message ?? "")); }
    setEnvoi(false);
  };

  const agir = async (c, action) => {
    setMenu(null);
    try {
      if (action === "modifier") { setReponseA(null); setEdition(c); setTexte(c.texte); focus(); }
      if (action === "supprimer") {
        if (!confirm("Supprimer ce commentaire ?")) return;
        await supprimerCommentaire(c.id); await recharger(); signale("Commentaire supprimé");
      }
      if (action === "signaler") { await signaler("commentaire", c.id, "Commentaire signalé depuis l'application"); signale("Merci, les modérateurs sont prévenus."); }
      if (action === "masquer") { await moderer("commentaire", c.id, !c.masque); await recharger(); }
    } catch (err) { signale("Action impossible : " + (err.message ?? "")); }
  };

  const visibles = liste.filter((c) => !c.masque || moderateur || c.auteur.id === moi.id);

  const saisie = (
    <form className={`com-saisie${fixe ? " com-saisie-fixe" : ""}${inline ? " com-saisie-inline" : ""}`} onSubmit={envoyer}>
      {(reponseA || edition) && (
        <div className="com-saisie-vers">
          {edition
            ? <><Pencil size={12} aria-hidden /> Modification de ton commentaire</>
            : <><CornerDownRight size={12} aria-hidden /> Réponse à {reponseA.auteur.prenom}</>}
          <button type="button" onClick={annuler} aria-label="Annuler">×</button>
        </div>
      )}
      <div className="com-saisie-ligne">
        <Avatar profil={moi} className="com-avatar" />
        <input id="com-saisie" className="saisie" placeholder={reponseA ? `Répondre à ${reponseA.auteur.prenom}…` : "Écrire un commentaire…"}
          value={texte} onChange={(e) => setTexte(e.target.value)} maxLength={600} />
        <button type="submit" className="com-envoyer" disabled={!texte.trim() || envoi} aria-label={edition ? "Enregistrer" : "Envoyer"}>
          {edition ? <Pencil size={16} aria-hidden /> : <Send size={17} aria-hidden />}
        </button>
      </div>
    </form>
  );

  return (
    <>
      <section className={`pu-commentaires${fixe ? " pu-commentaires-fixe" : ""}`}>
        {!charge && <p className="pu-vide">Chargement…</p>}
        {charge && visibles.length === 0 && <p className="pu-vide">Sois le premier à répondre.</p>}
        {visibles.map((c) => {
          const parent = c.reponse_a ? liste.find((x) => x.id === c.reponse_a) : null;
          const mien = c.auteur.id === moi.id;
          return (
            <div key={c.id} className={`com${c.reponse_a ? " com-reponse" : ""}${c.masque ? " com-masque" : ""}${edition?.id === c.id ? " com-edition" : ""}`}>
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
                  <button type="button" onClick={() => { setEdition(null); setTexte(""); setReponseA(c); focus(); }}>Répondre</button>
                  <span className="com-menu">
                    <button type="button" aria-label="Options" onClick={() => setMenu(menu === c.id ? null : c.id)}><MoreHorizontal size={14} aria-hidden /></button>
                    {menu === c.id && (
                      <span className="com-menu-liste">
                        {mien && <button type="button" onClick={() => agir(c, "modifier")}>Modifier</button>}
                        {!mien && <button type="button" onClick={() => agir(c, "signaler")}>Signaler</button>}
                        {!mien && moderateur && <button type="button" onClick={() => agir(c, "masquer")}>{c.masque ? "Rétablir" : "Masquer"}</button>}
                        {(mien || moi.role === "admin") && <button type="button" className="danger" onClick={() => agir(c, "supprimer")}>Supprimer</button>}
                      </span>
                    )}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {fixe && monte ? createPortal(saisie, document.body) : saisie}
      <div className={`toast${toast ? " la" : ""}`} role="status">{toast}</div>
    </>
  );
}
