import Link from "next/link";
import { notFound } from "next/navigation";
import TabBar from "@/components/TabBar";
import Retour from "@/app/profil/[id]/Retour";
import { utilisateurCourant, apercuOffre, lireOffre, suiteOffre } from "@/lib/api";
import { nomType, joursRestants } from "@/lib/offres";
import { CouvertureOffre, TeteOffre, SuiteOffre } from "./ContenuOffre";

// Lien de partage d'une offre : aperçu personnalisé pour les robots, la page
// complète de l'offre pour les membres validés (même habillage que la feuille
// ouverte depuis la liste), invitation à se connecter pour les autres.
export async function generateMetadata({ params }) {
  const { id } = await params;
  const o = await apercuOffre(id);
  if (!o) return { title: "Offres — LSNO Amicale", robots: { index: false } };
  const echeance = o.date_limite
    ? ` — avant le ${new Date(o.date_limite).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}`
    : "";
  const titre = `${nomType(o.type) === "Autre" ? "Opportunité" : nomType(o.type)} : ${o.titre}`;
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
  if (moi && moi.statut_compte === "valide") {
    const o = await lireOffre(id);
    if (!o) notFound();
    const suite = await suiteOffre(id, o.domaine);
    return (
      <main className="page page-profil avec-tabbar">
        <CouvertureOffre o={o} jours={joursRestants(o.date_limite)}>
          <Retour secours="/offres" />
        </CouvertureOffre>
        <TeteOffre o={o} />
        <SuiteOffre o={o} moiId={moi.id} suite={suite} />
        <TabBar actif="Offres" />
      </main>
    );
  }

  const o = await apercuOffre(id);
  if (!o) notFound();
  return (
    <main className="page">
      <div className="vide" style={{ paddingTop: 120 }}>
        <img src="/img/logo.jpg" alt="" style={{ width: 64, height: 64, borderRadius: "50%", margin: "0 auto 14px" }} />
        <b>{nomType(o.type) === "Autre" ? "Opportunité" : nomType(o.type)} : {o.titre}</b>{" "}
        Les détails sont réservés aux membres de LSNO Amicale.
        <div style={{ marginTop: 18 }}>
          <Link href="/connexion" className="btn btn-or" style={{ padding: "12px 22px" }}>Se connecter</Link>
        </div>
      </div>
    </main>
  );
}
