"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { creerClientNavigateur } from "@/lib/supabase/client";
import { pushDispo, abonnementLocal, abonner, desabonner } from "@/lib/push";

// Activation des notifications sur CET appareil + choix des familles.
// iOS : ne fonctionne que si le site a été ajouté à l'écran d'accueil
// (iOS 16.4+) — un simple onglet Safari ne peut pas recevoir de push.

const FAMILLES = [
  { cle: "push_mes_demandes", nom: "Mes demandes", detail: "Mise en relation, validation de mon compte, mon rôle" },
  { cle: "push_reseau", nom: "Le réseau", detail: "Nouveaux membres de ma promo ou de mon domaine" },
  { cle: "push_offres", nom: "Offres", detail: "Nouvelles opportunités partagées" },
  { cle: "push_annonces", nom: "Annonces", detail: "Messages adressés à tout le réseau" },
];

export default function Notifications({ profil }) {
  const supabase = creerClientNavigateur();
  const [possible, setPossible] = useState(null); // null = on vérifie
  const [actif, setActif] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState("");
  const [prefs, setPrefs] = useState(null);

  useEffect(() => {
    const dispo = pushDispo();
    setPossible(dispo);
    if (!dispo) return;
    (async () => {
      const abo = await abonnementLocal();
      if (abo) { setActif(true); return; }
      // autorisation déjà accordée mais appareil pas encore enregistré :
      // on l'abonne SANS rien demander (notifications actives par défaut)
      try { if (await abonner(supabase, profil.id, { silencieux: true })) setActif(true); }
      catch { /* rien : l'utilisateur gardera le bouton */ }
    })();
    setPrefs({
      push_mes_demandes: profil?.push_mes_demandes ?? true,
      push_reseau: profil?.push_reseau ?? true,
      push_offres: profil?.push_offres ?? true,
      push_annonces: profil?.push_annonces ?? true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activer = async () => {
    setEnCours(true); setMessage("");
    try {
      await abonner(supabase, profil.id);
      setActif(true);
      setMessage("Notifications activées sur cet appareil ✓");
    } catch (e) {
      setMessage(e?.message === "autorisation refusée"
        ? "Autorisation refusée — tu peux la rétablir dans les réglages du navigateur."
        : "Échec : " + (e?.message ?? "impossible d'activer"));
    } finally {
      setEnCours(false);
    }
  };

  const desactiver = async () => {
    setEnCours(true); setMessage("");
    try {
      await desabonner(supabase);
      setActif(false);
      setMessage("Notifications désactivées sur cet appareil.");
    } catch (e) {
      setMessage("Échec : " + (e?.message ?? ""));
    } finally {
      setEnCours(false);
    }
  };

  const majPref = async (cle) => {
    const valeur = !prefs[cle];
    setPrefs({ ...prefs, [cle]: valeur });
    await supabase.from("profiles").update({ [cle]: valeur }).eq("id", profil.id);
  };

  if (possible === null) return null;

  return (
    <div className="champ">
      <label>Notifications</label>
      {!possible ? (
        <p style={{ fontSize: 12.5, color: "var(--brume)", lineHeight: 1.5 }}>
          Ce navigateur ne gère pas les notifications. Sur iPhone, ajoute d&apos;abord le
          site à ton écran d&apos;accueil (Partager › Sur l&apos;écran d&apos;accueil), puis reviens ici.
        </p>
      ) : (
        <>
          <button type="button" className={`btn ${actif ? "btn-nu" : "btn-notif"}`}
            style={{ padding: "12px 18px", fontSize: 13.5 }}
            onClick={actif ? desactiver : activer} disabled={enCours}>
            {actif ? <BellOff size={15} aria-hidden /> : <Bell size={15} aria-hidden />}
            {enCours ? "…" : actif ? "Désactiver sur cet appareil" : "Activer les notifications"}
          </button>
          <p style={{ fontSize: 12, color: "var(--brume)", marginTop: 8, lineHeight: 1.5 }}>
            {actif
              ? "Tu seras prévenu même quand l'appli est fermée. À activer sur chaque appareil."
              : "Être prévenu d'une demande de contact, d'une nouvelle offre… sans ouvrir le site."}
          </p>
          {message && (
            <p style={{ fontSize: 12, color: "var(--or-clair)", marginTop: 6, lineHeight: 1.5 }}>{message}</p>
          )}

          {actif && prefs && (
            <div className="e-visi" style={{ marginTop: 12 }}>
              {FAMILLES.map((f) => (
                <div key={f.cle} className="e-ligne">
                  <span className="val">
                    <b style={{ fontSize: 13 }}>{f.nom}</b>
                    <span style={{ display: "block", color: "var(--brume)", fontSize: 11.5, lineHeight: 1.4 }}>
                      {f.detail}
                    </span>
                  </span>
                  <div className="seg" role="radiogroup" aria-label={f.nom}>
                    <button type="button" className={prefs[f.cle] ? "on" : ""}
                      onClick={() => prefs[f.cle] || majPref(f.cle)} role="radio" aria-checked={prefs[f.cle]}>
                      Oui
                    </button>
                    <button type="button" className={!prefs[f.cle] ? "on" : ""}
                      onClick={() => prefs[f.cle] && majPref(f.cle)} role="radio" aria-checked={!prefs[f.cle]}>
                      Non
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
