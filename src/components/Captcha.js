"use client";

import { useEffect, useRef, useState } from "react";

// Vérification anti-robot (Cloudflare Turnstile) sur les entrées
// d'authentification : inscription, connexion, mot de passe oublié.
//
// ⚠ DEUX PIÈGES À CONNAÎTRE AVANT DE TOUCHER À CE FICHIER
//
//  ① Quand la protection est activée dans Supabase, elle devient obligatoire sur
//     TOUTES les entrées d'authentification, pas seulement l'inscription :
//     signUp, signInWithPassword, resetPasswordForEmail, resend. Il faut donc
//     fournir un jeton partout, sinon la connexion casse. Ordre de déploiement :
//     ce code d'abord, les clés ensuite, l'interrupteur Supabase en DERNIER.
//
//  ② Sans clé publique dans l'environnement, ce composant ne rend RIEN et ne
//     charge aucun script : le site fonctionne exactement comme avant. C'est ce
//     qui permet de déployer le code sans rien casser, avant d'avoir les clés.
//
// Un jeton ne sert qu'UNE fois et expire (quelques minutes). Après un échec, il
// faut donc redemander une vérification : c'est le rôle de la prop « essai »,
// que le parent incrémente pour reconstruire le composant.

export const CLE_PUBLIQUE = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
export const captchaActif = Boolean(CLE_PUBLIQUE);

// Chargement du script Cloudflare, une seule fois pour toute l'application.
//
// ⚠ Ne PAS se fier à turnstile.ready() : appelé après coup, il ne rappelle
// jamais (constaté à l'essai — le widget restait invisible, sans erreur). La
// méthode fiable est celle que documente Cloudflare : passer au script le nom
// d'une fonction globale via « onload », qu'il appelle quand son API est prête.
const RAPPEL = "__turnstilePret";

let chargement = null;
function chargerScript() {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (chargement) return chargement;
  chargement = new Promise((ok, ko) => {
    window[RAPPEL] = () => ok();
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js"
          + "?render=explicit&onload=" + RAPPEL;
    s.async = true;
    s.defer = true;
    s.onerror = ko;
    document.head.appendChild(s);
  });
  return chargement;
}

// Au-delà de ce délai sans réponse, on cesse de bloquer : mieux vaut laisser
// tenter sa chance que verrouiller dehors quelqu'un dont la vérification
// n'aboutit pas (réseau lent, extension, proxy d'entreprise).
const DELAI_ABANDON = 15000;

export default function Captcha({ onJeton, essai = 0, onAbandon }) {
  const boite = useRef(null);
  const [souci, setSouci] = useState("");

  useEffect(() => {
    if (!captchaActif) return;
    let widget;
    let vivant = true;
    const minuteur = setTimeout(() => {
      if (!vivant) return;
      setSouci("La vérification n'aboutit pas. Tu peux quand même essayer — si ça échoue, recharge la page.");
      onAbandon?.();
    }, DELAI_ABANDON);
    chargerScript()
      .then(() => {
        if (!vivant || !boite.current || !window.turnstile) return;
        boite.current.innerHTML = "";
        widget = window.turnstile.render(boite.current, {
          sitekey: CLE_PUBLIQUE,
          theme: "dark",
          language: "fr",
          callback: (jeton) => { clearTimeout(minuteur); setSouci(""); onJeton(jeton); },
          "expired-callback": () => onJeton(""),
          "error-callback": () => {
            // réseau coupé, script bloqué par une extension… : on le dit, et on
            // ne laisse pas l'utilisateur devant un formulaire qui refuse tout
            setSouci("Vérification anti-robot indisponible. Vérifie ta connexion, puis recharge la page.");
            onJeton("");
          },
        });
      })
      .catch(() => setSouci("Vérification anti-robot impossible à charger (connexion ou bloqueur de scripts)."));
    return () => {
      vivant = false;
      clearTimeout(minuteur);
      try { if (widget && window.turnstile) window.turnstile.remove(widget); } catch { /* déjà retiré */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [essai]);

  if (!captchaActif) return null;

  return (
    <div>
      <div ref={boite} style={{ minHeight: 65 }} />
      {souci && (
        <p role="alert" style={{ fontSize: 12.5, color: "var(--or-clair)", lineHeight: 1.5, marginTop: 6 }}>
          {souci}
        </p>
      )}
    </div>
  );
}
