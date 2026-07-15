import { creerClientServeur } from "@/lib/supabase/server";

// ============================================================
// Lectures serveur (Server Components). La sécurité réelle est
// dans les règles RLS : ces requêtes ne renvoient que ce que le
// compte connecté a le droit de voir.
// ============================================================

function profilVersUI(p) {
  return {
    id: p.id,
    prenom: p.prenom,
    nom: p.nom,
    photo: p.photo_url,
    promotion: p.promotions?.numero ?? null,
    domaine: p.domaine,
    situation: p.situation,
    pays: p.pays,
    ville: p.ville,
    statut: p.statut_titre,
    conseil: p.conseil,
    repondAuxCadets: p.repond_cadets,
    role: p.role,
    contacts: {
      whatsapp: p.whatsapp_visi,
      linkedin: p.linkedin_visi,
      email: p.email_visi,
    },
    parcours: (p.parcours ?? [])
      // du présent vers le passé, quel que soit l'ordre de saisie :
      // « en cours » (annee_fin null) d'abord, puis années décroissantes
      .sort((a, b) =>
        (b.annee_fin ?? 9999) - (a.annee_fin ?? 9999) ||
        (b.annee_debut ?? 0) - (a.annee_debut ?? 0)
      )
      .map((e) => ({
        annees: e.annee_fin
          ? `${e.annee_debut} — ${e.annee_fin}`
          : `${e.annee_debut} — aujourd'hui`,
        titre: e.titre,
        detail: [e.etablissement, e.ville].filter(Boolean).join(", "),
        actuel: !e.annee_fin,
      })),
  };
}

const CHAMPS_PROFIL =
  "id, prenom, nom, photo_url, domaine, situation, statut_titre, conseil, repond_cadets, ville, pays, whatsapp_visi, email_visi, linkedin_visi, role, promotions(numero), parcours(titre, etablissement, ville, annee_debut, annee_fin, ordre)";

export async function listeMembres() {
  const supabase = await creerClientServeur();
  const { data, error } = await supabase
    .from("profiles")
    .select(CHAMPS_PROFIL)
    .eq("statut_compte", "valide")
    .order("prenom");
  if (error) {
    console.error("listeMembres:", error.message);
    return [];
  }
  return data.map(profilVersUI);
}

export async function lireProfil(id) {
  const supabase = await creerClientServeur();
  const { data, error } = await supabase
    .from("profiles")
    .select(CHAMPS_PROFIL)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("lireProfil:", error.message);
    return null;
  }
  return data ? profilVersUI(data) : null;
}

export async function statsPubliques() {
  const supabase = await creerClientServeur();
  const { data, error } = await supabase.rpc("stats_publiques");
  if (error || !data) {
    console.error("statsPubliques:", error?.message);
    return { anciens: 0, pays: 0, promotions: 9, parDomaine: {}, parPays: {}, parPromo: {} };
  }
  return {
    anciens: data.anciens,
    pays: data.pays,
    promotions: data.promotions,
    parDomaine: data.par_domaine ?? {},
    parPays: data.par_pays ?? {},
    parPromo: data.par_promo ?? {},
  };
}

export async function lireContacts(id) {
  // Valeurs filtrées PAR LA BASE selon la visibilité choisie par le membre :
  // une valeur « demande » ou « masqué » ne quitte jamais Postgres.
  const supabase = await creerClientServeur();
  const { data, error } = await supabase.rpc("contacts_de", { cible: id });
  if (error) {
    console.error("lireContacts:", error.message);
    return null;
  }
  return data;
}

export async function statutDemande(cibleId) {
  // Ma demande de mise en relation vers ce profil (null si aucune)
  const supabase = await creerClientServeur();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("demandes_contact")
    .select("statut")
    .eq("demandeur", user.id)
    .eq("cible", cibleId)
    .maybeSingle();
  return data?.statut ?? null;
}

export async function utilisateurCourant() {
  const supabase = await creerClientServeur();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id, prenom, nom, role, statut_compte, situation, whatsapp_visi, email_visi, linkedin_visi, promotions(numero)")
    .eq("id", user.id)
    .maybeSingle();
  return data;
}
