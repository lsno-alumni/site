# -*- coding: utf-8 -*-
# Compare pixel par pixel les écrans mobiles « après » aux références (chantier bureau, 21/10).
#   python outils/bureau-diff.py      → OK/KO par écran, code de sortie 1 si un pixel a bougé
import os, sys
from PIL import Image, ImageChops
D = os.path.join(os.path.dirname(__file__), "..", "..", "bureau-captures")
ref, apres = os.path.join(D, "mobile-ref"), os.path.join(D, "mobile-apres")
total = changes = 0
for f in sorted(os.listdir(apres)):
    r = os.path.join(ref, f)
    if not os.path.exists(r): print("??  pas de référence pour", f); continue
    A, B = Image.open(r).convert("RGB"), Image.open(os.path.join(apres, f)).convert("RGB")
    total += 1
    if A.size != B.size: changes += 1; print(f"KO  {f} : taille {A.size} → {B.size}"); continue
    bbox = ImageChops.difference(A, B).getbbox()
    if bbox: changes += 1; print(f"KO  {f} : zone modifiée {bbox}")
    else: print("OK  " + f)
print(f"{total - changes}/{total} écrans mobiles identiques au pixel près")
sys.exit(1 if changes else 0)
