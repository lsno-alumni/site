"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, X } from "lucide-react";
import { creerClientNavigateur } from "@/lib/supabase/client";
import { pushDispo, abonnementLocal, abonner, desabonner } from "@/lib/push";

// Activation des notifications sur CET appareil + choix des familles.
// iOS : ne fonctionne que si le site a été ajouté à l'écran d'accueil
// (iOS 16.4+) — un simple onglet Safari ne peut pas recevoir de push.

// nom lisible à partir du user-agent enregistré
function nomAppareil(ua = "") {
  const nav = /Edg\//.test(ua) ? "Edge"
    : /SamsungBrowser/.test(ua) ? "Samsung Internet"
    : /OPR\//.test(ua) ? "Opera"
    : /Firefox/.test(ua) ? "Firefox"
    : /Chrome/.test(ua) ? "Chrome"
    : /Safari/.test(ua) ? "Safari" : "Navigateur";
  const sys = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad"
    : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows"
    : /Mac OS X/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "";
  return sys ? `${nav} sur ${sys}` : nav;
}

// portées possibles pour la famille « Le réseau » (un seul choix, pas de
// chevauchement possible entre les options)
const PORTEES = [
  { cle: "promo_domaine", nom: "Ma promo et mon domaine" },
  { cle: "promo", nom: "Ma promo seulement" },
  { cle: "domaine", nom: "Mon domaine seulement" },
  { cle: "tout", nom: "Tout le réseau" },
];

const FAMILLES = [
  { cle: "push_mes_demandes", nom: "Mes demandes", detail: "Mise en relation, validation de mon compte, mon rôle" },
  { cle: "push_reseau", nom: "Le réseau", detail: "Arrivées de nouveaux membres (portée réglable ci-dessous)" },
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
  const [appareils, setAppareils] = useState([]);   // tous les appareils abonnés
  const [ici, setIci] = useState(null);             // endpoint de CET appareil

  useEffect(() => {
    const dispo = pushDispo();
    setPossible(dispo);
    if (!dispo) return;
    (async () => {
      const liste = await chargerAppareils();
      const abo = await abonnementLocal();
      if (abo) {
        setIci(abo.endpoint);
        // si l'appareil a été retiré depuis un AUTRE appareil, on respecte ce
        // retrait : on ne le réinscrit pas en silence
        setActif(liste.some((a) => a.endpoint === abo.endpoint));
        return;
      }
      // autorisation déjà accordée mais appareil pas encore enregistré :
      // on l'abonne SANS rien demander (notifications actives par défaut)
      try {
        if (await abonner(supabase, profil.id, { silencieux: true })) {
          setActif(true);
          const a = await abonnementLocal();
          setIci(a?.endpoint ?? null);
          await chargerAppareils();
        }
      } catch { /* rien : l'utilisateur gardera le bouton */ }
    })();
    setPrefs({
      push_mes_demandes: profil?.push_mes_demandes ?? true,
      push_reseau: profil?.push_reseau ?? true,
      push_offres: profil?.push_offres ?? true,
      push_annonces: profil?.push_annonces ?? true,
      push_reseau_portee: profil?.push_reseau_portee ?? "promo_domaine",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chargerAppareils = async () => {
    const { data } = await supabase
      .from("push_abonnements").select("id, endpoint, appareil, cree_le")
      .order("cree_le", { ascending: false });
    setAppareils(data ?? []);
    return data ?? [];
  };

  // retire un appareil (le sien ou un autre, à distance)
  const retirer = async (a) => {
    if (a.endpoint === ici) { await desactiver(); return; }
    await supabase.from("push_abonnements").delete().eq("id", a.id);
    setAppareils((l) => l.filter((x) => x.id !== a.id));
    setMessage("Appareil retiré — il ne recevra plus de notifications.");
  };

  const activer = async () => {
    setEnCours(true); setMessage("");
    try {
      await abonner(supabase, profil.id);
      setActif(true);
      const a = await abonnementLocal();
      setIci(a?.endpoint ?? null);
      await chargerAppareils();
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
      await chargerAppareils();
      setMessage("Notifications désactivées sur cet appareil.");
    } catch (e) {
      setMessage("Échec : " + (e?.message ?? ""));
    } finally {
      setEnCours(false);
    }
  };

  const majPortee = async (valeur) => {
    setPrefs((p) => ({ ...p, push_reseau_portee: valeur }));
    await supabase.from("profiles").update({ push_reseau_portee: valeur }).eq("id", profil.id);
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
      <div className="bloc-notif">
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

          {/* appareils abonnés : un par navigateur. Utile quand on a activé les
              notifications dans plusieurs navigateurs et qu'on reçoit en double. */}
          {appareils.length > 0 && (
            <div className="e-visi">
              <p style={{ fontSize: 11.5, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--brume)" }}>
                {appareils.length} appareil{appareils.length > 1 ? "s" : ""} recevant tes notifications
              </p>
              {appareils.map((a) => (
                <div key={a.id} className="e-ligne">
                  <span className="val">
                    <b style={{ fontSize: 13 }}>{nomAppareil(a.appareil)}</b>
                    <span style={{ display: "block", color: "var(--brume)", fontSize: 11.5 }}>
                      {a.endpoint === ici ? "cet appareil" : "ajouté le " +
                        new Date(a.cree_le).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                    </span>
                  </span>
                  <button type="button" onClick={() => retirer(a)}
                    aria-label={`Retirer ${nomAppareil(a.appareil)}`}
                    style={{ background: "none", border: "none", color: "var(--brume)", cursor: "pointer", padding: 6 }}>
                    <X size={15} aria-hidden />
                  </button>
                </div>
              ))}
              {appareils.length > 1 && (
                <p style={{ fontSize: 11.5, color: "var(--brume)", lineHeight: 1.45 }}>
                  Chaque navigateur reçoit sa propre notification. Retire ceux que tu n&apos;utilises
                  plus pour ne plus recevoir en double.
                </p>
              )}
            </div>
          )}

          {actif && prefs && (
            <div className="e-visi">
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
                  {f.cle === "push_reseau" && prefs.push_reseau && (
                    <div style={{ flexBasis: "100%", marginTop: 8 }}>
                      <select className="saisie" style={{ padding: "9px 12px", fontSize: 12.5 }}
                        value={prefs.push_reseau_portee}
                        onChange={(e) => majPortee(e.target.value)}
                        aria-label="De qui veux-tu être prévenu ?">
                        {PORTEES.map((o) => <option key={o.cle} value={o.cle}>{o.nom}</option>)}
                      </select>
                      {prefs.push_reseau_portee === "tout" && (
                        <span style={{ display: "block", fontSize: 11.5, color: "var(--brume)", marginTop: 5 }}>
                          Bavard à l&apos;arrivée d&apos;une nouvelle promo.
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
      </div>
    </div>
  );
}
