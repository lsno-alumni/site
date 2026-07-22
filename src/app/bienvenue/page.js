"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MailCheck, Hourglass } from "lucide-react";
import { creerClientNavigateur } from "@/lib/supabase/client";

// Atterrissage du lien « Confirme ton email » : on célèbre, on explique
// la suite (validation par le délégué), on oriente vers le profil.
export default function Bienvenue() {
  const supabase = creerClientNavigateur();
  const [statut, setStatut] = useState(null); // null = on cherche encore

  useEffect(() => {
    // laisse au client le temps d'échanger le code du lien contre une session
    const t = setInterval(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      clearInterval(t);
      const { data } = await supabase
        .from("profiles").select("statut_compte, prenom").eq("id", session.user.id).maybeSingle();
      setStatut(data ?? { statut_compte: "en_attente" });
    }, 400);
    const fin = setTimeout(() => { clearInterval(t); setStatut((s) => s ?? { statut_compte: "inconnu" }); }, 6000);
    return () => { clearInterval(t); clearTimeout(fin); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const valide = statut?.statut_compte === "valide";

  return (
    <main className="page">
      <header className="f-tete" style={{ paddingTop: 20, paddingBottom: 20 }}>
        <h1 style={{ marginTop: 30 }}>Email confirmé,<br /><em>bienvenue !</em></h1>
      </header>

      <div className="succes" style={{ paddingTop: 30 }}>
        <div className="coche" aria-hidden><MailCheck size={30} strokeWidth={2} /></div>
        <h2>{statut?.prenom ? `C'est noté, ${statut.prenom} !` : "C'est noté !"}</h2>

        {valide ? (
          <>
            <p>Ton compte est déjà validé — l&apos;annuaire des anciens t&apos;attend.</p>
            <Link href="/annuaire" className="btn btn-or" style={{ marginTop: 20 }}>
              Découvrir l&apos;annuaire
            </Link>
          </>
        ) : (
          <>
            <p>
              Dernière étape : <b style={{ color: "var(--craie)" }}>un délégué de ta promotion</b> va
              confirmer que tu es bien des nôtres — en général sous 24 h.
              Tu recevras un email dès que c&apos;est fait.
            </p>
            <div className="f-note" style={{ margin: "22px 24px 0", textAlign: "left" }}>
              <span className="ico" style={{ width: 34, height: 34, borderRadius: 11, display: "grid", placeItems: "center", background: "rgba(232,179,60,.12)", color: "var(--or-clair)", flexShrink: 0 }}>
                <Hourglass size={16} strokeWidth={1.8} aria-hidden />
              </span>
              <span>
                <b>En attendant, prends de l&apos;avance :</b> complète ton profil (photo, parcours…)
                — dès ta validation, les autres membres pourront te trouver.
              </span>
            </div>
            <Link href="/mon-profil" className="btn btn-or" style={{ marginTop: 22 }}>
              Compléter mon profil
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
