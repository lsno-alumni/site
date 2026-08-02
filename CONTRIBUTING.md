# Contribuer à LSNO Amicale

Merci de vouloir donner un coup de main ! Ce guide te met en selle en un quart d'heure
et t'évite les pièges connus du projet.

## Qui peut contribuer

Le code est public, les contributions viennent en priorité des **ancien·nes du LSNO**.
Avant de coder une nouvelle fonctionnalité, ouvre une *issue* GitHub (ou écris à
lsno.alumni@gmail.com) pour en discuter — beaucoup d'idées ont déjà été étudiées,
certaines volontairement écartées (messagerie interne, statistiques visuelles,
notifications de « qui a vu mon profil »…).

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
```

Ces deux valeurs sont **publiques par conception** : elles partent dans le navigateur de
chaque visiteur du site, n'importe qui peut les y lire. Ce qui protège les données, c'est
la Row Level Security **et** le fait que le rôle `anon` n'a aucun droit sur aucune table
(vérifiable par `supabase/verif-sante.sql`), pas le secret de ces clés.

Les vrais secrets, eux, ne sont **jamais** dans le dépôt : clé Brevo et clé `service_role`
dans le Vault de Supabase, clés VAPID et secret des notifications dans les variables
d'environnement Vercel.

4. `npm run dev` → http://localhost:3000. Tu es branché sur la vraie base, avec les
   droits de **ton propre compte membre** — connecte-toi avec, tu verras ce qu'un membre voit.

### Cas particulier : les notifications push

Elles exigent des clés que seuls les admins détiennent (`NEXT_PUBLIC_VAPID_PUBLIC`,
`VAPID_PUBLIC`, `VAPID_PRIVATE`, `PUSH_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`). Sans elles,
**tout le reste du site fonctionne** : seul le bouton d'activation échouera. Si ta
contribution les concerne, demande-les — et sache que les notifications ne marchent
qu'en HTTPS (ou sur `localhost`, exception des navigateurs).

## Où vit quoi

```
src/app/            pages (App Router)          src/components/  composants partagés
src/app/api/push/   envoi des notifications     src/lib/         domaines, pays, promos, Supabase
src/middleware.js   protection des routes       supabase/        tables, RLS, triggers, crons
public/             images, icônes, sw.js
```

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
  (encre, craie, or) définies en `:root`.
- **Français partout** : interface, commentaires, noms de variables et de fonctions.
- **Mobile d'abord** : vérifie chaque écran à **340 px** de large (outils dev → mode
  responsive). Le réseau vit sur des téléphones, parfois en 3G — pas de librairie lourde,
  pas d'image non compressée.
- **Design sobre** : 3 couleurs, icônes Lucide (jamais d'emojis dans l'interface),
  vraies photos du lycée.
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
- **Pas de mise en cache du contenu** : ni côté client, ni dans le service worker. La
  fraîcheur des données prime (un membre validé doit apparaître immédiatement).

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
- **Ne pas toucher au gestionnaire `fetch` vide de `public/sw.js`** ni à l'enregistrement du
  service worker pour tous (`initInstallation()`) : Chrome n'offre l'installation de l'appli
  que si un service worker actif possède un gestionnaire `fetch`. C'est la seule raison de sa
  présence — il n'intercepte rien et ne met rien en cache.
- **`beforeinstallprompt` se capte au plus tôt** (dans le composant client du layout) : cet
  événement est émis une seule fois, peu après le chargement. Le capter dans une page arrivée
  trop tard le fait manquer.
- Icône de notification Android : seule la **transparence** est utilisée — une image à fond
  plein apparaît en carré blanc (d'où `public/badge-notif.png`, une silhouette).

## Le circuit d'une contribution

1. Crée une branche sur ton fork : `git checkout -b ma-modif`.
2. Code, teste en local (y compris à 340 px), `npm run build` doit passer sans erreur.
3. Pousse et ouvre une **Pull Request** vers `main` du dépôt, en décrivant : le problème,
   la solution, ce que tu as testé. Une capture d'écran mobile aide beaucoup.
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
