"use client";

import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { creerClientNavigateur } from "@/lib/supabase/client";
import { pushDispo, abonnementLocal, abonner, refusLocal, CLE_INVITE_ECARTEE } from "@/lib/push";
import { modeInvitationInstall } from "@/lib/installation";

// Invitation discrète sur l'accueil, pour les membres qui n'ont pas encore
// autorisé les notifications (le navigateur exige un geste : impossible de les
// activer d'office). Un seul appui suffit, sans passer par Mon profil.
// Écartée une fois, elle ne revient plus (mémorisée sur l'appareil).
const CLE_ECARTEE = CLE_INVITE_ECARTEE;

export default function InviteNotifications({ profilId }) {
  const supabase = creerClientNavigateur();
  const [visible, setVisible] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [fait, setFait] = useState(false);

  useEffect(() => {
    if (!pushDispo() || !profilId) return;
    if (localStorage.getItem(CLE_ECARTEE)) return;
    if (refusLocal()) return;   // a désactivé volontairement : ne pas le relancer
    (async () => {
      // un seul bandeau à la fois : l'installation passe devant, sur tous les appareils
      if (await modeInvitationInstall()) return;
      if (await abonnementLocal()) return;                  // déjà abonné
      if (Notification.permission === "granted") {
        // autorisation déjà là : on enregistre sans rien demander
        try { await abonner(supabase, profilId, { silencieux: true }); return; } catch { /* on invite */ }
      }
      if (Notification.permission === "denied") return;     // refus explicite : on n'insiste pas
      setVisible(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profilId]);

  const activer = async () => {
    setEnCours(true);
    try {
      await abonner(supabase, profilId);
      setFait(true);
      setTimeout(() => setVisible(false), 2200);
    } catch {
      setVisible(false);   // refus : on ne redemande pas
      localStorage.setItem(CLE_ECARTEE, "1");
    } finally {
      setEnCours(false);
    }
  };

  const ecarter = () => {
    localStorage.setItem(CLE_ECARTEE, "1");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="invite-notif">
      <span className="ico" aria-hidden><Bell size={16} strokeWidth={1.9} /></span>
      {fait ? (
        <span className="txt"><b>C&apos;est activé ✓</b> Tu seras prévenu du mouvement sur le réseau.</span>
      ) : (
        <>
          <span className="txt">
            <b>Active tes notifs</b>
            Demandes de contact, nouvelles offres, arrivées… Tu peux tout paramétrer
            ensuite dans « Mon profil ».
          </span>
          <button type="button" className="btn btn-notif" onClick={activer} disabled={enCours}>
            {enCours ? "…" : "Activer"}
          </button>
          <button type="button" className="fermer" onClick={ecarter} aria-label="Plus tard">
            <X size={15} aria-hidden />
          </button>
        </>
      )}
    </div>
  );
}
