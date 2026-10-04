import Link from "next/link";
import Sommaire from "@/components/Sommaire";
import RetourDynamique from "@/components/RetourDynamique";

export const metadata = {
  title: "Conditions & confidentialité — LSNO Amicale",
  robots: { index: false },
};

// Page statique publique : lisible avant de s'inscrire.
// Un sommaire collant (les 11 sections) permet d'aller droit au point qui
// intéresse — sur un téléphone, ce texte fait quinze écrans.
const SECTIONS = [
  "Ce qu’est LSNO Amicale", "Qui peut s’inscrire", "Les données que nous collectons",
  "Ce que tu publies", "Qui voit tes informations", "Signalements et modération",
  "Tes droits sur tes données", "Les règles de bonne conduite",
  "Responsabilités", "Hébergement", "Évolution de ces conditions",
];
const Titre = ({ n, children }) => (
  <h2 id={`s${n}`} className="cg-titre"><span>{n}</span>{children}</h2>
);
const Para = ({ children }) => <p style={{ marginTop: 10 }}>{children}</p>;

export default function Conditions() {
  return (
    <main className="page">
      <header className="f-tete tete-portail" style={{ paddingTop: 20 }}>
        <RetourDynamique secours="/" libelle="Retour" />
        <h1>Conditions<br />&amp; <em>confidentialité</em></h1>
        <p>Ce que tu acceptes en rejoignant le réseau — et ce que nous faisons de tes données.</p>
      </header>

      <Sommaire className="cg-sommaire" sections={SECTIONS.map((t, i) => ({ id: `s${i + 1}`, nom: <><b>{i + 1}</b> {t}</> }))} />
      <div className="f-corps cg-corps">
        <p className="cg-date">Dernière mise à jour : 4 octobre 2026</p>
        <div className="cg-bref">
          <p className="lbl">L’essentiel</p>
          <ul>
            <li><b>Tu donnes</b> ce que tu saisis toi-même, rien d’autre.</li>
            <li><b>Seuls les membres validés</b> voient ton profil et ce que tu publies. Jamais le public, jamais les moteurs de recherche.</li>
            <li><b>Tu choisis ton cercle</b> pour chaque publication, moment ou événement : tout le réseau, ta promo ou ton domaine.</li>
            <li><b>Tes contacts</b> ne sont visibles qu’à qui tu le décides.</li>
            <li><b>Ce qui est éphémère l’est vraiment</b> : messages effacés après 30 jours, moments après 24 h à 7 jours.</li>
            <li><b>Tu peux tout supprimer</b> à tout moment, depuis Mon profil, immédiatement et définitivement.</li>
            <li><b>Jamais</b> de traceur publicitaire, jamais de revente, jamais de démarchage.</li>
          </ul>
        </div>

        <Titre n={1}>Ce qu’est LSNO Amicale</Titre>
        <p>
          Une plateforme associative, gratuite et à but non lucratif, réservée à la communauté
          du Lycée Scientifique National de Ouagadougou — celles et ceux qui y sont passés comme
          celles et ceux qui y étudient encore. Elle est éditée et administrée bénévolement par
          des anciens, indépendamment de l’administration du lycée. Son but : permettre à la
          communauté de se retrouver, de s’entraider et aux cadets de trouver le bon interlocuteur.
          Elle réunit un annuaire, un fil d’actualité, une messagerie, des questions aux anciens,
          des moments, des événements, des groupes, des offres et des conseils — le tout entre
          membres validés.
        </p>

        <Titre n={2}>Qui peut s’inscrire</Titre>
        <p>
          Toute personne qui est ou a été élève du LSNO, de la première promotion à celle en
          cours. Pour les élèves encore au lycée, l’inscription est ouverte <b>à partir de la
          classe de première</b>{" "}(les élèves de seconde pourront nous rejoindre à leur passage en
          première). Chaque inscription est vérifiée par un délégué de la promotion concernée (ou un
          administrateur), qui reconnaît ses camarades. Un compte créé sous une fausse identité
          ou par une personne extérieure au lycée sera refusé ou supprimé.
        </p>

        <Titre n={3}>Les données que nous collectons</Titre>
        <p>
          Uniquement ce que tu saisis toi-même : identité (prénom, nom, promotion), email de
          connexion, et — si tu choisis de les remplir — photo, situation, ville et pays, domaine,
          parcours, conseil, histoire, sujets de discussion, contacts (WhatsApp, email, LinkedIn),
          ainsi que tout ce que tu publies (voir §4).
          Aucune donnée n’est collectée à ton insu : pas de traceur publicitaire, pas de
          revente, pas de statistiques individuelles. Les seuls cookies utilisés sont ceux de ta
          session de connexion, indispensables au fonctionnement.
        </p>
        <Para>
          <b>Notifications.</b>{" "}Si tu choisis de les activer, ton navigateur nous remet une
          adresse d’envoi technique propre à cet appareil (avec ses clés de chiffrement) ;
          nous l’enregistrons pour pouvoir t’écrire, avec le nom abrégé du navigateur
          pour que tu t’y retrouves. Elle ne permet pas de te suivre ailleurs sur le web,
          n’est jamais partagée, et les notifications sont envoyées par nos propres serveurs
          — sans prestataire tiers. Tu peux les couper à tout moment (voir §7), et l’adresse
          est alors supprimée.
        </Para>
        <Para>
          <b>Repères d’usage.</b>{" "}Pour ne pas te remontrer ce que tu as déjà vu, ton compte
          retient quelques repères techniques : la version du tour des nouveautés que tu as
          parcourue, les pastilles « Nouveau » que tu as découvertes, les moments que tu as
          regardés, les conversations que tu as lues. Rien de plus : pas d’historique de
          navigation, pas de mesure de ton temps passé.
        </Para>
        <Para>
          <b>Journal des actions d’administration.</b>{" "}Pour pouvoir répondre à la question
          « qui a fait quoi ? » en cas de problème, la plateforme enregistre les actions à
          privilège : validation, refus, suspension ou suppression d’un compte, changement de
          rôle, intervention sur un email de connexion, publication d’une annonce, export de
          l’annuaire, masquage ou suppression d’un contenu par la modération. Chaque ligne
          retient l’auteur, la personne concernée, la date et le détail utile.
          <b> Ce que tu fais sur ton propre profil n’y figure pas</b> : ce journal
          surveille les pouvoirs, pas les membres. Il est consultable par les seuls
          administrateurs, ne peut être ni modifié ni effacé — même par eux — et il est purgé
          automatiquement au bout de 12 mois.
        </Para>
        <Para>
          <b>Si ta demande d’inscription est refusée.</b>{" "}Ton compte reste fermé et te
          l’indique clairement, puis il est <b>entièrement supprimé au bout de 90 jours</b> —
          délai qui laisse le temps de corriger une erreur, après quoi ton adresse email
          redevient libre. Un compte dont l’email n’a jamais été confirmé est supprimé
          au bout de 30 jours.
        </Para>
        <Para>
          <b>Double authentification.</b>{" "}Si tu as un rôle de délégué ou d’administrateur,
          tu peux protéger ton compte par un code à six chiffres. Dans ce cas nous conservons
          uniquement de quoi vérifier ce code (une clé secrète propre à ton appareil, créée par
          notre hébergeur) : ni numéro de téléphone, ni appareil identifiable. Tu peux la
          retirer à tout moment depuis Mon profil. Si tu perds ton téléphone, un
          administrateur peut retirer cette protection à ta place, après avoir vérifié ton
          identité — l’opération est enregistrée au journal et les autres administrateurs
          en sont avertis.
        </Para>
        <Para>
          <b>Vérification anti-robot.</b> Les pages d’inscription, de connexion et de mot
          de passe oublié peuvent afficher une vérification fournie par Cloudflare, destinée à
          empêcher les inscriptions automatisées en masse. Elle analyse le comportement du
          navigateur le temps de la vérification et ne dépose pas de traceur publicitaire ;
          elle ne s’applique qu’à ces trois pages, jamais au reste du site.
        </Para>

        <Titre n={4}>Ce que tu publies</Titre>
        <p>
          Le réseau te permet de partager avec les autres membres. Tout ce que tu publies reste
          <b> entre membres validés</b>, signé de ton nom (sauf les questions posées en anonyme),
          et tu peux le modifier ou le supprimer toi-même à tout moment. Voici ce qui existe, et
          combien de temps chaque chose vit :
        </p>
        <ul className="cg-liste">
          <li><b>Le fil</b> : des publications (texte, jusqu’à dix photos ou une vidéo courte), des bravos et des commentaires. Les publications restent tant que tu ne les supprimes pas ; <b>les vidéos sont effacées au bout de 14 jours</b>, pour ménager l’espace de stockage.</li>
          <li><b>Les moments</b> : une photo ou une vidéo qui vit <b>24 heures, 3 jours ou 7 jours</b> — tu choisis — puis disparaît d’elle-même, fichier compris. Tu peux voir qui a regardé ton moment ; personne d’autre ne le peut. Tu peux aussi en garder un en publication avant qu’il s’efface.</li>
          <li><b>Les messages</b> : conversations à deux ou en groupe, avec photos, documents, vocaux et sondages. <b>Les messages s’effacent au bout de 30 jours</b> (les pièces jointes plus tôt selon leur type : vidéos et vocaux 7 jours, PDF 14 jours, photos 30 jours). Les conversations et les groupes, eux, restent. Tu peux bloquer un membre : il ne peut plus t’écrire.</li>
          <li><b>Les questions aux anciens</b> : tu peux poser ta question à visage découvert ou <b>en anonyme</b>. En anonyme, les autres membres ne voient pas ton nom ; les modérateurs (délégués et administrateurs) le connaissent, pour pouvoir intervenir en cas d’abus. Une question sans activité depuis 30 jours est fermée automatiquement ; les pièces jointes des questions sont effacées au bout de 14 jours.</li>
          <li><b>Les événements</b> : une rencontre que tu organises (sur place ou en ligne), les réponses « J’y vais » ou « Peut-être », les commentaires et, après coup, les photos déposées par les participants.</li>
          <li><b>Les groupes</b> : privés (sur invitation), sur demande (le créateur accepte qui entre) ou ouverts. Un groupe se supprime à la main, par son créateur ou un administrateur.</li>
          <li><b>Les offres et les conseils</b> : signés de ton profil ; les offres clôturées depuis plus de 3 mois sont supprimées avec leurs pièces jointes.</li>
        </ul>
        <Para>
          <b>Les mentions.</b> Quand tu écris « @Prénom Nom », la personne est prévenue et son
          profil est lié. Quand quelqu’un te mentionne, tu es prévenu de la même façon.
        </Para>
        <Para>
          <b>Les fichiers.</b> Photos, vidéos et documents que tu joins sont stockés chez notre
          hébergeur, dans des espaces réservés aux membres. Ils sont supprimés en même temps que
          le contenu qui les porte, et de toute façon à l’expiration indiquée ci-dessus.
        </Para>
        <Para>
          <b>Quand tu supprimes ton compte</b>, tout ce que tu as publié disparaît avec lui :
          publications, moments, messages, questions, réponses, événements, photos, réactions.
          Seule exception : les messages que tu as envoyés dans une conversation restent lisibles
          par les autres participants jusqu’à leur effacement automatique (30 jours au plus),
          comme un message envoyé sur n’importe quelle messagerie.
        </Para>

        <Para>
          <b>Documents de la bibliothèque.</b>{" "}Quand tu proposes un sujet, un devoir ou un cours
          dans « Annales et sujets », le fichier n’est pas conservé sur le site : il est déposé
          sur le Google Drive de l’association (compte de l’amicale), dans un dossier dédié, et
          rendu lisible par lien pour les membres. Un délégué le relit avant publication ; la
          fiche publiée affiche ton prénom et ta promotion comme proposant. Un document refusé
          ou retiré est supprimé du Drive. Tu confirmes, en proposant, que le document peut
          être partagé.
        </Para>

        <Titre n={5}>Qui voit tes informations</Titre>
        <p>
          <b>Jamais le grand public, jamais les moteurs de recherche.</b>{" "}Ton profil et tes
          publications ne sont visibles que des membres validés du réseau. Seule exception,
          voulue : quand un membre partage le lien d’un profil ou d’une offre (WhatsApp…),
          l’aperçu du lien affiche la « vitrine » — prénom, nom, photo, promotion et la ligne
          de présentation, ou le titre de l’offre — rien d’autre ; ouvrir le lien sans être
          connecté mène à la page de connexion.
        </p>
        <Para>
          <b>Ton cercle.</b> Pour chaque publication, moment, événement ou groupe, tu choisis
          qui le voit : <b>tout le réseau</b>, <b>ta promo</b> ou <b>ton domaine</b>. Ce choix
          est appliqué par la base de données elle-même, pas seulement par l’affichage : un
          contenu réservé à ta promo n’est jamais envoyé à quelqu’un d’une autre promo.
        </Para>
        <Para>
          <b>Tes contacts</b> obéissent à TES réglages, appliqués de la même façon :
          « Membres » (cliquable par les membres validés), « Sur demande » (partagé seulement si
          tu acceptes une demande de mise en relation), « Masqué » (invisible de tous). Les
          administrateurs eux-mêmes ne voient pas tes contacts masqués.
        </Para>
        <Para>
          <b>Les messages</b> ne sont lisibles que par les participants à la conversation. Les
          modérateurs n’y ont pas accès ; seul un signalement, envoyé par un participant avec
          l’extrait concerné, peut leur en montrer un.
        </Para>
        <Para>
          Les pages publiques du site n’affichent que des chiffres anonymes (nombre
          d’anciens, de pays…).
        </Para>

        <Titre n={6}>Signalements et modération</Titre>
        <p>
          Chaque publication, commentaire, moment, question, réponse, événement ou message peut
          être <b>signalé</b> par n’importe quel membre, avec un motif. Les signalements sont
          examinés par les modérateurs : les délégués de promotion et les administrateurs. Ils
          peuvent <b>masquer</b> un contenu (il n’est plus visible que de son auteur, qui en est
          prévenu) ou le supprimer, et suspendre un compte en cas d’abus répété. Chaque geste de
          modération est inscrit au journal des actions (§3) : la modération est elle-même
          surveillée. Un contenu masqué par erreur peut être rétabli.
        </p>

        <Titre n={7}>Tes droits sur tes données</Titre>
        <p>
          Tu peux à tout moment, depuis « Mon profil » : <b>consulter et rectifier</b>{" "}chaque
          information, <b>changer la visibilité</b>{" "}de chaque contact, <b>activer ou couper les
          notifications</b>{" "}(globalement sur un appareil, ou par famille — mes demandes, le
          réseau, les offres, le fil, les messages, les annonces — et en choisissant de qui te
          prévenir pour les arrivées), <b>voir la liste des appareils</b>{" "}qui les reçoivent
          et en retirer un à distance, <b>supprimer chacune de tes publications</b>, et
          <b> supprimer définitivement ton compte</b> — l’effacement est immédiat, total
          (profil, parcours, photo, publications, messages, compte de connexion) et
          irréversible. Pour toute autre demande liée à tes données : lsno.alumni@gmail.com.
        </p>

        <Titre n={8}>Les règles de bonne conduite</Titre>
        <p>
          Le réseau repose sur la confiance entre anciens. En l’utilisant, tu t’engages à :
          renseigner des informations exactes ; utiliser les contacts des membres uniquement dans
          l’esprit du réseau (entraide, orientation, opportunités) — jamais pour du démarchage
          commercial, du spam ou du harcèlement ; publier des offres honnêtes ; et respecter la
          confidentialité de ce que les membres partagent — ce qui est dit dans le réseau reste
          dans le réseau, et une capture d’écran d’une conversation privée n’a rien à faire
          ailleurs.
        </p>
        <Para>
          Dans le fil, les messages, les questions, les moments et les événements, tu t’engages
          de plus à : ne publier que des photos et des vidéos dont tu as le droit de disposer et
          où les personnes reconnaissables ont donné leur accord ; ne pas tenir de propos
          insultants, discriminatoires, diffamatoires ou contraires à la loi ; ne pas utiliser
          l’anonymat des questions pour nuire ; ne pas usurper l’identité d’un autre membre. Un
          modérateur peut masquer un contenu qui enfreint ces règles, et un administrateur
          suspendre un compte.
        </Para>

        <Titre n={9}>Responsabilités</Titre>
        <p>
          Les informations des profils et tout ce qui est publié (parcours, conseils, histoires,
          offres, publications, commentaires, messages, questions, réponses, événements) le sont
          par leurs auteurs, sous leur responsabilité. La plateforme est fournie bénévolement,
          sans garantie de disponibilité permanente ni de conservation au-delà des durées
          indiquées au §4 : ce qui compte pour toi, garde-le aussi ailleurs. En cas de contenu
          problématique, signale-le depuis le site ou écris-nous : il sera examiné rapidement.
        </p>

        <Titre n={10}>Hébergement</Titre>
        <p>
          Le site est hébergé par Vercel et les données, fichiers compris, stockées chez Supabase,
          deux services professionnels appliquant les standards de sécurité actuels. Seuls les
          documents de la bibliothèque « Annales et sujets » font exception : ils sont déposés
          sur le Google Drive de l’association (voir §4).
          Le code du site est public ; tes données, elles, ne le sont jamais.
        </p>

        <Titre n={11}>Évolution de ces conditions</Titre>
        <p>
          Si ces conditions évoluent de manière notable, les membres en seront informés par email
          ou sur le site. La version en vigueur est toujours celle de cette page. Le 28 septembre
          2026, elles ont été complétées pour décrire le fil, les messages, les questions aux
          anciens, les moments, les événements et les groupes ; le 4 octobre 2026, pour la
          bibliothèque « Annales et sujets » et ses documents déposés sur le Drive de l’association.
        </p>

        <p style={{ marginTop: 26, fontSize: 12.5, color: "var(--brume)" }}>
          Une question sur tes données ou ces conditions ?{" "}
          <a href="mailto:lsno.alumni@gmail.com" style={{ color: "var(--bleu-texte)", textDecoration: "underline" }}>
            lsno.alumni@gmail.com
          </a>
          {" · "}
          <Link href="/a-propos" style={{ color: "var(--bleu-texte)", textDecoration: "underline" }}>À propos du réseau</Link>
        </p>
        <p className="tagline" style={{ marginTop: 14 }}>Travail · Excellence · Discipline</p>
      </div>
    </main>
  );
}
