"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Avatar from "@/components/Avatar";
import IconeDomaine from "@/components/IconeDomaine";
import { DOMAINES, nomDomaine } from "@/lib/donnees";

export default function Conseils({ conseils }) {
  const [domaine, setDomaine] = useState("tous");

  // domaines réellement présents (dans l'ordre de DOMAINES), + compte
  const groupes = useMemo(() => {
    return DOMAINES
      .map((d) => ({ ...d, items: conseils.filter((c) => c.domaine === d.cle) }))
      .filter((g) => g.items.length > 0);
  }, [conseils]);

  const visibles = domaine === "tous" ? groupes : groupes.filter((g) => g.cle === domaine);

  return (
    <>
      <div className="n-filtres" style={{ position: "static" }}>
        <button className={`puce${domaine === "tous" ? " active" : ""}`} onClick={() => setDomaine("tous")}>Tous</button>
        {groupes.map((g) => (
          <button key={g.cle} className={`puce${domaine === g.cle ? " active" : ""}`} onClick={() => setDomaine(g.cle)}>
            {g.nom.split(" &")[0]}
          </button>
        ))}
      </div>

      <div className="n-liste" style={{ paddingTop: 4 }}>
        {visibles.map((g) => (
          <section key={g.cle} style={{ marginBottom: 8 }}>
            <h2 className="a-titre" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span className="pictol" style={{ display: "inline-flex" }}><IconeDomaine domaine={g.cle} taille={17} /></span>
              {g.nom.split(" &")[0]}
            </h2>
            {g.items.map((c) => (
              <div key={c.id} className="a-temoin" style={{ margin: "0 0 12px" }}>
                <p>{c.conseil}</p>
                <Link href={`/profil/${c.id}`} className="qui">
                  <Avatar profil={{ prenom: c.prenom, nom: c.nom, photo: c.photo_url }} className="am-conseil-photo" />
                  <div>
                    <b>{c.prenom} {c.nom}</b>
                    <span>Promotion {c.promotions?.numero} · {nomDomaine(c.domaine, c.domaine_precision, true)}</span>
                  </div>
                </Link>
              </div>
            ))}
          </section>
        ))}

        {groupes.length === 0 && (
          <div className="vide" style={{ paddingTop: 40 }}>
            <b>Pas encore de conseils</b>
            Les conseils aux cadets apparaîtront ici à mesure que les membres complètent leur profil.
          </div>
        )}
      </div>
    </>
  );
}
