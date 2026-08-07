import PhotoProfil from "@/components/PhotoProfil";
import TexteReplie from "@/components/TexteReplie";
import { Mail, Lock, BadgeCheck } from "lucide-react";
import { IconeLinkedin, IconeWhatsApp } from "@/components/Marques";
import { PAYS, nomDomaine } from "@/lib/donnees";
import DemandeContact from "./DemandeContact";
import Histoire from "./Histoire";

// Le contenu visuel d'un profil, PARTAGÉ entre la vraie page (/profil/[id])
// et la feuille glissante ouverte depuis l'annuaire (@modal). Coupé en deux :
// TeteProfil (identité, purement visuelle) et SuiteProfil (boutons + reste,
// interactif) — la feuille glissante a besoin de cette frontière pour ne
// JAMAIS rendre glissable une zone qui contient un bouton ou un formulaire
// (« Demander le contact » ouvre un champ de message).

function lienWhatsApp(v) {
  const chiffres = v.replace(/[^\d+]/g, "").replace(/^\+/, "");
  return `https://wa.me/${chiffres}`;
}
function lienLinkedIn(v) {
  if (v.startsWith("http")) return v;
  return `https://www.linkedin.com/in/${v.replace(/^@/, "")}`;
}

export function TeteProfil({ p }) {
  const domaine = nomDomaine(p.domaine, p.domainePrecision);
  return (
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
    </div>
  );
}

export function SuiteProfil({ p, contacts, demande, id }) {
  // des contacts « sur demande » existent-ils chez ce membre ?
  const aSurDemande = ["whatsapp", "email", "linkedin"]
    .some((c) => contacts?.visi?.[c] === "demande");

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
    <>
      <div className="p-corps-suite">
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
          <TexteReplie lignes={6}>«&nbsp;{p.conseil}&nbsp;»</TexteReplie>
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
    </>
  );
}

export default function ContenuProfil({ p, contacts, demande, id }) {
  return (
    <>
      <TeteProfil p={p} />
      <SuiteProfil p={p} contacts={contacts} demande={demande} id={id} />
    </>
  );
}
