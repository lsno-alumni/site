"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Avatar from "@/components/Avatar";
import { creerClientNavigateur } from "@/lib/supabase/client";
import { debloquer } from "@/lib/messages";

// Les membres que j'ai bloqués (Mon profil) : la liste et le bouton pour
// débloquer. Bloquer se fait depuis un profil ou une conversation à deux.
export default function Blocages() {
  const [liste, setListe] = useState(null);
  const [souci, setSouci] = useState("");
  const charger = async () => {
    const { data } = await creerClientNavigateur().from("blocages")
      .select("bloque, cree_le, profil:profiles!blocages_bloque_fkey(id, prenom, nom, photo_url)").order("cree_le", { ascending: false });
    setListe((data ?? []).map((b) => b.profil).filter(Boolean));
  };
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { charger(); }, []);
  const lever = async (m) => {
    try { await debloquer(m.id); setListe((l) => l.filter((x) => x.id !== m.id)); }
    catch (e) { setSouci("Impossible : " + (e.message ?? "")); setTimeout(() => setSouci(""), 3000); }
  };
  return (
    <details>
      <summary style={{ cursor: "pointer", display: "flex", alignItems: "center", fontSize: 11.5, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--brume)" }}>
        Membres bloqués{liste?.length ? ` · ${liste.length}` : ""}
      </summary>
      <div style={{ paddingTop: 10 }}>
        <p style={{ fontSize: 12.5, color: "var(--brume)", marginBottom: 8 }}>
          Une personne bloquée ne peut plus t&apos;écrire en privé, et vous ne voyez plus vos messages respectifs dans les groupes.
          Pour bloquer quelqu&apos;un : en bas de son profil, ou dans le menu d&apos;une conversation à deux.
        </p>
        {liste === null && <p style={{ fontSize: 12.5, color: "var(--brume)" }}>…</p>}
        {liste?.length === 0 && <p style={{ fontSize: 12.5, color: "var(--texte-2)" }}>Personne. Tant mieux.</p>}
        {liste?.map((m) => (
          <div key={m.id} className="msg-personne statique" style={{ padding: "8px 4px" }}>
            <Link href={`/profil/${m.id}`} className="msg-personne-lien">
              <Avatar profil={{ prenom: m.prenom, nom: m.nom, photo: m.photo_url }} className="pub-avatar" />
              <span><b>{m.prenom} {m.nom}</b></span>
            </Link>
            <button type="button" className="btn btn-nu msg-retirer" onClick={() => lever(m)}>Débloquer</button>
          </div>
        ))}
        {souci && <p style={{ fontSize: 12.5, color: "var(--rouge)" }}>{souci}</p>}
      </div>
    </details>
  );
}
