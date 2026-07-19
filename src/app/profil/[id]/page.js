import Link from "next/link";
import { notFound } from "next/navigation";
import TabBar from "@/components/TabBar";
import PhotoProfil from "@/components/PhotoProfil";
import { Mail, Lock, BadgeCheck } from "lucide-react";
import { IconeLinkedin, IconeWhatsApp } from "@/components/Marques";
import { PAYS, nomDomaine } from "@/lib/donnees";
import { lireProfil, lireContacts, statutDemande, apercuProfil } from "@/lib/api";
import DemandeContact from "./DemandeContact";
import Histoire from "./Histoire";

// Aperçu de partage : titre/description personnalisés (vitrine choisie),
// jamais indexé par les moteurs.
export async function generateMetadata({ params }) {
  const { id } = await params;
  const p = await apercuProfil(id);
  if (!p) return { title: "LSNO Amicale", robots: { index: false } };
  const titre = `${p.prenom} ${p.nom} — Promo ${p.promo} · LSNO Amicale`;
  const desc = p.statut
    ? `${p.statut}. Découvre son parcours sur le réseau des anciens du LSNO.`
    : "Découvre son parcours sur le réseau des anciens du LSNO.";
  return {
    title: titre,
    description: desc,
    // sans surcharge explicite, WhatsApp affiche le og:title hérité du layout
    openGraph: { title: titre, description: desc },
    robots: { index: false },
  };
}

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
  if (!p) {
    // sans session (robots d'aperçu, lien ouvert déconnecté malgré le
    // middleware) : coquille minimale — la vitrine s'arrête au nom
    const ap = await apercuProfil(id);
    if (!ap) notFound();
    return (
      <main className="page">
        <div className="vide" style={{ paddingTop: 120 }}>
          <img src="/img/logo.jpg" alt="" style={{ width: 64, height: 64, borderRadius: "50%", margin: "0 auto 14px" }} />
          <b>{ap.prenom} {ap.nom} — Promotion {ap.promo}</b>
          Ce profil est réservé aux membres de LSNO Amicale.
          <div style={{ marginTop: 18 }}>
            <Link href="/connexion" className="btn btn-or" style={{ padding: "12px 22px" }}>Se connecter</Link>
          </div>
        </div>
      </main>
    );
  }

  // des contacts « sur demande » existent-ils chez ce membre ?
  const aSurDemande = ["whatsapp", "email", "linkedin"]
    .some((c) => contacts?.visi?.[c] === "demande");

  const domaine = nomDomaine(p.domaine, p.domainePrecision);

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
          <span className="meta">{domaine}</span>
          {p.repondAuxCadets && (
            <span className="meta verte">
              <BadgeCheck size={13} strokeWidth={2} aria-hidden /> Répond aux cadets
            </span>
          )}
        </div>
        {p.repondAuxCadets && p.sujetsCadets.length > 0 && (
          <div className="p-sujets">
            <span className="lbl">On peut discuter de</span>
            {p.sujetsCadets.map((s) => <span key={s} className="p-sujet">{s}</span>)}
          </div>
        )}
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

      {p.histoire && <Histoire prenom={p.prenom} texte={p.histoire} />}

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
