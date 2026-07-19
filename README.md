# LSNO Amicale

Le réseau en ligne des ancien·nes du **Lycée Scientifique National de Ouagadougou** :
un annuaire privé où chaque membre présente son parcours, pour que les cadets trouvent
le bon interlocuteur et que le réseau de tous se renforce.

**En production : https://lsno-alumni.vercel.app**

> Plateforme associative à but non lucratif, développée et administrée bénévolement par
> des anciens — indépendante de l'administration du lycée. Rien n'est visible du grand
> public : seuls les membres validés se voient entre eux.

## Ce que fait le site

- **Annuaire** avec recherche (tolérante aux accents) et filtres : domaine, promotion, pays, situation
- **Profils riches** : parcours chronologique, conseil aux cadets, « Mon histoire », sujets de
  discussion, contacts à visibilité contrôlée (membres / sur demande / masqué)
- **Mise en relation** : demander le contact d'un ancien, qui accepte ou refuse (refus silencieux)
- **Offres & opportunités** : stages, emplois, bourses, cooptations — publiés par les membres
- **Accueil personnalisé** pour les membres connectés ; vitrine anonyme pour les visiteurs
- **Espace délégué/admin** : validation des inscriptions par promotion, gestion complète des
  membres, annonces, sauvegarde, état du système
- **8 automatisations** en base (pg_cron) : cycle des promotions, rappels, relances, purges…

## Architecture

| Couche | Techno | Notes |
|---|---|---|
| Front | Next.js (App Router, JavaScript) | **CSS pur — pas de Tailwind** (choix assumé) |
| Base & auth | Supabase (PostgreSQL) | La sécurité vit dans la base : **Row Level Security** partout |
| Hébergement | Vercel | Déploiement automatique à chaque push sur `main` |
| Emails | Brevo | SMTP (authentification) + API appelée par la base (notifications) |

Points structurants à connaître avant de toucher au code :

- **La confidentialité est dans la base, pas dans l'affichage** : les contacts ne sortent de
  Postgres que via des fonctions qui appliquent la visibilité choisie par chaque membre.
  Ne jamais « contourner » côté client.
- **La chaîne de confiance descend** : admins → délégués (valident leur promotion) → membres.
  Un trigger interdit l'auto-promotion.
- **Mobile d'abord** : le réseau vit sur WhatsApp, sur des téléphones parfois en 3G.
  Tout écran se vérifie à 340 px de large.
- Le dossier `supabase/` contient le schéma et toutes les migrations : la base se
  reconstruit à l'identique en les rejouant dans l'ordre.

## Démarrer en local

```bash
git clone https://github.com/lsno-alumni/site.git
cd site
npm install
# créer .env.local (voir CONTRIBUTING.md pour les valeurs) :
#   NEXT_PUBLIC_SUPABASE_URL=...
#   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
npm run dev
```

## Contribuer

Les contributions d'ancien·nes du LSNO sont bienvenues — lis **[CONTRIBUTING.md](CONTRIBUTING.md)**
(installation, règles maison, circuit de relecture).

Contact : lsno.alumni@gmail.com

*Travail · Excellence · Discipline* 🇧🇫
