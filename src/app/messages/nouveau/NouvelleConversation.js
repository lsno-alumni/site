"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { texteErreur } from "@/lib/erreurs";
import { useRouter, useSearchParams } from "next/navigation";
import { X, Check, Search, Users } from "lucide-react";
import Avatar from "@/components/Avatar";
import { membresJoignables, ouvrirDuo, creerGroupe, envoyerLien, ACCES } from "@/lib/messages";
import { VISIBILITES } from "@/lib/fil";

// Le carnet : on coche une personne (conversation à deux) ou plusieurs (un
// groupe à nommer). La recherche filtre sur le prénom, le nom, la promo.
export default function NouvelleConversation({ enFeuille = false }) {
  const routeur = useRouter();
  const params = useSearchParams();
  const lien = params.get("lien");            // « Envoyer en message » vers une nouvelle conversation
  const titreLien = params.get("titre");
  const [membres, setMembres] = useState(null);
  const [q, setQ] = useState("");
  const [choisis, setChoisis] = useState([]);   // ids
  const [nom, setNom] = useState("");
  const [acces, setAcces] = useState("prive");        // migration 68 : privé / sur demande / ouvert
  const [visibilite, setVisibilite] = useState("tous");
  const [envoi, setEnvoi] = useState(false);
  const [souci, setSouci] = useState("");

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { membresJoignables().then(setMembres).catch((e) => { setSouci(texteErreur(e)); setMembres([]); }); }, []);

  const filtres = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (membres ?? []).filter((m) => !t || `${m.prenom} ${m.nom} promo ${m.promotions?.numero ?? ""}`.toLowerCase().includes(t));
  }, [membres, q]);

  const basculer = (id) => setChoisis((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
  // la rangée des choisis défile sur une seule ligne : le dernier ajouté est amené en vue
  const rangee = useRef(null);
  useEffect(() => { const r = rangee.current; if (r) r.scrollTo({ left: r.scrollWidth, behavior: "smooth" }); }, [choisis.length]);
  const groupe = choisis.length > 1;
  const pret = choisis.length > 0 && (!groupe || nom.trim().length > 0) && !envoi;

  const commencer = async () => {
    if (!pret) return;
    setEnvoi(true); setSouci("");
    try {
      const id = groupe ? await creerGroupe(nom, choisis, { acces, visibilite }) : await ouvrirDuo(choisis[0]);
      if (lien) await envoyerLien(id, lien, titreLien);
      // en feuille : la conversation n'a pas de feuille associée, la feuille resterait
      // affichée par-dessus (créneau parallèle) → navigation complète
      if (enFeuille) window.location.assign(`/messages/${id}`); else routeur.replace(`/messages/${id}`);
    } catch (e) { setSouci("Impossible d'ouvrir la conversation : " + texteErreur(e)); setEnvoi(false); }
  };

  return (
    <div className={`cp${enFeuille ? " cp-feuille" : ""}`}>
      <div className="msg-nc-haut">
      <header className="cp-tete">
        <button type="button" className="cp-fermer" onClick={() => routeur.back()} aria-label="Annuler"><X size={20} aria-hidden /></button>
        <span className="cp-titre">{groupe ? "Nouveau groupe" : "Nouvelle conversation"}</span>
        <button type="button" className={`btn btn-or cp-publier${pret ? "" : " off"}`} disabled={!pret} onClick={commencer}>
          {envoi ? "…" : groupe ? "Créer" : "Écrire"}
        </button>
      </header>

      {groupe && (
        <>
          <div className="msg-nom-groupe">
            <Users size={18} strokeWidth={1.8} aria-hidden />
            <input className="saisie" placeholder="Nom du groupe (ex. Promo 3 Rabat)" value={nom} maxLength={60} onChange={(e) => setNom(e.target.value)} />
          </div>
          <div className="gr-reglages" style={{ padding: "0 20px" }}>
            <div className="n-filtres" role="radiogroup" aria-label="Qui peut rejoindre">
              {ACCES.map((a) => (
                <button key={a.cle} type="button" role="radio" aria-checked={acces === a.cle} className={`puce${acces === a.cle ? " active" : ""}`} onClick={() => setAcces(a.cle)} title={a.aide}>{a.nom}</button>
              ))}
            </div>
            <small className="msg-aide" style={{ padding: 0 }}>{ACCES.find((a) => a.cle === acces)?.aide}</small>
            {acces !== "prive" && (
              <div className="n-filtres" role="radiogroup" aria-label="Visible par">
                {VISIBILITES.map((v) => (
                  <button key={v.cle} type="button" role="radio" aria-checked={visibilite === v.cle} className={`puce${visibilite === v.cle ? " active" : ""}`} onClick={() => setVisibilite(v.cle)} title={v.aide}>{v.nom}</button>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {choisis.length > 0 && (
        <div className="msg-choisis-ligne">
        {choisis.length > 3 && <span className="msg-choisis-nb">{choisis.length}</span>}
        <div className="msg-choisis" ref={rangee} role="list" aria-label={`${choisis.length} membre${choisis.length > 1 ? "s" : ""} choisi${choisis.length > 1 ? "s" : ""}`}>
          {choisis.map((id) => { const m = membres?.find((x) => x.id === id); return m ? (
            <button key={id} type="button" className="msg-choisi" onClick={() => basculer(id)}>
              <Avatar profil={{ prenom: m.prenom, nom: m.nom, photo: m.photo_url }} className="com-avatar" />{m.prenom} <X size={12} aria-hidden />
            </button>) : null; })}
        </div>
        </div>
      )}

      <div className="msg-recherche">
        <Search size={16} strokeWidth={1.9} aria-hidden />
        <input className="saisie" placeholder="Rechercher un membre…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      </div>
      {lien && <p className="msg-aide" style={{ color: "var(--bleu-texte)" }}>Sera envoyé : {titreLien || lien}</p>}
      </div>
      <p className="msg-aide">{groupe ? "Plusieurs personnes : ce sera un groupe." : "Une personne : conversation à deux. Coche-en plusieurs pour un groupe."}</p>
      {souci && <p className="cp-souci" role="alert">{souci}</p>}

      <div className="msg-carnet">
        {membres === null && <p className="pu-vide">Chargement…</p>}
        {membres !== null && filtres.length === 0 && <p className="pu-vide">Personne ne correspond.</p>}
        {filtres.map((m) => {
          const on = choisis.includes(m.id);
          return (
            <button key={m.id} type="button" className={`msg-personne${on ? " on" : ""}`} onClick={() => basculer(m.id)} aria-pressed={on}>
              <Avatar profil={{ prenom: m.prenom, nom: m.nom, photo: m.photo_url }} className="pub-avatar" />
              <span><b>{m.prenom} {m.nom}</b><small>Promo {m.promotions?.numero}</small></span>
              <span className="msg-coche" aria-hidden>{on && <Check size={14} strokeWidth={2.6} />}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
