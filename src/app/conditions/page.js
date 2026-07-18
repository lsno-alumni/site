import Link from "next/link";

export const metadata = {
  title: "Conditions & confidentialité — LSNO Amicale",
  robots: { index: false },
};

// Page statique publique : lisible avant de s'inscrire.
const Titre = ({ children }) => (
  <h2 style={{ fontSize: 16, marginTop: 26, marginBottom: 8 }}>{children}</h2>
);

export default function Conditions() {
  return (
    <main className="page">
      <header className="f-tete tete-portail" style={{ paddingTop: 20, paddingBottom: 24 }}>
        <Link href="/" className="retour">← Accueil</Link>
        <h1>Conditions<br />&amp; <em>confidentialité</em></h1>
        <p>Ce que tu acceptes en rejoignant le réseau — et ce que nous faisons de tes données.</p>
      </header>

      <div className="f-corps" style={{ fontSize: 13.5, lineHeight: 1.7, color: "var(--craie-2)", paddingBottom: 48 }}>
        <p style={{ fontSize: 12, color: "var(--brume)" }}>Dernière mise à jour : 18 juillet 2026</p>

        <Titre>1. Ce qu&apos;est LSNO Amicale</Titre>
        <p>
          Une plateforme associative, gratuite et à but non lucratif, réservée à la communauté
          du Lycée Scientifique National de Ouagadougou — celles et ceux qui y sont passés comme
          celles et ceux qui y étudient encore. Elle est éditée et administrée bénévolement par
          des anciens, indépendamment de l&apos;administration du lycée. Son but : permettre à la
          communauté de se retrouver et aux cadets de trouver le bon interlocuteur.
        </p>

        <Titre>2. Qui peut s&apos;inscrire</Titre>
        <p>
          Toute personne qui est ou a été élève du LSNO, de la première promotion à celle en
          cours. Chaque inscription est vérifiée par un délégué de la promotion concernée (ou un
          administrateur), qui reconnaît ses camarades. Un compte créé sous une fausse identité
          ou par une personne extérieure au lycée sera refusé ou supprimé.
        </p>

        <Titre>3. Les données que nous collectons</Titre>
        <p>
          Uniquement ce que tu saisis toi-même : identité (prénom, nom, promotion), email de
          connexion, et — si tu choisis de les remplir — photo, situation, ville et pays, domaine,
          parcours, conseil, histoire, sujets de discussion, contacts (WhatsApp, email, LinkedIn).
          Aucune donnée n&apos;est collectée à ton insu : pas de traceur publicitaire, pas de
          revente, pas de statistiques individuelles. Les seuls cookies utilisés sont ceux de ta
          session de connexion, indispensables au fonctionnement.
        </p>

        <Titre>4. Qui voit tes informations</Titre>
        <p>
          <b>Jamais le grand public, jamais les moteurs de recherche.</b> Ton profil n&apos;est
          visible que des membres validés du réseau. Tes contacts obéissent en plus à TES
          réglages, appliqués par la base de données elle-même : « Membres » (cliquable par les
          membres validés), « Sur demande » (partagé seulement si tu acceptes une demande de mise
          en relation), « Masqué » (invisible de tous). Les pages publiques du site n&apos;affichent
          que des chiffres anonymes (nombre d&apos;anciens, de pays…).
        </p>

        <Titre>5. Tes droits sur tes données</Titre>
        <p>
          Tu peux à tout moment, depuis « Mon profil » : <b>consulter et rectifier</b> chaque
          information, <b>changer la visibilité</b> de chaque contact, et <b>supprimer
          définitivement ton compte</b> — l&apos;effacement est immédiat, total (profil, parcours,
          photo, compte de connexion) et irréversible. Pour toute autre demande liée à tes
          données : lsno.alumni@gmail.com.
        </p>

        <Titre>6. Les règles de bonne conduite</Titre>
        <p>
          Le réseau repose sur la confiance entre anciens. En l&apos;utilisant, tu t&apos;engages à :
          renseigner des informations exactes ; utiliser les contacts des membres uniquement dans
          l&apos;esprit du réseau (entraide, orientation, opportunités) — jamais pour du démarchage
          commercial, du spam ou du harcèlement ; publier des offres honnêtes ; et respecter la
          confidentialité de ce que les membres partagent. Un administrateur peut suspendre un
          compte qui enfreint ces règles.
        </p>

        <Titre>7. Responsabilités</Titre>
        <p>
          Les informations des profils (parcours, conseils, histoires, offres) sont publiées par
          leurs auteurs, sous leur responsabilité. La plateforme est fournie bénévolement, sans
          garantie de disponibilité permanente. En cas de contenu problématique, écris-nous :
          il sera examiné rapidement.
        </p>

        <Titre>8. Hébergement</Titre>
        <p>
          Le site est hébergé par Vercel et les données stockées chez Supabase, deux services
          professionnels appliquant les standards de sécurité actuels.
          Le code du site est public ; tes données, elles, ne le sont jamais.
        </p>

        <Titre>9. Évolution de ces conditions</Titre>
        <p>
          Si ces conditions évoluent de manière notable, les membres en seront informés par email
          ou sur le site. La version en vigueur est toujours celle de cette page.
        </p>

        <p style={{ marginTop: 26, fontSize: 12.5, color: "var(--brume)" }}>
          Une question sur tes données ou ces conditions ?{" "}
          <a href="mailto:lsno.alumni@gmail.com" style={{ color: "var(--or-clair)", textDecoration: "underline" }}>
            lsno.alumni@gmail.com
          </a>
        </p>
        <p className="tagline" style={{ marginTop: 14 }}>Travail · Excellence · Discipline</p>
      </div>
    </main>
  );
}
