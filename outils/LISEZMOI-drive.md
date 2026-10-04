# Brancher la bibliothèque sur le Google Drive de l'association

Les documents de la bibliothèque (annales, devoirs, cours, corrigés) ne sont **pas stockés sur le
site** : le site les dépose sur le Google Drive du compte **lsno.alumni@gmail.com**, dans un dossier
« Bibliothèque ». Pour ça, il lui faut une autorisation durable, à obtenir une seule fois (≈ 20 min).

## 1. Préparer, dans la console Google Cloud (connecté avec lsno.alumni@gmail.com)

1. https://console.cloud.google.com → créer un projet, par exemple « LSNO Amicale ».
2. **APIs et services → Bibliothèque** → chercher « Google Drive API » → **Activer**.
3. **APIs et services → Écran de consentement OAuth** : type **Externe**, nom « LSNO Amicale »,
   adresse d'assistance lsno.alumni@gmail.com, puis **Publier l'application** (statut « En
   production »). Sans publication, le jeton expirerait au bout de 7 jours. Pas besoin de validation
   Google : la portée `drive.file` n'est pas sensible.
4. **APIs et services → Identifiants → Créer des identifiants → ID client OAuth** : type
   **Application de bureau**, nom « Site LSNO Amicale ». Noter l'**ID client** et le **secret**.
5. Dans Google Drive, créer le dossier **Bibliothèque** (sous-dossier conseillé : « En attente »
   n'est pas nécessaire, le site range tout dans Bibliothèque et la base dit ce qui est publié).
   Ouvrir le dossier : l'adresse se termine par `/folders/<IDENTIFIANT>` → c'est `DRIVE_DOSSIER_ID`.

## 2. Obtenir le jeton durable (sur ton ordinateur, dans le dossier du site)

```
node outils/drive-jeton.mjs <ID_CLIENT> <SECRET>
```

Une page Google s'ouvre : se connecter avec **lsno.alumni@gmail.com**, accepter. Le terminal
affiche `GOOGLE_REFRESH_TOKEN=…`. Portée accordée : `drive.file` seulement — le site ne voit que
les fichiers qu'il a lui-même créés.

## 3. Coller dans Vercel

Projet → **Settings → Environment Variables**, pour **Production** et **Preview** :

| Variable | Valeur |
|---|---|
| `GOOGLE_CLIENT_ID` | l'ID client |
| `GOOGLE_CLIENT_SECRET` | le secret |
| `GOOGLE_REFRESH_TOKEN` | le jeton affiché par le script |
| `DRIVE_DOSSIER_ID` | l'identifiant du dossier Bibliothèque |

Puis **Redeploy**. Tant que ces variables manquent, le formulaire « Proposer un document » ne
propose que le lien externe, et dit pourquoi.

## En cas de souci

- « Google refuse le jeton » dans les journaux Vercel : le jeton a été révoqué (mot de passe du
  compte changé, accès retiré dans myaccount.google.com → Sécurité → Accès tiers) → refaire l'étape 2.
- Les fichiers déposés sont partagés « toute personne disposant du lien, lecture » : c'est ce qui
  permet aux membres d'ouvrir le document depuis la fiche. Un refus ou un retrait supprime le fichier.
