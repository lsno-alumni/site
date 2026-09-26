"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { MessageCircle, PenLine, Users } from "lucide-react";
import Avatar from "@/components/Avatar";
import GlisserRafraichir from "@/components/GlisserRafraichir";
import { RestaurerDefilement } from "@/components/SuiviNavigation";
import { SqueletteFiche } from "@/components/Squelettes";
import * as memoire from "@/lib/memoire";
import { depuis } from "@/lib/fil";
import { mesConversations, nomConversation, ecouterTousMessages, JOURS_CONSERVATION } from "@/lib/messages";

// La liste des conversations : la plus récente en haut, pastille des non
// lus, aperçu du dernier message. Une ligne = une conversation (à deux ou
// groupe), qui s'ouvre en pleine page (/messages/[id]).

function Vignette({ c }) {
  if (c.type === "groupe") {
    const deux = (c.membres ?? []).slice(0, 2);
    return (
      <span className="msg-vignette groupe" aria-hidden>
        {deux.length === 0 && <Users size={18} strokeWidth={1.8} />}
        {deux.map((m, i) => <Avatar key={m.id} profil={{ prenom: m.prenom, nom: m.nom, photo: m.photo_url }} className={`msg-mini m${i}`} />)}
      </span>
    );
  }
  const a = c.membres?.[0];
  return a ? <Avatar profil={{ prenom: a.prenom, nom: a.nom, photo: a.photo_url }} className="msg-vignette" /> : <span className="msg-vignette avatar-init">?</span>;
}

export default function Conversations({ moi }) {
  const routeur = useRouter();
  const chemin = usePathname();
  const [liste, setListe] = useState(() => memoire.lire("messages.liste") ?? null);
  const [souci, setSouci] = useState("");

  const charger = async () => {
    try { setListe(await mesConversations()); setSouci(""); }
    catch (e) { setSouci("Les messages ne répondent pas : " + (e.message ?? "")); if (liste === null) setListe([]); }
  };
  // au montage et à chaque retour sur /messages (une conversation lue change les compteurs)
  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
  useEffect(() => { if (chemin === "/messages") charger(); }, [chemin]);
  useEffect(() => { if (liste !== null) memoire.ecrire("messages.liste", liste); }, [liste]);
  // temps réel : un message qui arrive (ou que j'envoie ailleurs) remet la liste à jour
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => ecouterTousMessages(() => charger()), []);

  const rafraichir = async () => { await charger(); routeur.refresh(); };

  return (
    <GlisserRafraichir onRafraichir={rafraichir}>
    <>
      <header className="n-tete tete-portail tete-messages">
        <h1>Messages</h1>
        <p className="cpt">Entre membres, à deux ou en groupe. Les messages s&apos;effacent après {JOURS_CONSERVATION} jours.</p>
      </header>

      <div className="msg-liste">
        {liste === null && [0, 1, 2].map((i) => <SqueletteFiche key={i} />)}
        {liste?.length === 0 && (
          <div className="vide" style={{ paddingTop: 40 }}>
            <div className="gros" aria-hidden><MessageCircle size={30} strokeWidth={1.6} /></div>
            <b>Aucune conversation</b>{" "}
            Écris à un membre depuis son profil, ou commence ici avec la plume.
          </div>
        )}
        {liste?.map((c) => {
          const d = c.dernier;
          const apercu = d ? `${d.auteur === moi.id ? "Toi" : d.prenom} : ${d.texte}` : "Nouvelle conversation";
          return (
            <Link key={c.id} href={`/messages/${c.id}`} className={`msg-ligne${c.non_lus > 0 ? " non-lu" : ""}`}>
              <Vignette c={c} />
              <span className="msg-ligne-corps">
                <span className="msg-ligne-haut">
                  <b>{nomConversation(c)}</b>
                  <small>{d ? depuis(d.cree_le) : ""}</small>
                </span>
                <span className="msg-ligne-bas">
                  <span className="msg-apercu">{apercu}</span>
                  {c.non_lus > 0 && <span className="msg-pastille">{c.non_lus > 99 ? "99+" : c.non_lus}</span>}
                </span>
                {c.type === "groupe" && <small className="msg-ligne-meta">{c.nb_membres} membres</small>}
              </span>
            </Link>
          );
        })}
        {souci && <p className="vide">{souci}</p>}
      </div>

      <Link href="/messages/nouveau" className="fil-fab" aria-label="Nouvelle conversation"><PenLine size={20} strokeWidth={2} aria-hidden /></Link>
      <RestaurerDefilement />
    </>
    </GlisserRafraichir>
  );
}
