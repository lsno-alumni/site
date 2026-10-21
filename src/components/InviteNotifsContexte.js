"use client";

import { useEffect, useState } from "react";
import { Bell, Download, X } from "lucide-react";
import { creerClientNavigateur } from "@/lib/supabase/client";
import { pushDispo, abonnementLocal, abonner, refusLocal, CLE_INVITE_ECARTEE } from "@/lib/push";
import { dejaInstallee, plateforme } from "@/lib/installation";
import { ecartee, ecarter, consommerContexte } from "@/lib/invitations";

// L'invitation au bon moment (21/10) : juste après un geste qui appelle une
// réponse — message envoyé, question posée, demande de contact — « Pour savoir
// quand on te répond, active tes notifs ». Même compteur « plus tard » que le
// bandeau de l'accueil (30 jours, trois fois). Sur iPhone sans l'appli, les
// notifications sont impossibles : on propose d'abord l'installation.
//  - declencheur = true : afficher tout de suite (on est sur l'écran du geste) ;
//  - declencheur = "question:12" : afficher si l'écran précédent a posé ce repère.
export default function InviteNotifsContexte({ declencheur }) {
  const [mode, setMode] = useState(null);       // null | "notifs" | "installer"
  const [profilId, setProfilId] = useState(null);
  const [enCours, setEnCours] = useState(false);
  const [fait, setFait] = useState(false);

  useEffect(() => {
    if (!declencheur) return;
    if (typeof declencheur === "string" && !consommerContexte(declencheur)) return;
    if (ecartee(CLE_INVITE_ECARTEE) || refusLocal()) return;
    (async () => {
      const supabase = creerClientNavigateur();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const p = plateforme();
      if (p.startsWith("ios") && !dejaInstallee()) {
        if (p === "ios-safari") { setProfilId(user.id); setMode("installer"); }
        return;
      }
      if (!pushDispo()) return;
      if (await abonnementLocal()) return;
      if (Notification.permission !== "default") return;
      setProfilId(user.id); setMode("notifs");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [declencheur]);

  if (!mode) return null;
  const plusTard = () => { ecarter(CLE_INVITE_ECARTEE); setMode(null); };
  const activer = async () => {
    setEnCours(true);
    try { await abonner(creerClientNavigateur(), profilId); setFait(true); setTimeout(() => setMode(null), 2200); }
    catch { plusTard(); }
    finally { setEnCours(false); }
  };

  return (
    <div className="invite-notif invite-contexte" role="status">
      <span className="ico" aria-hidden>{mode === "installer" ? <Download size={16} strokeWidth={1.9} /> : <Bell size={16} strokeWidth={1.9} />}</span>
      {fait ? (
        <span className="txt"><b>C&apos;est activé ✓</b>{" "}Tu sauras quand on te répond.</span>
      ) : mode === "installer" ? (
        <>
          <span className="txt"><b>Pour savoir quand on te répond</b>{" "}Installe l&apos;appli sur ton iPhone : les notifications passent par elle.</span>
          <a href="/a-propos#installer" className="btn btn-notif">Comment faire</a>
          <button type="button" className="fermer" onClick={plusTard} aria-label="Plus tard"><X size={15} aria-hidden /></button>
        </>
      ) : (
        <>
          <span className="txt"><b>Pour savoir quand on te répond</b>{" "}active tes notifs. Rien de plus : tu choisis ce que tu reçois dans Mon profil.</span>
          <button type="button" className="btn btn-notif" onClick={activer} disabled={enCours}>{enCours ? "…" : "Activer"}</button>
          <button type="button" className="fermer" onClick={plusTard} aria-label="Plus tard"><X size={15} aria-hidden /></button>
        </>
      )}
    </div>
  );
}
