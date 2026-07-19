import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { utilisateurCourant, apercuOffre } from "@/lib/api";

const TYPES = {
  stage: "Stage", emploi: "Emploi", bourse: "Bourse",
  cooptation: "Cooptation", concours: "Concours", autre: "Opportunité",
};

// Lien de partage d'une offre : aperçu personnalisé pour les robots,
// redirection vers l'offre dans la liste pour les membres connectés,
// invitation à se connecter pour les autres.
export async function generateMetadata({ params }) {
  const { id } = await params;
  const o = await apercuOffre(id);
  if (!o) return { title: "Offres — LSNO Amicale", robots: { index: false } };
  const echeance = o.date_limite
    ? ` — avant le ${new Date(o.date_limite).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}`
    : "";
  const titre = `${TYPES[o.type] ?? "Opportunité"} : ${o.titre}`;
  const desc = `${echeance ? "À saisir" + echeance + ". " : ""}Partagée entre anciens sur LSNO Amicale.`;
  return {
    title: titre,
    description: desc,
    openGraph: { title: titre, description: desc },
    robots: { index: false },
  };
}

export default async function PageOffre({ params }) {
  const { id } = await params;
  const moi = await utilisateurCourant();
  if (moi && moi.statut_compte === "valide") redirect(`/offres#o-${id}`);

  const o = await apercuOffre(id);
  if (!o) notFound();
  return (
    <main className="page">
      <div className="vide" style={{ paddingTop: 120 }}>
        <img src="/img/logo.jpg" alt="" style={{ width: 64, height: 64, borderRadius: "50%", margin: "0 auto 14px" }} />
        <b>{TYPES[o.type] ?? "Opportunité"} : {o.titre}</b>
        Les détails sont réservés aux membres de LSNO Amicale.
        <div style={{ marginTop: 18 }}>
          <Link href="/connexion" className="btn btn-or" style={{ padding: "12px 22px" }}>Se connecter</Link>
        </div>
      </div>
    </main>
  );
}
