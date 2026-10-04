"use client";

import { creerClientNavigateur } from "@/lib/supabase/client";

// Fréquentation (migration 85) : un membre, un jour. L'appli le note une fois par
// jour et par appareil (repère local), en silence ; la base ignore les doublons
// et les comptes non validés. Rien d'autre n'est mesuré.
const CLE = "lsno-visite";
let dejaFait = null;   // deux barres d'onglets montées coup sur coup (connexion puis premier écran) : un seul appel
export async function noterVisiteDuJour() {
  if (typeof window === "undefined") return;
  const jour = new Date().toISOString().slice(0, 10);
  if (dejaFait === jour) return;
  dejaFait = jour;
  try { if (localStorage.getItem(CLE) === jour) return; } catch { /* stockage indisponible : on note quand même */ }
  try {
    const supabase = creerClientNavigateur();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { error } = await supabase.rpc("noter_visite");
    if (!error) { try { localStorage.setItem(CLE, jour); } catch { /* rien */ } }
  } catch { /* hors ligne, ou migration pas encore passée : on réessaiera à la prochaine ouverture */ }
}

export async function lireFrequentation() {
  const { data, error } = await creerClientNavigateur().rpc("admin_frequentation");
  if (error) throw error;
  return data;
}
