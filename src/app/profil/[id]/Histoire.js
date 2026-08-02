"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import TexteReplie from "@/components/TexteReplie";

// Récit replié par défaut pour ne pas noyer le profil sur mobile.
//
// Le repli était fait dans le TEXTE (couper à 200 caractères ou 4 lignes) ; il
// se fait désormais à l'affichage, par TexteReplie. Trois raisons :
//  ① les « 4 lignes » comptées étaient les retours à la ligne TAPÉS par
//    l'auteur — un récit écrit d'un seul bloc n'en a aucun, et ses 200
//    caractères s'étalaient sur cinq ou six lignes à 340 px ;
//  ② le texte coupé n'existait pas dans la page : la recherche du navigateur ne
//    le trouvait pas, un lecteur d'écran ne le lisait pas, et le copier donnait
//    la version tronquée ;
//  ③ couper au dernier espace pour ne pas trancher un mot, le navigateur le
//    fait seul.
//
// ⚠ Le récit garde `white-space: pre-line` (les retours à la ligne de l'auteur
// sont conservés) : vérifié, le repli CSS s'y applique correctement.

export default function Histoire({ prenom, texte }) {
  return (
    <section className="p-bloc p-histoire">
      <h4>Mon histoire</h4>
      <TexteReplie
        lignes={4}
        className="recit"
        plus={<>Lire l&apos;histoire de {prenom} <ChevronDown size={12} aria-hidden /></>}
        moins={<>Réduire <ChevronUp size={12} aria-hidden /></>}
      >
        {texte}
      </TexteReplie>
    </section>
  );
}
