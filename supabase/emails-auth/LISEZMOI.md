# Emails d'authentification (Supabase Auth)

Ces quatre emails ne partent pas de la base mais de **Supabase Auth**, et leur modèle se règle dans le
tableau de bord : **Authentication → Email Templates**. Ils étaient restés bleu nuit et or (juillet 2026).
Les fichiers de ce dossier reprennent l'enveloppe « Latérite » de la migration 78 (blason, thème clair et
sombre, texte d'aperçu, pied honnête), avec les variables Supabase (`{{ .ConfirmationURL }}`, `{{ .Email }}`,
`{{ .NewEmail }}`).

| Fichier | Onglet du tableau de bord | Objet conseillé |
|---|---|---|
| `confirmation-inscription.html` | Confirm signup | Confirme ton adresse email — LSNO Amicale |
| `mot-de-passe-oublie.html` | Reset password | Réinitialise ton mot de passe — LSNO Amicale |
| `changement-email.html` | Change email address | Confirme ta nouvelle adresse — LSNO Amicale |
| `lien-magique.html` | Magic link | Ton lien de connexion — LSNO Amicale |

Procédure (une fois, 5 minutes) : pour chaque ligne, ouvrir l'onglet, coller l'objet dans **Subject**, coller
le contenu du fichier dans **Message body** (mode source), enregistrer. Puis tester : « Mot de passe oublié »
depuis la page de connexion, et regarder l'email sur un téléphone en thème sombre et dans Gmail.

Le blason vient de `https://lsno-alumni.vercel.app/img/logo-email.png` : ne pas renommer ce fichier.
Les modèles « Invite user » et « Reauthentication » ne sont pas utilisés par le site.
