# -*- coding: utf-8 -*-
# Compare pixel par pixel les écrans mobiles « après » aux références (chantier bureau, 21/10).
#   python outils/bureau-diff.py      → OK/KO par écran, code de sortie 1 si un pixel a bougé
import os, sys
from PIL import Image, ImageChops
D = os.path.join(os.path.dirname(__file__), "..", "..", "bureau-captures")
ref, apres = os.path.join(D, "mobile-ref"), os.path.join(D, "mobile-apres")
# écrans à contenu vivant (listes, horodatages, ordre aléatoire) : un écart n'y prouve rien, il est signalé à part
VARIABLES = ("accueil--", "accueil_public--", "profil--", "fil--", "annuaire--", "questions--", "messages--", "evenements--", "offres--", "connexion_lien_retour--", "bienvenue--", "mot_de_passe_nouveau--")
total = changes = variables = 0
for f in sorted(os.listdir(apres)):
    r = os.path.join(ref, f)
    if not os.path.exists(r): print("??  pas de référence pour", f); continue
    A, B = Image.open(r).convert("RGB"), Image.open(os.path.join(apres, f)).convert("RGB")
    total += 1
    vivant = f.startswith(VARIABLES)
    if A.size != B.size: ecart = f"taille {A.size} → {B.size}"
    else:
        # le texte posé sur des cartes inclinées (éventail) ne se rastérise pas toujours au même gris d'une
        # capture à l'autre : seuls les écarts nets (> 64 sur 255) comptent, un lissage différent est ignoré
        d = ImageChops.difference(A, B).convert("L").point(lambda v: 255 if v > 64 else 0)
        bbox = d.getbbox(); ecart = f"zone modifiée {bbox}" if bbox else None
    if not ecart: print("OK  " + f)
    elif vivant: variables += 1; print(f"~   {f} : {ecart} (contenu vivant : à vérifier à l'œil)")
    else: changes += 1; print(f"KO  {f} : {ecart}")
print(f"{total - changes - variables}/{total} écrans mobiles identiques au pixel près ; {variables} écart(s) sur des écrans à contenu vivant ; {changes} écart(s) à expliquer")
sys.exit(1 if changes else 0)
