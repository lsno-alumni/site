"use client";

import { useEffect, useRef } from "react";
import { creerClientNavigateur } from "@/lib/supabase/client";

// Temps réel léger : on écoute les changements de quelques tables (migration
// 69 les publie) et on rappelle `surChangement` au plus une fois par 700 ms.
// `tables` : ["publications"] ou [{ table: "reponses", filtre: "question_id=eq.12" }].
// Le rappel reçoit le dernier événement ({ table, type, ligne }).
export default function useTempsReel(tables, surChangement, actif = true) {
  const rappel = useRef(surChangement);
  useEffect(() => { rappel.current = surChangement; });
  const cle = JSON.stringify(tables);
  useEffect(() => {
    if (!actif || !tables?.length) return;
    const supabase = creerClientNavigateur();
    let minuteur = null; let dernier = null;
    const canal = supabase.channel("tr-" + Math.random().toString(36).slice(2, 8));
    for (const t of tables) {
      const { table, filtre } = typeof t === "string" ? { table: t } : t;
      canal.on("postgres_changes", { event: "*", schema: "public", table, ...(filtre ? { filter: filtre } : {}) }, (p) => {
        dernier = { table, type: p.eventType, ligne: p.new ?? p.old };
        clearTimeout(minuteur);
        minuteur = setTimeout(() => { rappel.current?.(dernier); }, 700);
      });
    }
    canal.subscribe();
    return () => { clearTimeout(minuteur); supabase.removeChannel(canal); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle, actif]);
}
