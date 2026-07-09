import Link from "next/link";
import { notFound } from "next/navigation";
import TabBar from "@/components/TabBar";
import Avatar from "@/components/Avatar";
import { DOMAINES, PAYS, lireProfil } from "@/lib/donnees";

const LIBELLE_VISI = {
  membres: "visible des membres",
  demande: "🔒 sur demande",
  masque: null, // masqué : la ligne n'apparaît pas du tout
};

const CONTACTS = [
  { cle: "whatsapp", ico: "💬", nom: "WhatsApp" },
  { cle: "linkedin", ico: "💼", nom: "LinkedIn" },
  { cle: "email", ico: "✉️", nom: "Email" },
];

export default async function PageProfil({ params }) {
  const { id } = await params;
  const p = await lireProfil(id);
  if (!p) notFound();

  const domaine = DOMAINES.find((d) => d.cle === p.domaine);

  return (
    <main className="page avec-tabbar">
      <div className="p-cover">
        <Link href="/annuaire" className="p-retour" aria-label="Retour à l'annuaire">←</Link>
      </div>
      <div className="p-corps">
        <Avatar profil={p} className="p-photo" />
        <h1>{p.prenom} {p.nom}</h1>
        <p className="statut">{p.statut}</p>
        <div className="p-meta">
          <span className="meta doree">Promotion {p.promotion}</span>
          <span className="meta">
            {PAYS[p.pays] && <img className="drapo" src={PAYS[p.pays].drapeau} alt="" />} {p.ville}
          </span>
          <span className="meta">{domaine?.nom}</span>
          {p.repondAuxCadets && <span className="meta verte">● Répond aux cadets</span>}
        </div>
        <div className="p-actions">
          <button className="btn btn-or">Prendre contact</button>
          <button className="btn btn-nu">Partager</button>
        </div>
      </div>

      <section className="p-bloc">
        <h4>Parcours</h4>
        <div className="chemin">
          {p.parcours.map((e, i) => (
            <div key={i} className={`pas${e.actuel ? " actuel" : ""}`}>
              <div className="annees">{e.annees}</div>
              <b>
                {e.titre.startsWith("LSNO") && (
                  <img src="/img/logo.jpg" alt="" className="mini-blason" />
                )}
                {e.titre}
              </b>
              <span>{e.detail}</span>
            </div>
          ))}
        </div>
      </section>

      {p.conseil && (
        <section className="p-conseil">
          <p className="lbl">Mon conseil aux cadets</p>
          <p>« {p.conseil} »</p>
        </section>
      )}

      <section className="p-contacts">
        {CONTACTS.map((c) => {
          const visi = LIBELLE_VISI[p.contacts[c.cle]];
          if (!visi) return null;
          return (
            <button key={c.cle} className="contact">
              <span className="ico" aria-hidden>{c.ico}</span>
              <span className="val">{c.nom}</span>
              <span className="visi">{visi}</span>
            </button>
          );
        })}
      </section>

      <TabBar actif="Annuaire" />
    </main>
  );
}
