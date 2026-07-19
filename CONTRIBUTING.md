# Contribuer à LSNO Amicale

Merci de vouloir donner un coup de main ! Ce guide te met en selle en un quart d'heure
et t'évite les pièges connus du projet.

## Qui peut contribuer

Le code est public, les contributions viennent en priorité des **ancien·nes du LSNO**.
Avant de coder une nouvelle fonctionnalité, ouvre une *issue* GitHub (ou écris à
lsno.alumni@gmail.com) pour en discuter — beaucoup d'idées ont déjà été étudiées,
certaines volontairement écartées.

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

Ces deux valeurs sont **publiques par conception** (elles sont dans le navigateur de
chaque visiteur du site) : la sécurité des données est assurée par la Row Level Security
de la base, pas par le secret de ces clés.

4. `npm run dev` → http://localhost:3000. Tu es branché sur la vraie base, avec les
   droits de **ton propre compte membre** — connecte-toi avec, tu verras ce qu'un membre voit.

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
- **Jamais de secret dans le code** — le dépôt est public. Les clés vivent dans les
  variables d'environnement Vercel et le Vault Supabase. Un secret committé = compromis.
- **Migrations SQL toujours additives** (`supabase/migration-XX-….sql`) : on ajoute des
  tables ou des colonnes, on ne renomme ni ne supprime jamais un champ en production.
  Tu écris la migration, un admin l'exécute — tu n'as pas accès à la base, c'est normal.
- **La confidentialité se joue dans la base** : si ta fonctionnalité touche aux données
  personnelles, la règle d'accès doit être une policy RLS ou une fonction SQL, pas un
  `if` côté client.

## Pièges connus (tu gagneras du temps)

- Toute **nouvelle table** doit recevoir des `GRANT` explicites (l'exposition automatique
  est désactivée) ; toute **nouvelle colonne de `profiles`** doit être ajoutée au
  `grant select (…)` — sinon l'API renvoie vide, sans erreur.
- Le composant `Avatar` doit toujours recevoir une **classe de taille dédiée** quand il
  sort des fiches de l'annuaire (le bug de « l'avatar géant » a frappé 4 fois).
- Éviter `alter type … add value` dans l'éditeur SQL Supabase (transaction) — réutiliser
  les valeurs d'enum existantes.
- Icônes Next.js : PNG en mode **RGBA** obligatoire, sinon le build échoue.

## Le circuit d'une contribution

1. Crée une branche sur ton fork : `git checkout -b ma-modif`.
2. Code, teste en local (y compris à 340 px), `npm run build` doit passer sans erreur.
3. Pousse et ouvre une **Pull Request** vers `main` du dépôt, en décrivant : le problème,
   la solution, ce que tu as testé. Une capture d'écran mobile aide beaucoup.
4. Un mainteneur relit, discute si besoin, et merge. **Le merge sur `main` déploie
   automatiquement en production** — c'est pour ça que tout passe par relecture.
5. S'il y a une migration SQL, un admin l'exécute au moment du merge.

Petites PR ciblées > grosses PR fourre-tout. Une PR = un sujet.

## Ce qui ne passe pas par GitHub

L'administration (Supabase, Vercel, Brevo, validation des membres) reste à un cercle
restreint d'admins — un contributeur code n'en a pas besoin. Si une tâche exige un accès
que tu n'as pas, décris-la dans l'issue : un admin fera la manipulation.

Merci ! *Travail · Excellence · Discipline* 🇧🇫
