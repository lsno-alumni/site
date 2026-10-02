# LSNO Amicale

Le réseau en ligne des ancien·nes du **Lycée Scientifique National de Ouagadougou** :
un annuaire privé où chaque membre présente son parcours, et — depuis septembre 2026 —
un réseau social entre membres : fil d'actualité, messagerie, questions aux anciens,
moments, événements, groupes. Pour que les cadets trouvent le bon interlocuteur et que
le réseau de tous se renforce.

**En production : https://lsno-alumni.vercel.app**

> Plateforme associative à but non lucratif, développée et administrée bénévolement par
> des anciens — indépendante de l'administration du lycée. Rien n'est visible du grand
> public : seuls les membres validés se voient entre eux.

> **État au 28 septembre 2026** : l'annuaire et tout ce qui l'entoure (V2) sont en
> production sur `main`. Le réseau social (V3, branche `social`) est **en test en cercle
> fermé** par le comité informatique sur un aperçu Vercel, et sera fusionné dans `main`
> après leur validation. Ce README décrit l'ensemble.

## Ce que fait le site

**Pour les membres — l'annuaire et son entourage (V2)**

- **Annuaire** avec recherche (tolérante aux accents et à la casse) et filtres : domaine,
  promotion, pays, situation ; fiches ouvertes en **feuille glissante** par-dessus la liste
- **Profils riches** : parcours chronologique, conseil aux cadets, « Mon histoire »,
  sujets de discussion proposés aux cadets, contacts à visibilité contrôlée
  (membres / sur demande / masqué)
- **Mise en relation** : demander le contact d'un ancien, qui accepte ou refuse
  (le refus reste silencieux, volontairement)
- **Offres & opportunités** : stages, emplois, bourses, cooptations, concours — publiés
  par les membres, avec **pièces jointes** (PDF ou images), filtres et tri par échéance
- **Conseils aux cadets** regroupés **par thème**, alimentés par les profils
- **Accueil personnalisé** pour les membres connectés ; vitrine anonyme pour les visiteurs
- **Photo de profil** recadrable (carré) et supprimable
- **Notifications push** : être prévenu, appli fermée, d'une demande de contact, d'une
  nouvelle offre, de l'arrivée d'un camarade, d'un message, d'une publication de son
  cercle… réglables par **six familles** (mes demandes, le réseau, les offres, le fil, les
  messages, les annonces), avec le choix de la **portée** pour les arrivées, la **liste de
  ses appareils** et un **regroupement** automatique au-delà de quelques notifications non lues
- **Installable comme une appli**, avec **aide guidée** : bouton d'installation natif là où
  le navigateur le permet, gestes expliqués selon le téléphone ailleurs
- **Partage** de profils et d'offres avec **aperçu personnalisé** (WhatsApp…), sans jamais
  exposer autre chose qu'une vitrine volontaire
- **Thème clair, sombre ou automatique** (refonte « Latérite » de septembre 2026 : un seul
  accent bleu, vraies matières et vraies photos)

**Pour les membres — le réseau social (V3)**

- **Le fil** : publications (texte, jusqu'à dix photos ou une vidéo courte de 30 s, effacée
  après 14 jours), **cercle de visibilité** par publication (tout le réseau / ma promo / mon
  domaine), bravos, commentaires et réponses, **mentions @Prénom Nom**, cartes automatiques
  (arrivées groupées, offres, conseils, questions, événements), rafraîchissement discret et
  **temps réel**
- **Messages** : conversations à deux et groupes ; photos, PDF, vocaux, sondages ; réponse
  par glissement, réactions, transfert, épinglage, modification, blocage ; **les messages
  s'effacent après 30 jours** ; **groupes à rejoindre** (privé / sur demande / ouvert) avec un
  annuaire « Découvrir des groupes » et des demandes que le créateur accepte d'un tap
- **Questions aux anciens** : à visage découvert ou en anonyme (l'auteur reste connu des
  modérateurs), pièces jointes, meilleure réponse, thèmes ; les membres qui « répondent aux
  cadets » sur un sujet sont prévenus
- **Moments** : une photo ou une vidéo qui vit 24 h, 3 jours ou 7 jours ; rail en haut du
  fil, lecteur plein écran, réactions emoji, réponse rapide en privé, « vu par » pour
  l'auteur, garder en publication, anneaux sur l'annuaire et les profils, aperçu à l'accueil
- **Événements** : tout membre organise (sur place ou en ligne), « J'y vais / Peut-être »,
  agenda (.ics / Google), rappel la veille, discussion, photos des participants après coup,
  marque « Amicale » pour les délégués et admins, duplication
- **Signalement et modération** partout : un membre signale avec un motif, un délégué ou un
  admin masque ou supprime, chaque geste est journalisé, l'auteur est prévenu
- **Tour des nouveautés** : six cartes à la première ouverture (une fois par compte, versionné),
  pastilles « Nouveau » discrètes qui s'effacent à l'usage ou après 30 jours, page permanente
  `/nouveautes` avec les gestes à connaître
- **Gestes** : glisser-rafraîchir sur toutes les listes, feuilles glissantes pour les
  profils, offres, événements et créations, onglets qui retrouvent position et filtres

**Pour les délégués et les admins**

- **Validation des inscriptions par promotion** (un délégué ne valide que sa promo)
- **Gestion complète des membres** : identité, email de connexion, mot de passe
  temporaire, suspension, nomination de co-admin — sans jamais passer par Supabase
- **Modération** du fil, des questions, des moments et des événements ; comptes fantômes et
  emails jamais confirmés listés
- **Annonce à tout le réseau** (envoi étalé pour respecter le quota d'emails)
- **Sauvegarde** en un clic (CSV) et **état du système** (tâches automatiques)
- **Interrupteurs** : emails et notifications d'inscription aux admins, et **mode essai des
  notifications** (seuls les admins et une liste de comptes de test reçoivent les push — pour
  tester sans bruit chez les vrais membres)

**Sous le capot**

- **Double authentification** (code à six chiffres) proposée aux délégués et admins dans
  Mon profil : `src/components/DoubleAuth.js`, et l'étape de code dans la page de connexion.
  Le site ET le middleware exigent le code dès qu'un appareil est enrôlé
  (`profiles.double_auth_active` vérifié contre le niveau `aal` du jeton — migration 46,
  après qu'un simple « retour » du navigateur suffisait à contourner l'étape).
- **Journal des actions à privilège** : table `journal` en **ajout seul** (ni modification
  ni suppression possible, même pour un admin), conservé 12 mois, lisible dans l'onglet
  Validation et dans la fiche de chaque membre. Ce qu'un membre fait sur son propre profil
  n'y figure pas : on surveille les pouvoirs, pas les membres. La modération y est inscrite.
- **Alerte aux autres admins** : nommer un admin, exporter l'annuaire, changer l'email de
  connexion d'un membre, poser un mot de passe temporaire, supprimer un compte, retirer une
  double authentification ou basculer un réglage envoie aussitôt une **notification** aux
  AUTRES administrateurs (principe des quatre yeux).
- **Fonctions internes verrouillées** : toute fonction `security definer` est inexécutable
  par un client, hors liste blanche (table `sante_fonctions_ouvertes`, une ligne par RPC du
  site). Le contrôle de santé le vérifie **dynamiquement**.
- **Contrôle de santé** : la vue `sante_systeme` décrit le modèle attendu (droits par
  rôle et par table, RLS, fonctions verrouillées, tâches, déclencheurs, secrets) et la
  tâche mensuelle `controle_sante()` prévient les admins par email et notification dès
  qu'une ligne cloche, avec une piste par catégorie. À la main : `select * from sante_systeme;`
  (raccourci dans `supabase/verif-sante.sql`) ou `select controle_sante();`.
- **Vérification anti-robot** (Cloudflare Turnstile), sur inscription, connexion, mot de
  passe oublié et les deux actions par email du back-office. Pilotée par la variable
  `NEXT_PUBLIC_TURNSTILE_SITE_KEY` : **sans elle, rien ne s'affiche et rien ne change**.
  ⚠ ORDRE DE DÉPLOIEMENT : (1) ce code, (2) la clé publique dans Vercel, (3) la clé secrète
  dans Supabase et SEULEMENT ALORS l'interrupteur Supabase. Activer Supabase en premier
  casserait la connexion de tout le monde — la protection s'applique à TOUTES les entrées
  d'authentification, pas seulement à l'inscription.
- **En-têtes de sécurité** (`next.config.mjs`) : CSP serrée (tout est servi par le
  site lui-même, sauf Supabase — API, temps réel et images des buckets), `frame-ancestors
  'none'`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS.
- **Audit mensuel des dépendances** : `.github/workflows/audit-dependances.yml`
  (échoue sur un avis `high`, GitHub prévient par email).
- **76 migrations SQL** rejouables (`supabase/`) : la base se reconstruit à l'identique —
  et c'est vérifié à chaque push, pas seulement affirmé (`npm run banc` rejoue le tout sur
  un PostgreSQL jetable en mémoire ; `outils/verif_sql.py` en contrôle la syntaxe). Les
  scénarios `outils/banc/essai-*.sql` exercent en plus le comportement (visibilité, messages,
  questions, photos, mode essai, moments, événements, groupes).
- **20 automatisations** en base (pg_cron) : cycle des promotions, rappels, relances,
  purges (journal, refus, fantômes, offres, messages, moments, vidéos, pièces jointes),
  fermeture des questions inactives, rappel des événements, contrôle de santé, notifications
- **Temps réel** (Supabase Realtime, `postgres_changes` filtré par la RLS) sur les messages,
  publications, questions, événements, moments et demandes de groupe — hook `useTempsReel`
- **Notifications auto-hébergées** : service worker + route `/api/push` (signature VAPID),
  **aucun prestataire tiers** ; textes et cibles décidés par la base (déclencheurs)
- **Statut « élève »** géré par le calendrier scolaire (inscription ouverte à partir de la
  première, bascule « ancien » à la rentrée d'octobre)

## Architecture

| Couche | Techno | Notes |
|---|---|---|
| Front | Next.js 16 (App Router, JavaScript) | **CSS pur — pas de Tailwind** (choix assumé) ; routes parallèles et interceptées pour les feuilles |
| Base & auth | Supabase (PostgreSQL) | La sécurité vit dans la base : **Row Level Security** partout ; Realtime pour le direct |
| Hébergement | Vercel | Déploiement automatique à chaque push sur `main` ; aperçu par branche (`social`) pour les tests en cercle fermé |
| Emails | Brevo | SMTP (authentification) + API appelée **par la base** (pg_net) |
| Notifications | Web Push (VAPID) | `public/sw.js` + route `/api/push`, appelée par la base |
| Fichiers | Supabase Storage | 3 buckets : `photos` (profils), `ressources` (pièces jointes des offres et des questions), `medias` (fil, moments, messages, événements) |

Dépendances volontairement minimales : `@supabase/*`, `lucide-react` (icônes),
`react-easy-crop` (recadrage photo), `web-push`. Rien d'autre — merci d'en discuter
avant d'en ajouter une.

### Points structurants à connaître avant de toucher au code

- **La confidentialité est dans la base, pas dans l'affichage** : les contacts ne sortent
  de Postgres que via des fonctions qui appliquent la visibilité choisie par chaque
  membre ; le cercle d'une publication, d'un moment, d'un événement ou d'un groupe est
  appliqué par les politiques RLS (`dans_le_cercle`). Ne jamais « contourner » côté client.
- **La chaîne de confiance descend** : admins → délégués (valident leur promotion,
  modèrent) → membres. Un trigger interdit l'auto-promotion.
- **Mobile d'abord** : le réseau vit sur WhatsApp, sur des téléphones parfois en 3G.
  Tout écran se vérifie à **340 px** de large, et sans défilement horizontal.
- **Fraîcheur avant tout, mais plus de rechargement brutal** : les pages dynamiques sont
  gardées 30 s côté client (`staleTimes`), une mémoire d'onglet (`src/lib/memoire.js`)
  retrouve listes, filtres et position instantanément, et chaque écriture appelle
  `router.refresh()`. Les conversations gardent aussi leur mémoire d'onglet (affichées d'un
  coup, rafraîchies derrière, fusionnées avec le temps réel). Le service worker ne met en cache
  **aucune page ni donnée**, seulement les médias immuables des messages et du fil — il sert aux
  notifications, à l'installation et à une page hors ligne.
- **Les emails et les notifications partent de la base** (triggers + pg_cron), pas du
  front : chercher la logique dans `supabase/`, pas dans les composants.
- **Ce qui est éphémère l'est par la base** : messages (30 j), vidéos du fil (14 j),
  moments (24 h à 7 j), pièces jointes selon leur type — des tâches quotidiennes purgent
  lignes et fichiers (clé `service_role` au Vault + `net.http_delete`).

### Organisation du dépôt

```
src/app/            pages (App Router) : accueil, annuaire, profil, offres, conseils,
                    fil, publication, messages (+ groupes), questions, evenements,
                    nouveautes, mon-profil, admin, inscription, connexion, a-propos,
                    conditions… ; les dossiers @modal/(..)xxx sont les feuilles glissantes
src/app/api/push/   route d'envoi des notifications (appelée par la base)
src/components/     composants partagés (Avatar, TabBar, FeuilleGlissante, Notifications,
                    TourNouveautes, Nouveau, Collage, Visionneuse…)
src/lib/            données de référence (domaines, pays, promotions), clients Supabase,
                    et un module par brique : fil, messages, questions, moments,
                    evenements, offres, mentions, tempsReel, erreurs, memoire, tour
src/middleware.js   protection des routes (vérification locale du jeton + double auth)
supabase/           schema.sql + migration-02…73 : tables, RLS, triggers, crons ;
                    verif-migrations.sql, verif-sante.sql
outils/             banc d'essai PGlite (banc_essai.js + banc/essai-*.sql), verif_sql.py
public/             images du lycée, icônes, illustrations, captures du tour, sw.js
```

## Démarrer en local

```bash
git clone https://github.com/lsno-alumni/site.git
cd site
npm install
# créer .env.local :
#   NEXT_PUBLIC_SUPABASE_URL=...
#   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
#   NEXT_PUBLIC_TURNSTILE_SITE_KEY=...   (clé publique ; indispensable si le captcha est actif)
# (valeurs dans CONTRIBUTING.md — publiques par conception)
npm run dev
```

Tu es alors branché sur la vraie base avec les droits de **ton propre compte membre**.
Les notifications push, elles, nécessitent des clés supplémentaires détenues par les
admins — tout le reste du site fonctionne sans.

## Contribuer

Les contributions d'ancien·nes du LSNO sont bienvenues — lis
**[CONTRIBUTING.md](CONTRIBUTING.md)** (installation, règles maison, pièges connus,
circuit de relecture, et les règles de test du réseau social).

Contact : lsno.alumni@gmail.com

*Travail · Excellence · Discipline* 🇧🇫
