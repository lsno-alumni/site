"use client";

import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { creerClientNavigateur } from "@/lib/supabase/client";
import { pushDispo, abonnementLocal, abonner, refusLocal, CLE_INVITE_ECARTEE } from "@/lib/push";
import { modeInvitationInstall, plateforme } from "@/lib/installation";
import { ecartee, ecarter } from "@/lib/invitations";

// Invitation discrète sur l'accueil, pour les membres qui n'ont pas encore
// autorisé les notifications (le navigateur exige un geste : impossible de les
// activer d'office). Un seul appui suffit, sans passer par Mon profil.
// Écartée, elle revient après 30 jours, trois fois au plus (lib/invitations).
// Sur iPhone elle attend que l'appli soit installée (les notifications en
// dépendent) ; ailleurs elle cohabite avec le bandeau d'installation (21/10).
const CLE_ECARTEE = CLE_INVITE_ECARTEE;

export default function InviteNotifications({ profilId }) {
  const supabase = creerClientNavigateur();
  const [visible, setVisible] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [fait, setFait] = useState(false);

  useEffect(() => {
    if (!pushDispo() || !profilId) return;
    if (ecartee(CLE_ECARTEE)) return;
    if (refusLocal()) return;   // a désactivé volontairement : ne pas le relancer
    (async () => {
      // sur iPhone seulement, l'installation passe devant : sans l'appli, pas de notifications
      if (plateforme().startsWith("ios") && await modeInvitationInstall()) return;
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
      ecarter(CLE_ECARTEE);
    } finally {
      setEnCours(false);
    }
  };

  const ecarter = () => {
    ecarter(CLE_ECARTEE);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="invite-notif">
      <span className="ico" aria-hidden><Bell size={16} strokeWidth={1.9} /></span>
      {fait ? (
        <span className="txt"><b>C&apos;est activé ✓</b>{" "}Tu seras prévenu du mouvement sur le réseau.</span>
      ) : (
        <>
          <span className="txt">
            <b>Active tes notifs</b>{" "}
            Quand quelqu&apos;un te répond ou te demande ton contact, tu le sais tout de suite.
            Rien de plus : tu choisis ce que tu reçois dans Mon profil.
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
