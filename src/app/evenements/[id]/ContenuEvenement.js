"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, MapPin, Video, Users, MoreHorizontal, Share2, Award, Ban, Check, HelpCircle, CalendarPlus, ExternalLink, MessageCircle, Camera, Trash2, Copy, Pencil, MessagesSquare } from "lucide-react";
import Avatar from "@/components/Avatar";
import Commentaires from "@/components/Commentaires";
import Collage from "@/components/Collage";
import EnvoyerEnMessage from "@/components/EnvoyerEnMessage";
import useClicDehors from "@/lib/useClicDehors";
import { signaler, VISIBILITES } from "@/lib/fil";
import useTempsReel from "@/lib/tempsReel";
import { lireEvenement, repondre, annulerEvenement, supprimerEvenement, modererEvenement, creerDiscussion, ajouterPhoto, supprimerPhoto, quandLong, dansCombien, ou, urlAffiche, urlPhoto, estPasse, fichierIcs, lienGoogleAgenda, REPONSES } from "@/lib/evenements";

// Un événement ouvert (page /evenements/[id] ET feuille depuis la liste ou le
// Fil). TeteEvenement (affiche, date, titre : glissable) puis SuiteEvenement
// (réponses, participants, agenda, actions, photos, commentaires).

export function TeteEvenement({ e }) {
  const affiche = urlAffiche(e);
  const d = new Date(e.debut);
  return (
    <div className={`ev-tete${affiche ? " avec-affiche" : ""}`}>
      {affiche && <img className="ev-affiche" src={affiche} alt="" />}
      <div className="ev-tete-texte">
        <span className="ev-haut">
          {e.officiel && <span className="ev-officiel"><Award size={11} aria-hidden /> Amicale</span>}
          {e.annule && <span className="ev-annule"><Ban size={11} aria-hidden /> Annulé</span>}
          {e.masque && <span className="ev-annule">masqué par la modération</span>}
          {!e.annule && !estPasse(e) && dansCombien(e) && <span className="ev-dans">{dansCombien(e)}</span>}
          {e.visibilite !== "tous" && <span className="pub-visi">{VISIBILITES.find((v) => v.cle === e.visibilite)?.court}</span>}
        </span>
        <div className="ev-tete-ligne">
          <span className="ev-date grande" aria-hidden><b>{d.getDate()}</b><small>{d.toLocaleDateString("fr-FR", { month: "short" }).replace(".", "")}</small></span>
          <h1 className="ev-titre-page">{e.titre}</h1>
        </div>
      </div>
    </div>
  );
}

export function SuiteEvenement({ e: initial, moi, moderateur, enFeuille = false, onMaj }) {
  const routeur = useRouter();
  const [e, setE] = useState(initial);
  const [menu, setMenu] = useState(false);
  const [occupe, setOccupe] = useState("");
  const [toast, setToast] = useState("");
  const [nb, setNb] = useState(initial.nb_commentaires ?? 0);
  const menuRef = useRef(null);
  const photoRef = useRef(null);
  useClicDehors(menu, (ev) => menuRef.current?.contains(ev.target), () => setMenu(false));
  const signale = (t) => { setToast(t); setTimeout(() => setToast(""), 2600); };
  const recharger = async () => { try { const n = await lireEvenement(e.id); if (n) { setE(n); onMaj?.(n); } } catch { /* on garde l'état */ } };
  // réponses, photos, changements : la fiche se met à jour seule
  useTempsReel([{ table: "evenement_reponses", filtre: `evenement_id=eq.${initial.id}` }, { table: "evenements", filtre: `id=eq.${initial.id}` }, { table: "evenement_photos", filtre: `evenement_id=eq.${initial.id}` }], recharger);
  const [recu, setRecu] = useState(initial);
  if (recu !== initial) { setRecu(initial); setE(initial); }
  const o = e.organisateur ?? {};
  const passe = estPasse(e);
  const participe = e.est_moi || e.ma_reponse === "oui";
  const oui = (e.participants ?? []).filter((p) => p.reponse === "oui");
  const peutEtre = (e.participants ?? []).filter((p) => p.reponse === "peut_etre");

  const agir = async (action, arg) => {
    setMenu(false);
    try {
      if (action === "reponse") { setOccupe("reponse"); await repondre(e.id, e.ma_reponse === arg ? null : arg); await recharger(); }
      if (action === "partager") {
        const url = `${window.location.origin}/evenements/${e.id}`;
        if (navigator.share) await navigator.share({ title: e.titre, text: `${e.titre} — ${quandLong(e)}`, url });
        else { await navigator.clipboard.writeText(url); signale("Lien copié"); }
      }
      if (action === "ics") {
        const url = URL.createObjectURL(fichierIcs(e));
        const a = document.createElement("a"); a.href = url; a.download = `${e.titre.replace(/[^\w\dàâäéèêëîïôöùûüç -]/gi, "").slice(0, 40) || "evenement"}.ics`; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      }
      if (action === "google") window.open(lienGoogleAgenda(e), "_blank", "noopener");
      if (action === "modifier") routeur.push(`/evenements/nouveau?modifier=${e.id}`);
      if (action === "dupliquer") routeur.push(`/evenements/nouveau?depuis=${e.id}`);
      if (action === "annuler") { if (!confirm(e.annule ? "Rétablir cet événement ?" : "Annuler cet événement ? Les participants seront prévenus.")) return; await annulerEvenement(e.id, !e.annule); await recharger(); }
      if (action === "supprimer") { if (!confirm("Supprimer définitivement cet événement ?")) return; await supprimerEvenement(e); signale("Événement supprimé"); if (enFeuille) routeur.back(); else routeur.push("/evenements"); }
      if (action === "signaler") { await signaler("evenement", e.id, "Événement signalé depuis l'application"); signale("Merci, les modérateurs sont prévenus."); }
      if (action === "masquer") { await modererEvenement(e.id, !e.masque); await recharger(); }
      if (action === "discussion") { setOccupe("discussion"); const cid = await creerDiscussion(e); routeur.push(`/messages/${cid}`); }
      if (action === "photo") { setOccupe("photo"); await ajouterPhoto(e.id, arg); await recharger(); signale("Photo ajoutée"); }
      if (action === "supprimer_photo") { if (!confirm("Retirer cette photo ?")) return; await supprimerPhoto(arg); await recharger(); }
    } catch (err) { if (err?.name !== "AbortError") signale("Action impossible : " + (err.message ?? "")); }
    setOccupe("");
  };

  return (
    <div className="ev-suite">
      <div className="ev-infos">
        <p><CalendarDays size={16} aria-hidden /> <span>{quandLong(e)}</span></p>
        {e.lieu_type === "en_ligne"
          ? <p><Video size={16} aria-hidden /> <span>En ligne{e.lien && <> · <a href={e.lien} target="_blank" rel="noopener noreferrer" className="ev-lien">rejoindre <ExternalLink size={12} aria-hidden /></a></>}</span></p>
          : <p><MapPin size={16} aria-hidden /> <span>{ou(e) || "Lieu à préciser"}{ou(e) && <> · <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ou(e))}`} target="_blank" rel="noopener noreferrer" className="ev-lien">carte <ExternalLink size={12} aria-hidden /></a></>}</span></p>}
        <p><Link href={`/profil/${o.id}`} className="qa-qui"><Avatar profil={{ prenom: o.prenom ?? "?", nom: o.nom ?? "", photo: o.photo_url }} className="com-avatar" />Organisé par {e.est_moi ? "toi" : `${o.prenom} ${o.nom}`}{o.promo ? ` · Promo ${o.promo}` : ""}</Link></p>
      </div>

      {!passe && !e.annule && (
        <div className="ev-reponses" role="group" aria-label="Ta réponse">
          {REPONSES.map((r) => (
            <button key={r.cle} type="button" className={`ev-reponse${e.ma_reponse === r.cle ? " on" : ""}`} disabled={occupe === "reponse"} onClick={() => agir("reponse", r.cle)} aria-pressed={e.ma_reponse === r.cle}>
              {r.cle === "oui" ? <Check size={16} aria-hidden /> : <HelpCircle size={16} aria-hidden />} {r.nom}
            </button>
          ))}
          <button type="button" className="ev-agenda" onClick={() => agir("ics")} title="Ajouter à mon agenda"><CalendarPlus size={16} aria-hidden /> Agenda</button>
          <button type="button" className="ev-agenda" onClick={() => agir("google")} title="Ajouter à Google Agenda">Google</button>
        </div>
      )}

      <div className="ev-participants">
        <b><Users size={14} aria-hidden /> {oui.length > 0 ? `${oui.length} ${oui.length > 1 ? "y vont" : "y va"}` : passe ? "Aucun participant enregistré" : "Personne pour l’instant"}{peutEtre.length > 0 ? ` · ${peutEtre.length} peut-être` : ""}</b>
        {(e.participants ?? []).length > 0 && (
          <div className="ev-avatars">
            {(e.participants ?? []).map((p) => (
              <Link key={p.id} href={`/profil/${p.id}`} className={`ev-avatar${p.reponse === "peut_etre" ? " peut-etre" : ""}`} title={`${p.prenom} ${p.nom}${p.reponse === "peut_etre" ? " (peut-être)" : ""}`}>
                <Avatar profil={{ prenom: p.prenom, nom: p.nom, photo: p.photo_url }} className="pub-avatar" />
              </Link>
            ))}
          </div>
        )}
      </div>

      {e.description && <p className="ev-description-texte">{e.description}</p>}

      <div className="pub-pied pu-actions ev-actions">
        <span className="pub-action" style={{ cursor: "default" }}><MessageCircle size={16} strokeWidth={1.9} aria-hidden /> {nb} commentaire{nb > 1 ? "s" : ""}</span>
        <EnvoyerEnMessage chemin={`/evenements/${e.id}`} titre={e.titre} className="pub-action" libelle="" />
        <button type="button" className="pub-action" aria-label="Partager" onClick={() => agir("partager")}><Share2 size={16} strokeWidth={1.9} aria-hidden /></button>
        <span className="pub-menu qa-menu" ref={menuRef} style={{ marginLeft: "auto" }}>
          <button type="button" className="pub-plus" aria-label="Options" onClick={() => setMenu(!menu)}><MoreHorizontal size={18} aria-hidden /></button>
          {menu && (
            <span className="pub-menu-liste">
              {e.est_moi && !passe && <button type="button" onClick={() => agir("modifier")}><Pencil size={14} aria-hidden /> Modifier</button>}
              <button type="button" onClick={() => agir("dupliquer")}><Copy size={14} aria-hidden /> Dupliquer</button>
              {e.est_moi && (e.participants ?? []).length > 0 && <button type="button" onClick={() => agir("discussion")}><MessagesSquare size={14} aria-hidden /> {occupe === "discussion" ? "Création…" : "Créer la discussion"}</button>}
              {e.est_moi && !passe && <button type="button" onClick={() => agir("annuler")}><Ban size={14} aria-hidden /> {e.annule ? "Rétablir" : "Annuler l’événement"}</button>}
              {!e.est_moi && <button type="button" onClick={() => agir("signaler")}>Signaler</button>}
              {moderateur && !e.est_moi && <button type="button" onClick={() => agir("masquer")}>{e.masque ? "Rétablir" : "Masquer"}</button>}
              {(e.est_moi || moi.role === "admin") && <button type="button" className="danger" onClick={() => agir("supprimer")}><Trash2 size={14} aria-hidden /> Supprimer</button>}
            </span>
          )}
        </span>
      </div>

      {(passe || (e.photos ?? []).length > 0) && (
        <section className="ev-photos">
          <div className="ev-photos-tete">
            <b><Camera size={14} aria-hidden /> Photos {passe ? "de la rencontre" : ""}{(e.photos ?? []).length > 0 ? ` (${e.photos.length})` : ""}</b>
            {participe && passe && <button type="button" className="btn btn-nu" style={{ padding: "7px 12px", fontSize: 12.5 }} onClick={() => photoRef.current?.click()} disabled={occupe === "photo"}>{occupe === "photo" ? "Envoi…" : "Ajouter une photo"}</button>}
          </div>
          {(e.photos ?? []).length === 0 && <p className="msg-aide" style={{ padding: "4px 0 0" }}>{participe ? "Tu y étais ? Partage une photo, elle restera ici." : "Les participants pourront y déposer leurs photos."}</p>}
          <Collage urls={(e.photos ?? []).map(urlPhoto)} className="collage-page" />
          {(e.photos ?? []).some((f) => f.auteur === moi.id || e.est_moi || moi.role === "admin") && (e.photos ?? []).length > 0 && (
            <div className="ev-photos-gestion">
              {(e.photos ?? []).filter((f) => f.auteur === moi.id || e.est_moi || moi.role === "admin").map((f, i) => (
                <button key={f.id} type="button" className="ev-photo-suppr" onClick={() => agir("supprimer_photo", f)} aria-label={`Retirer la photo ${i + 1}`}><Trash2 size={13} aria-hidden /> photo {(e.photos ?? []).indexOf(f) + 1}</button>
              ))}
            </div>
          )}
          <input ref={photoRef} type="file" accept="image/*" hidden onChange={(ev) => { const f = ev.target.files?.[0]; ev.target.value = ""; if (f) agir("photo", f); }} />
        </section>
      )}

      <Commentaires type="evenement" id={e.id} moi={moi} onNombre={setNb} moderateur={moderateur} fixe={enFeuille} />
      <div className={`toast${toast ? " la" : ""}`} role="status">{toast}</div>
    </div>
  );
}

export default function ContenuEvenement({ e: initial, moi, moderateur }) {
  const [e, setE] = useState(initial);
  const [recu, setRecu] = useState(initial);
  if (recu !== initial) { setRecu(initial); setE(initial); }
  return (
    <>
      <TeteEvenement e={e} />
      <SuiteEvenement e={e} moi={moi} moderateur={moderateur} onMaj={setE} />
    </>
  );
}
