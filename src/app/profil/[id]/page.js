import Link from "next/link";
import { notFound } from "next/navigation";
import TabBar from "@/components/TabBar";
import { lireProfil, lireContacts, statutDemande, apercuProfil } from "@/lib/api";
import ContenuProfil from "./ContenuProfil";
import Retour from "./Retour";

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
          <b>{ap.prenom} {ap.nom} — Promotion {ap.promo}</b>{" "}
          Ce profil est réservé aux membres de LSNO Amicale.
          <div style={{ marginTop: 18 }}>
            <Link href="/connexion" className="btn btn-or" style={{ padding: "12px 22px" }}>Se connecter</Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="page avec-tabbar">
      <div className="p-cover">
        <Retour />
      </div>
      <ContenuProfil p={p} contacts={contacts} demande={demande} id={id} />
      <TabBar actif="Annuaire" />
    </main>
  );
}
