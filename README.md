# LSNO Amicale

Le réseau en ligne des ancien·nes du **Lycée Scientifique National de Ouagadougou** :
un annuaire privé où chaque membre présente son parcours, pour que les cadets trouvent
le bon interlocuteur et que le réseau de tous se renforce.

**En production : https://lsno-alumni.vercel.app**

> Plateforme associative à but non lucratif, développée et administrée bénévolement par
> des anciens — indépendante de l'administration du lycée. Rien n'est visible du grand
> public : seuls les membres validés se voient entre eux.

## Ce que fait le site

**Pour les membres**

- **Annuaire** avec recherche (tolérante aux accents et à la casse) et filtres : domaine,
  promotion, pays, situation
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
  nouvelle offre, de l'arrivée d'un camarade… réglables par familles, avec le choix de la
  **portée** pour les arrivées (tout le réseau / sa promo / son domaine), la **liste de ses
  appareils** et un **regroupement** automatique au-delà de quelques notifications non lues
- **Installable comme une appli**, avec **aide guidée** : bouton d'installation natif là où
  le navigateur le permet, gestes expliqués selon le téléphone ailleurs (bandeau sur l'accueil
  + page permanente `À propos › Installer l'appli`)
- **Partage** de profils et d'offres avec **aperçu personnalisé** (WhatsApp…), sans jamais
  exposer autre chose qu'une vitrine volontaire

**Pour les délégués et les admins**

- **Validation des inscriptions par promotion** (un délégué ne valide que sa promo)
- **Gestion complète des membres** : identité, email de connexion, mot de passe
  temporaire, suspension, nomination de co-admin — sans jamais passer par Supabase
- **Annonce à tout le réseau** (envoi étalé pour respecter le quota d'emails)
- **Sauvegarde** en un clic (CSV) et **état du système** (tâches automatiques)
- **Interrupteur** des emails d'inscription aux admins, pour les lancements de promo

**Sous le capot**

- **36 migrations SQL** rejouables (`supabase/`) : la base se reconstruit à l'identique
- **14 automatisations** en base (pg_cron) : cycle des promotions, rappels, relances,
  purges, notifications
- **Notifications auto-hébergées** : service worker + route `/api/push` (signature VAPID),
  **aucun prestataire tiers**
- **Statut « élève »** géré par le calendrier scolaire (inscription ouverte à partir de la
  première, bascule « ancien » à la rentrée d'octobre)

## Architecture

| Couche | Techno | Notes |
|---|---|---|
| Front | Next.js 16 (App Router, JavaScript) | **CSS pur — pas de Tailwind** (choix assumé) |
| Base & auth | Supabase (PostgreSQL) | La sécurité vit dans la base : **Row Level Security** partout |
| Hébergement | Vercel | Déploiement automatique à chaque push sur `main` |
| Emails | Brevo | SMTP (authentification) + API appelée **par la base** (pg_net) |
| Notifications | Web Push (VAPID) | `public/sw.js` + route `/api/push`, appelée par la base |
| Fichiers | Supabase Storage | 2 buckets : `photos` (profils) et `ressources` (pièces jointes) |

Dépendances volontairement minimales : `@supabase/*`, `lucide-react` (icônes),
`react-easy-crop` (recadrage photo), `web-push`. Rien d'autre — merci d'en discuter
avant d'en ajouter une.

### Points structurants à connaître avant de toucher au code

- **La confidentialité est dans la base, pas dans l'affichage** : les contacts ne sortent
  de Postgres que via des fonctions qui appliquent la visibilité choisie par chaque
  membre. Ne jamais « contourner » côté client.
- **La chaîne de confiance descend** : admins → délégués (valident leur promotion) →
  membres. Un trigger interdit l'auto-promotion.
- **Mobile d'abord** : le réseau vit sur WhatsApp, sur des téléphones parfois en 3G.
  Tout écran se vérifie à **340 px** de large.
- **Pas de cache côté client** : la fraîcheur des données prime (un membre validé doit
  apparaître tout de suite). Le service worker ne met **rien** en cache — il ne sert
  qu'aux notifications.
- **Les emails et les notifications partent de la base** (triggers + pg_cron), pas du
  front : chercher la logique dans `supabase/`, pas dans les composants.

### Organisation du dépôt

```
src/app/            pages (App Router) : accueil, annuaire, profil, offres,
                    conseils, mon-profil, admin, inscription, connexion…
src/app/api/push/   route d'envoi des notifications (appelée par la base)
src/components/     composants partagés (Avatar, TabBar, Notifications…)
src/lib/            données de référence (domaines, pays, promotions), clients Supabase
src/middleware.js   protection des routes (vérification locale du jeton)
supabase/           schema.sql + migration-02…36 : tables, RLS, triggers, crons
public/             images du lycée, icônes, service worker (sw.js)
```

## Démarrer en local

```bash
git clone https://github.com/lsno-alumni/site.git
cd site
npm install
# créer .env.local :
#   NEXT_PUBLIC_SUPABASE_URL=...
#   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
# (valeurs dans CONTRIBUTING.md — publiques par conception)
npm run dev
```

Tu es alors branché sur la vraie base avec les droits de **ton propre compte membre**.
Les notifications push, elles, nécessitent des clés supplémentaires détenues par les
admins — tout le reste du site fonctionne sans.

## Contribuer

Les contributions d'ancien·nes du LSNO sont bienvenues — lis
**[CONTRIBUTING.md](CONTRIBUTING.md)** (installation, règles maison, pièges connus,
circuit de relecture).

Contact : lsno.alumni@gmail.com

*Travail · Excellence · Discipline* 🇧🇫
