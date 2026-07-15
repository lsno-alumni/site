import Link from "next/link";
import { notFound } from "next/navigation";
import TabBar from "@/components/TabBar";
import PhotoProfil from "@/components/PhotoProfil";
import { Mail, Lock, BadgeCheck } from "lucide-react";
import { IconeLinkedin, IconeWhatsApp } from "@/components/Marques";
import { DOMAINES, PAYS } from "@/lib/donnees";
import { lireProfil, lireContacts, statutDemande } from "@/lib/api";
import DemandeContact from "./DemandeContact";

function lienWhatsApp(v) {
  const chiffres = v.replace(/[^\d+]/g, "").replace(/^\+/, "");
  return `https://wa.me/${chiffres}`;
}
function lienLinkedIn(v) {
  if (v.startsWith("http")) return v;
  return `https://www.linkedin.com/in/${v.replace(/^@/, "")}`;
}

export default async function PageProfil({ params }) {
  const { id } = await params;
  const [p, contacts, demande] = await Promise.all([
    lireProfil(id),
    lireContacts(id),
    statutDemande(id),
  ]);
  if (!p) notFound();

  // des contacts « sur demande » existent-ils chez ce membre ?
  const aSurDemande = ["whatsapp", "email", "linkedin"]
    .some((c) => contacts?.visi?.[c] === "demande");

  const domaine = DOMAINES.find((d) => d.cle === p.domaine);

  const verrou = (
    <>
      <Lock size={11} aria-hidden style={{ verticalAlign: "-1px" }} /> sur demande
    </>
  );
  const lignes = [
    contacts?.whatsapp && {
      Ico: IconeWhatsApp, nom: "WhatsApp", href: lienWhatsApp(contacts.whatsapp), note: "ouvrir la discussion",
    },
    contacts?.linkedin && {
      Ico: IconeLinkedin, nom: "LinkedIn", href: lienLinkedIn(contacts.linkedin), note: "voir le profil",
    },
    contacts?.email && {
      Ico: Mail, nom: "Email", href: `mailto:${contacts.email}`, note: contacts.email,
    },
    // « sur demande » : la ligne existe, la valeur reste dans la base
    !contacts?.whatsapp && contacts?.visi?.whatsapp === "demande" && {
      Ico: IconeWhatsApp, nom: "WhatsApp", note: verrou,
    },
    !contacts?.linkedin && contacts?.visi?.linkedin === "demande" && {
      Ico: IconeLinkedin, nom: "LinkedIn", note: verrou,
    },
    !contacts?.email && contacts?.visi?.email === "demande" && {
      Ico: Mail, nom: "Email", note: verrou,
    },
  ].filter(Boolean);

  return (
    <main className="page avec-tabbar">
      <div className="p-cover">
        <Link href="/annuaire" className="p-retour" aria-label="Retour à l'annuaire">←</Link>
      </div>
      <div className="p-corps">
        <PhotoProfil profil={p} />
        <h1>{p.prenom} {p.nom}</h1>
        <p className="statut">{p.statut}</p>
        <div className="p-meta">
          <span className="meta doree">Promotion {p.promotion}</span>
          {p.ville && (
            <span className="meta">
              {PAYS[p.pays] && <img className="drapo" src={PAYS[p.pays].drapeau} alt="" />} {p.ville}
            </span>
          )}
          <span className="meta">{domaine?.nom}</span>
          {p.repondAuxCadets && (
            <span className="meta verte">
              <BadgeCheck size={13} strokeWidth={2} aria-hidden /> Répond aux cadets
            </span>
          )}
        </div>
        <DemandeContact
          cibleId={id}
          prenom={p.prenom}
          statutInitial={demande}
          aSurDemande={aSurDemande}
        />
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

      {lignes.length > 0 && (
        <section className="p-contacts">
          <h4 style={{ fontSize: 11, letterSpacing: ".3em", textTransform: "uppercase", color: "var(--or)", marginBottom: 6 }}>
            Contact
          </h4>
          {lignes.map((l) =>
            l.href ? (
              <a key={l.nom} className="contact" href={l.href} target="_blank" rel="noopener noreferrer">
                <span className="ico"><l.Ico size={17} aria-hidden /></span>
                <span className="val">{l.nom}</span>
                <span className="visi">{l.note} ↗</span>
              </a>
            ) : (
              <div key={l.nom} className="contact" style={{ cursor: "default" }}>
                <span className="ico"><l.Ico size={17} aria-hidden /></span>
                <span className="val">{l.nom}</span>
                <span className="visi">{l.note}</span>
              </div>
            )
          )}
        </section>
      )}

      <TabBar actif="Annuaire" />
    </main>
  );
}
