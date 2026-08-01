"""Vérifie la SYNTAXE de tous les fichiers SQL du projet, hors ligne.

Pourquoi cet outil : le 01/08, trois migrations ont été livrées avec une erreur de
syntaxe découverte par l'utilisateur en production (bloc de valeurs orphelin,
guillemets déséquilibrés). « Relire mieux » n'est pas une méthode. pglast embarque
le vrai analyseur de PostgreSQL (libpg_query) : ce qu'il accepte, le serveur
l'accepte aussi.

Ce que l'outil NE fait PAS : il ne vérifie que la syntaxe, pas la sémantique. Une
table inexistante, une colonne mal nommée ou un ordre d'évaluation hasardeux
(has_sequence_privilege dans un WHERE…) passent au travers. Pour cela il faudra un
Postgres local — banc d'essai prévu, pas encore installé.

Usage :  python outils/verif_sql.py            (tous les fichiers)
         Lancé aussi automatiquement à chaque push (.github/workflows/sql.yml)
         python outils/verif_sql.py migration-41-alerte-admins.sql
"""
import glob
import pathlib
import sys

try:
    from pglast import parse_sql
    from pglast.parser import ParseError
except ImportError:
    sys.exit("Installer l'analyseur d'abord :  pip install pglast")

RACINE = pathlib.Path(__file__).resolve().parent.parent
DOSSIER = RACINE / "supabase"

cibles = sys.argv[1:] or sorted(
    p.name for p in DOSSIER.glob("*.sql")
)

soucis = 0
for nom in cibles:
    chemin = DOSSIER / nom
    if not chemin.exists():
        print(f"  ?  {nom} — introuvable")
        soucis += 1
        continue
    texte = chemin.read_text(encoding="utf-8")
    try:
        arbre = parse_sql(texte)
        print(f"  ok {nom} — {len(arbre)} instruction(s)")
    except ParseError as e:
        # pglast donne la position en octets : on la traduit en ligne/colonne
        pos = getattr(e, "location", None) or 0
        ligne = texte.count("\n", 0, pos) + 1
        debut = texte.rfind("\n", 0, pos) + 1
        print(f"  ÉCHEC {nom} — ligne {ligne} : {e}")
        print(f"        → {texte[debut:texte.find(chr(10), pos)].strip()[:100]}")
        soucis += 1

print()
print(f"{len(cibles)} fichier(s) analysé(s), {soucis} en échec.")
sys.exit(1 if soucis else 0)
