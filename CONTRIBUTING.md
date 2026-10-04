# Contribuer à LSNO Amicale

Merci de vouloir donner un coup de main ! Ce guide te met en selle en un quart d'heure
et t'évite les pièges connus du projet.

## Qui peut contribuer

Le code est public, les contributions viennent en priorité des **ancien·nes du LSNO**.
Avant de coder une nouvelle fonctionnalité, ouvre une *issue* GitHub (ou écris à
lsno.alumni@gmail.com) pour en discuter — beaucoup d'idées ont déjà été étudiées,
certaines volontairement écartées (statistiques visuelles, notifications de « qui a vu
mon profil », commentaires sur les profils, réactions emoji sur les publications,
récurrence des événements, co-admin de groupe…). La messagerie et le fil, longtemps
écartés, existent depuis septembre 2026 et sont en production depuis le 4 octobre 2026
(fusion de la branche `social` après validation du comité, voir README).

## Installation

1. Installe [Node.js](https://nodejs.org) (LTS) et Git.
2. **Fork** ce dépôt sur ton compte GitHub, puis :

```bash
git clone https://github.com/<ton-compte>/site.git
cd site
npm install
```

3. Crée un fichier `.env.local` à la racine :

```
NEXT_PUBLIC_SUPABASE_URL=https://pdjbqdwurwgxzghehldr.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_HdNHgnLV2qssIAZiE-_aZg_3uRGwrbl
NEXT_PUBLIC_TURNSTILE_SITE_KEY=0x4AAAAAAEDxH4Oeu-zLZbfi
```

La troisième est la clé publique de la vérification anti-robot : quand le captcha est actif
côté Supabase, elle est **indispensable** pour se connecter en local (sans elle, aucun jeton
n'est joint et toute connexion est refusée). Ces trois valeurs sont **publiques par conception** : elles partent dans le navigateur de
chaque visiteur du site, n'importe qui peut les y lire. Ce qui protège les données, c'est
la Row Level Security **et** le fait que le rôle `anon` n'a aucun droit sur aucune table
(vérifiable par `supabase/verif-sante.sql`), pas le secret de ces clés.

Les vrais secrets, eux, ne sont **jamais** dans le dépôt : clé Brevo et clé `service_role`
dans le Vault de Supabase, clés VAPID et secret des notifications dans les variables
d'environnement Vercel.

4. `npm run dev` → http://localhost:3000. Tu es branché sur la vraie base, avec les
   droits de **ton propre compte membre** — connecte-toi avec, tu verras ce qu'un membre voit.
   ⚠ Après avoir ajouté un dossier de route (surtout `@modal/(..)xxx`) ou un `template.js`,
   arrête le serveur, supprime `.next/dev` et relance : le serveur de développement ne
   découvre pas toujours les nouvelles routes parallèles à chaud.

### Cas particulier : les notifications push

Elles exigent des clés que seuls les admins détiennent (`NEXT_PUBLIC_VAPID_PUBLIC`,
`VAPID_PUBLIC`, `VAPID_PRIVATE`, `PUSH_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`). Sans elles,
**tout le reste du site fonctionne** : seul le bouton d'activation échouera. Si ta
contribution les concerne, demande-les — et sache que les notifications ne marchent
qu'en HTTPS (ou sur `localhost`, exception des navigateurs).

## Où vit quoi

```
src/app/            pages (App Router)          src/components/  composants partagés
src/app/api/push/   envoi des notifications     src/lib/         un module par brique + Supabase
src/middleware.js   protection des routes       supabase/        tables, RLS, triggers, crons
public/             images, icônes, sw.js       outils/banc/     banc d'essai + scénarios SQL
```

Le réseau social est découpé en briques, chacune avec sa migration, son module `src/lib/`,
son dossier `src/app/` et son scénario de banc : fil (52, 62), messages (53→58, 68),
questions (59→61, 71), moments (64, 65), événements (66, 67), temps réel (69), mode essai
des notifications (63, 70), tour des nouveautés (72), message de bienvenue (73).

Deux réflexes utiles :

- **Les emails et les notifications partent de la BASE** (triggers + pg_cron), pas du
  front. Si tu cherches « qui envoie ce message ? », regarde dans `supabase/`.
- **La liste des domaines** (`src/lib/donnees.js`) est du texte libre côté base : en
  ajouter un ne demande aucune migration, juste une icône dans `IconeDomaine.js`.
  ⚠ En revanche la fonction SQL `nom_domaine()` (migration 32) en est un **miroir** :
  ajoute le nouveau domaine là aussi, sinon il manquera dans le texte des notifications.

## Les règles maison (non négociables)

- **CSS pur** — pas de Tailwind, pas de framework CSS. Les styles vivent dans
  `src/app/globals.css` et `src/app/ecrans.css`, avec les variables de la palette
  « Latérite » définies en `:root` (thème clair) et sous `[data-theme="sombre"]` : fonds
  kraft/pierre/bleu nuit, **un seul accent bleu** (`--bleu`, `--bleu-clair`, `--bleu-texte`),
  texte via `--texte`/`--texte-2`/`--brume`. Toujours écrire une couleur via une variable,
  jamais en dur, sinon l'un des deux thèmes casse.
- **Avant de créer une classe CSS, `grep` son nom** dans les CSS et les JSX. `.sceau` et
  `.nouveau` existaient déjà quand on a voulu les réutiliser ; la collision a cassé en prod
  la première fois, et fait disparaître les prénoms du rail de moments la seconde.
- **Français partout** : interface, commentaires, noms de variables et de fonctions.
- **Mobile d'abord** : vérifie chaque écran à **340 px** de large (outils dev → mode
  responsive). Le réseau vit sur des téléphones, parfois en 3G — pas de librairie lourde,
  pas d'image non compressée.
- **Design sobre** : un accent, icônes Lucide (jamais d'emojis dans l'interface, sauf les
  réactions choisies par les membres), vraies photos du lycée et vraies matières.
- **Pas de nouvelle dépendance** sans en discuter d'abord. Hors Next et React, le projet
  n'en compte que cinq : `@supabase/ssr`, `@supabase/supabase-js`, `lucide-react`,
  `react-easy-crop` et `web-push` (serveur). Si une librairie est indispensable et lourde,
  la charger en **import dynamique** (c'est le cas de `react-easy-crop`).
- **Jamais de secret dans le code** — le dépôt est public. Les clés vivent dans les
  variables d'environnement Vercel et le Vault Supabase. Un secret committé = compromis.
- **Migrations SQL toujours additives** (`supabase/migration-XX-….sql`) : on ajoute des
  tables ou des colonnes, on ne renomme ni ne supprime jamais un champ en production.
  Tu écris la migration, un admin l'exécute — tu n'as pas accès à la base, c'est normal.
- **La confidentialité se joue dans la base** : si ta fonctionnalité touche aux données
  personnelles, la règle d'accès doit être une policy RLS ou une fonction SQL, pas un
  `if` côté client.
- **Fraîcheur des données** : le service worker ne met en cache ni page ni donnée (seulement les MÉDIAS immuables des messages et du fil, voir `public/sw.js`) ; côté client, les
  pages dynamiques sont gardées 30 s (`staleTimes` dans `next.config.mjs`) et la mémoire
  d'onglet (`src/lib/memoire.js`) retrouve listes, filtres et position. La contrepartie :
  **toute écriture** (validation, publication, réglage…) doit être suivie d'un
  `router.refresh()` et, pour les listes en mémoire, d'une relecture — sinon l'écran montre
  l'état d'avant pendant 30 s.
- **Une feuille glissante pour tout ce qui s'ouvre par-dessus une liste** (`FeuilleGlissante`
  + route interceptée `@modal/(..)xxx`) : profils, offres, événements, créations. La page
  complète doit exister aussi (lien partagé, rechargement).
- **Les erreurs parlent français** : jamais un message brut de Supabase ou du navigateur à
  l'écran (« Failed to fetch »). Passer par `texteErreur()` / `avecReprise()`
  (`src/lib/erreurs.js`), qui traduisent, proposent de réessayer et distinguent la panne
  réseau. Les messages d'information s'affichent **en haut** de l'écran (toast), jamais en
  bas où la barre d'onglets les cache.

## Tester le réseau social sans faire de bruit

Le site de développement est branché sur la **vraie base** : une publication de test est
une vraie publication, et chaque écriture déclenche de **vraies notifications** chez les
vrais membres. Règles apprises à nos dépens :

1. **Activer le mode essai des notifications avant tout test qui écrit** (Validation →
   Notifications → « Mode essai ») : seuls les admins et les comptes de test listés reçoivent
   les push. Le couper en fin de session. Sans lui, un script de test a réveillé tout le réseau.
2. **Deux niveaux de test** : d'abord une maquette (Playwright avec `page.route` qui simule les
   RPC — rien n'est écrit), puis un test réel avec **deux comptes de test** dédiés, jamais
   avec des membres réels ni en les ajoutant à des groupes.
3. **Tout script réel nettoie ce qu'il a créé** — au début (les restes d'un essai raté) et à
   la fin : publications, moments, événements, groupes, fichiers du bucket.
4. **Vérifier chaque écran sans défilement horizontal** (`document.documentElement.scrollWidth
   === window.innerWidth`) : un débordement de 27 px a suffi à pousser la barre d'onglets
   hors de l'écran.
5. **Le banc juge aussi le comportement** : `npm run banc -- outils/banc/essai-groupes.sql`
   rejoue toute la base puis un scénario (RLS, RPC, purges). Ajouter un scénario par brique.

## Sécurité : ce que le middleware vérifie vraiment (03/08)

`signInWithPassword()` crée TOUJOURS une session valide (niveau « aal1 »), même quand un second facteur va être demandé — c'est ainsi que Supabase fonctionne, la vérification du code se fait SUR cette session. **Une session aal1 EST une session valide.** Toute vérification qui se contente de « existe-t-il une session ? » laisse donc passer un compte protégé qui n'a jamais saisi son code — c'est le bug fermé par la migration 46 (le bouton « retour » depuis l'écran du code suffisait à atterrir sur l'accueil connecté).

**Règle à respecter dans tout nouveau point d'entrée** (nouvelle page publique dual-usage à la « / », nouvel appel direct à `getUser()`/`getClaims()`…) : ne jamais traiter « une session existe » comme équivalent à « ce membre est pleinement authentifié ». Vérifier en plus, pour les rôles delegue/admin, `profiles.double_auth_active` contre `aal` du jeton (`getClaims().data.claims.aal`, gratuit) — modèle dans `src/middleware.js` et `utilisateurCourant()` (`src/lib/api.js`).

## Pièges connus (tu gagneras du temps)

**Base de données**

- Toute **nouvelle table** doit recevoir des `GRANT` explicites — l'exposition automatique
  est **désactivée volontairement** (un oubli de RLS ne peut donc pas ouvrir la table).
  Penser à `authenticated` **et** à `service_role` si une route serveur la lit, sinon :
  `permission denied for table …`.
- **Tu crées une fonction SQL appelée par le navigateur ?** Ajoute son nom dans
  `sante_fonctions_ouvertes` (une ligne, avec la raison). Sinon le contrôle de santé la
  signalera comme « fonction interne laissée ouverte » — c'est voulu : toute fonction
  `security definer` non déclarée est suspecte.
- **Avant de proposer une migration, vérifie sa syntaxe** — hors ligne, en une commande :
  ```
  pip install pglast        # une fois
  python outils/verif_sql.py
  ```
  C'est le vrai analyseur de PostgreSQL : ce qu'il accepte, le serveur l'accepte. Le même
  contrôle tourne automatiquement à chaque push (`.github/workflows/sql.yml`). Il ne voit
  que la syntaxe : une table inexistante ou un ordre d'évaluation hasardeux passent au
  travers — d'où le banc d'essai ci-dessous.
- **Puis rejoue toute la base sur un Postgres jetable** :
  ```
  npm run banc
  ```
  Il monte un vrai PostgreSQL en mémoire (PGlite, aucune installation, aucun service à
  lancer) et rejoue `schema.sql` puis **toutes** les migrations dans l'ordre. Il attrape ce
  que la syntaxe ne peut pas voir : une colonne qui n'existe pas, une fonction appelée
  avant d'être créée, une politique qui référence une table à venir. Il tourne aussi à
  chaque push.
  - Supabase fournit des choses qu'un PostgreSQL nu n'a pas (`auth.uid()`, le Vault,
    pg_cron, pg_net, `storage`). `outils/banc/prelude.sql` les recrée **en façade** —
    strictement de quoi laisser passer les migrations.
  - **Ce que le banc ne peut PAS juger** : le comportement réel de l'authentification,
    l'envoi des emails et des notifications (`net.http_post` est un leurre qui ne fait
    rien), et l'exécution des tâches planifiées (`cron.schedule` enregistre, n'exécute
    pas). Il répond à « la base se construit-elle ? », pas à « se comporte-t-elle comme
    Supabase ? ».
  - Il tourne sur une version de PostgreSQL **plus récente** que celle de Supabase. Un
    échec ici alors que la production est verte n'est donc pas un faux positif : c'est un
    avertissement pour la prochaine montée de version. C'est exactement ce qui a produit
    la migration 43.
- **Le banc juge les FICHIERS, pas la vraie base.** Il rejoue tout, il ne sait pas ce qui a
  réellement été exécuté en production. Pour ça, un admin lance `supabase/verif-migrations.sql` :
  une ligne par migration, « ok » ou « MANQUE ». Il existe parce que le 02/08 une migration
  n'avait jamais tourné alors que le suivi la disait faite. **Tu ajoutes une migration ? Ajoute
  sa ligne dans ce fichier** — une trace qu'elle laisse en base, et pour une migration qui
  RÉÉCRIT une fonction existante, un morceau de son nouveau texte (`prosrc like`) plutôt que
  son nom, sinon l'ancienne version passe pour la nouvelle.
- **Un script de maintenance qui corrige des DONNÉES bouscule `maj_le`.** Le déclencheur de
  `profiles` écrit `maj_le := now()` à chaque `update`, y compris celui d'un nettoyage. Le
  02/08, rogner les blancs de cinq conseils a fait passer ces cinq fiches pour « modifiées
  aujourd'hui », alors que leurs auteurs n'avaient rien fait. Sans conséquence pour l'instant
  — rien ne lit `profiles.maj_le` — mais c'est la colonne évidente pour un futur « mis à jour
  récemment ». Avant un nettoyage de masse : soit l'assumer et le DIRE, soit préserver la
  valeur (`alter table profiles disable trigger …` le temps de l'`update`, puis la réactiver).
  Et toujours restreindre le `where` aux lignes qui changent vraiment, pour n'en toucher
  aucune de plus.
- **Un contrôle destiné à être LU tient en UNE instruction** : l'éditeur SQL de Supabase
  n'affiche que le résultat de la dernière. Un script « avant / action / après » cache donc
  ses deux contrôles (vécu le 02/08). Modèle : `supabase/verif-nettoyage.sql`.
- ⚠️ **Vécu le 01/08, à ne pas revivre** : une migration contenant du **DDL**
  (`create table`, `alter table … add column`) a fait perdre au rôle `authenticated`
  ses privilèges sur des tables **déjà existantes**. Conséquence côté site : « Mon profil »
  ne s'affichait plus, les listes revenaient vides, et l'app redemandait la connexion —
  autrement dit **ça ne ressemblait pas du tout à un problème de droits, mais à une
  déconnexion**, parce que `utilisateurCourant()` ne pouvait plus lire le profil.
  Deux réflexes :
  1. **terminer toute migration à DDL par les `GRANT` explicites** dont l'app a besoin
     (modèle : `supabase/migration-38-retablir-droits.sql`) ;
  2. **vérifier juste après** — une seule ligne suffit :
     ```sql
     select * from sante_systeme where verdict like 'PROBL%';   -- rien = tout va bien
     ```
     La vue `sante_systeme` (migration 40) décrit le modèle attendu de bout en bout, et
     la tâche mensuelle `controle_sante()` alerte les admins si quelque chose dérive.
  Retenir le modèle à **deux étages indépendants** : les privilèges Postgres disent quelles
  **tables** un rôle peut toucher, la RLS dit quelles **lignes**. Perdre le premier ferme
  tout, politiques intactes ou non.
- Un **`upsert`** (`insert … on conflict do update`) exige en plus le privilège `update`.
- Toute **nouvelle colonne de `profiles`** doit être ajoutée au `grant select (…)` —
  sinon l'API la renvoie vide, sans erreur.
- **`on conflict` n'existe pas sur un `select`** : pour créer un secret du Vault une seule
  fois, utiliser `do $$ begin if not exists (select 1 from vault.decrypted_secrets
  where name = '…') then … end if; end $$;`.
- Éviter `alter type … add value` dans l'éditeur SQL Supabase (transaction) — réutiliser
  les valeurs d'enum existantes.
- Pour déboguer un envoi (email ou notification) déclenché par la base :
  `select id, status_code, content from net._http_response order by id desc limit 5;`

**Front**

- ⚠️ **Mots collés au gras** — le piège le plus sournois du projet, vu deux fois. JSX
  **supprime** le retour à la ligne qui touche une balise, et surtout : quand un bloc de
  texte s'étale sur **plusieurs lignes**, son espace de début disparaît **même s'il suit la
  balise sur la même ligne**. `<b>promotion</b> validera` a ainsi été livré en
  « promotion**validera** ». Règle : après une balise en ligne (`b`, `em`, `i`, `code`,
  `strong`, `a`, `Link`), écrire un `{" "}` explicite plutôt qu'une espace.
  Et pour chercher les cas existants : un détecteur qui ne repère que les majuscules
  (« situation**Ci** ») ne voit PAS « promotionvalidera » — chercher aussi les mots
  anormalement longs dans le texte **rendu**, pas dans la source.
- ⚠️ **Tester une build de production en local** : tuer node **avant** de démarrer, et
  vérifier que le serveur affiche « Ready » sans `EADDRINUSE`. Un serveur d'un essai
  précédent sert des fragments périmés — erreurs 500, type MIME `text/plain`, pages vides —
  et fait diagnostiquer dans le vide (perdu trois fois là-dessus le 01/08).

- Le composant `Avatar` doit toujours recevoir une **classe de taille dédiée** quand il
  sort des fiches de l'annuaire (le bug de « l'avatar géant » a frappé 4 fois).
- **Ne jamais se fier à `document.referrer`** : la navigation Next est côté client, il ne
  change jamais et il est vide quand le site est ouvert depuis l'écran d'accueil. Pour
  savoir si l'on peut revenir en arrière, utiliser `components/SuiviNavigation.js`
  (compteur de navigations internes), qui gère aussi la restauration de la position.
- Un `<button>` servant de conteneur hérite du **noir par défaut** du navigateur si aucune
  couleur n'est fixée (`globals.css` impose désormais `color: inherit`).
- Icônes Next.js : PNG en mode **RGBA** obligatoire, sinon le build échoue.
- **Notifications : désactiver ne révoque pas l'autorisation du navigateur.** Tout
  réabonnement « automatique » doit donc vérifier le refus explicite mémorisé sur
  l'appareil (`refusLocal()` dans `src/lib/push.js`) — sinon on réactive contre la
  volonté du membre (bug vécu le 29/07).
- **Les écrans qui chargent dans le navigateur gardent une mémoire d'onglet** (`src/lib/memoire.js`),
  conversations comprises (`conv.<id>` : messages, réactions, sondages…) : on affiche ce qu'on
  avait, on recharge derrière, et on FUSIONNE (le rechargement fait foi sur sa fenêtre, le
  temps réel arrivé entre-temps est gardé — voir `fusionner()` dans Conversation.js). Les adresses
  signées des pièces sont réutilisées 50 min (`urlsPieces` / `urlsConnues`) pour que le navigateur
  resserve les fichiers déjà reçus. Toute image ou vidéo de contenu passe par `ImageRobuste` /
  `useReessai` (`src/components/MediaRobuste.js`) : trois nouvelles tentatives, puis « Réessayer ».
- **Ne pas retirer le gestionnaire `fetch` de `public/sw.js`** ni l'enregistrement du
  service worker pour tous (`initInstallation()`) : Chrome n'offre l'installation de l'appli
  que si un service worker actif possède un gestionnaire `fetch`. C'est la seule raison de sa
  présence au départ — il ne touche ni aux pages ni aux données ; il sert aussi, depuis le 02/10,
  à garder les médias immuables (buckets `pieces` et `medias`, 300 fichiers max).
- **`beforeinstallprompt` se capte au plus tôt** (dans le composant client du layout) : cet
  événement est émis une seule fois, peu après le chargement. Le capter dans une page arrivée
  trop tard le fait manquer.
- Icône de notification Android : seule la **transparence** est utilisée — une image à fond
  plein apparaît en carré blanc (d'où `public/badge-notif.png`, une silhouette).
- **Une feuille interceptée reste affichée** si l'on navigue ensuite vers une page qui n'a
  pas de feuille associée (création d'un groupe → conversation, par exemple). Dans ce cas,
  sortir par `window.location.assign(...)` après `noterNavigationComplete()`, pas par
  `router.push`.
- **Dans un dossier `[id]` intercepté, la route `nouveau`/`nouvelle` est capturée par
  `[id]`** : la feuille de création vit donc dans la page `[id]` interceptée, qui teste
  `id === "nouveau"`.
- **`overflow-x: hidden` casse `position: sticky`** dans le conteneur d'une feuille
  (`.fg-contenu`) : utiliser `overflow-x: clip`.
- **`rail_moments` appelé par carte** (228 appels sur l'annuaire) : toute donnée partagée par
  une liste de cartes se lit une fois, dans un cache de module (`useAuteursMoments`).
- **Type de fichier des questions** : la base stocke `"photo"` / `"pdf"`, pas un type MIME.
- **Les règles de lint React 19** (`set-state-in-effect`, `immutability`, refs en rendu,
  `Date.now()` en rendu) sont bloquantes : `setTimeout`/`requestAnimationFrame` pour un état
  posé après le rendu, `useState(() => Date.now())`, pas de composant défini dans le rendu.
- **Médias lisibles par TOUTES les plateformes** (03/10). Chaque navigateur enregistre les
  vocaux dans son format (webm/opus pour Chrome, ogg/opus pour Firefox, mp4/AAC pour Safari) et
  aucun n'est lu par tous les autres (le webm de Firefox est refusé par Chrome : « demuxer seek
  failed » ; l'ogg est inconnu de Safari). Règle : le vocal est **réencodé en MP3** avant l'envoi
  par le téléphone qui l'a enregistré (`src/lib/audio.js`, encodeur chargé à la demande), et sa
  durée mesurée part avec le message (`fichier_duree`). Le lecteur (`LecteurAudio`) a un **moteur
  de secours** Web Audio pour les anciens fichiers qu'une balise `<audio>` refuse. Les vidéos ne
  se convertissent pas dans le navigateur : on lit leur étiquette avant l'envoi
  (`src/lib/video.js`) et on refuse HEVC/AV1/VP9/WebM avec le conseil utile (iPhone : « Le plus
  compatible »). Le service worker répond aux demandes **Range** des lecteurs en 206 : sans ça,
  impossible de se déplacer dans un vocal ou une vidéo servis depuis son cache.
- **Temps réel : ne jamais le croire garanti** (03/10, messages jamais reçus d'un côté). Tout
  abonnement passe par `abonner()` dans `src/lib/messages.js` : il attend que le client temps
  réel porte le jeton de session (sinon le serveur vérifie les droits en anonyme et refuse :
  « Unable to subscribe to changes with given parameters »), donne un nom UNIQUE à chaque canal
  (deux abonnements au même nom sur une connexion se faisaient refuser), recrée et réessaie un
  canal refusé (3 s, 8 s, 20 s), et rappelle `surReprise` à chaque (ré)abonnement pour que
  l'écran relise ce qu'il a pu manquer pendant un trou. UN SEUL canal par écran
  (`ecouterToutConversation`, `ecouterListe`) : sept abonnements d'un coup faisaient tomber une
  partie des canaux. La conversation relit aussi au retour au premier plan. Les canaux de
  diffusion « frappe » gardent un nom partagé : c'est lui qui relie les participants.
- **Jamais de suppression de fichier du Storage en SQL** (03/10). Supabase refuse désormais
  `delete from storage.objects` depuis une fonction, même « security definer » (42501 « Direct
  deletion from storage tables is not allowed. Use the Storage API instead. »). Une fonction qui
  retire une ligne renvoie le chemin du fichier, et l'appli le supprime par l'API Storage, couverte
  par une politique `delete` adéquate (exemple : `carrousel_retirer`, migration 81). Les purges
  planifiées, elles, passent par pg_net vers l'API avec la clé service_role.
- **Toute nouvelle prise de parole passe par `profil_complet()`** (04/10, migration 84) : côté base,
  la politique d'insertion (ou la fonction) ajoute `and profil_complet()` ; côté écran, la fonction de
  la lib commence par `await exigerProfilComplet()` (`src/lib/profilComplet.js`), qui ouvre la feuille
  `CompleterProfil` montée dans la mise en page racine et reprend le geste une fois le minimum posé.
  Les deux sont nécessaires : l'écran pour l'expérience, la base pour la règle. Le banc
  `essai-profil-complet.sql` compte les politiques concernées (7) — l'y ajouter.
- **Bibliothèque : les fichiers vivent sur le Google Drive de l'association, pas sur le site** (04/10).
  Le serveur dépose sur le Drive de lsno.alumni avec un jeton durable (portée `drive.file` : le site ne
  voit que les fichiers qu'il crée) ; quatre variables Vercel `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
  `GOOGLE_REFRESH_TOKEN`, `DRIVE_DOSSIER_ID` (procédure : `outils/LISEZMOI-drive.md`). Sans elles, les
  routes `/api/bibliotheque/*` répondent 503 et le formulaire ne propose que le lien. Une requête Vercel
  ne dépasse pas 4,5 Mo : le dépôt se fait par morceaux de 3 Mo (multiples de 256 Ko, exigence Drive)
  transmis à une session « resumable ». Un refus ou un retrait supprime le fichier par l'API, jamais en SQL.
- **Toute nouvelle table doit satisfaire le contrôle de santé** (migration 75) : des droits de table
  accordés à `authenticated` hors du modèle attendu sont signalés → préférer des fonctions
  `security definer` en liste blanche (`sante_fonctions_ouvertes`) sans aucun droit de table ; RLS
  activée avec au moins une politique ; pas de séquence (sinon accorder USAGE). Exemple :
  `carrousel_photos` (migration 80).

## Le circuit d'une contribution

1. Crée une branche sur ton fork : `git checkout -b ma-modif`.
2. Code, teste en local (y compris à 340 px), `npm run build` doit passer sans erreur.
3. Pousse et ouvre une **Pull Request** vers `main` du dépôt, en décrivant : le problème,
   la solution, ce que tu as testé. Une capture d'écran mobile aide beaucoup. Chaque branche a son aperçu Vercel.
4. Un mainteneur relit, discute si besoin, et merge. **Le merge sur `main` déploie
   automatiquement en production** — c'est pour ça que tout passe par relecture.
5. S'il y a une migration SQL, un admin l'exécute au moment du merge. Précise dans la PR
   si elle doit être exécutée **avant** ou **après** le déploiement du code (une requête
   qui lit une table encore inexistante casse la page concernée).

Petites PR ciblées > grosses PR fourre-tout. Une PR = un sujet.

## Ce qui ne passe pas par GitHub

L'administration (Supabase, Vercel, Brevo, validation des membres) reste à un cercle
restreint d'admins — un contributeur code n'en a pas besoin. Si une tâche exige un accès
que tu n'as pas, décris-la dans l'issue : un admin fera la manipulation.

Merci ! *Travail · Excellence · Discipline* 🇧🇫
