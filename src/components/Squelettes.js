// Silhouettes de chargement (skeleton loading) — formes fantômes des
// vraies cartes, avec le reflet animé défini dans ecrans.css (.sk).

export function SqueletteFiche() {
  return (
    <div className="fiche" style={{ pointerEvents: "none" }} aria-hidden>
      <div className="haut">
        <span className="sk sk-rond" />
        <div style={{ flex: 1, display: "grid", gap: 8 }}>
          <span className="sk sk-ligne" style={{ width: "55%" }} />
          <span className="sk sk-ligne" style={{ width: "80%", height: 10 }} />
        </div>
      </div>
      <div className="pied">
        <span className="sk sk-ligne" style={{ width: "60%", height: 10 }} />
      </div>
    </div>
  );
}

export function SqueletteOffre() {
  return (
    <div className="fiche" style={{ pointerEvents: "none" }} aria-hidden>
      <div style={{ padding: "15px 16px 12px", display: "grid", gap: 9 }}>
        <div style={{ display: "flex", gap: 7 }}>
          <span className="sk" style={{ width: 62, height: 22, borderRadius: 100 }} />
          <span className="sk" style={{ width: 84, height: 22, borderRadius: 100 }} />
        </div>
        <span className="sk sk-ligne" style={{ width: "85%", height: 14 }} />
        <span className="sk sk-ligne" style={{ width: "100%", height: 10 }} />
        <span className="sk sk-ligne" style={{ width: "70%", height: 10 }} />
      </div>
      <div className="pied" style={{ gap: 9 }}>
        <span className="sk" style={{ width: 34, height: 34, borderRadius: 12 }} />
        <span className="sk sk-ligne" style={{ width: "40%", height: 10 }} />
      </div>
    </div>
  );
}

export function SqueletteEnTeteListe({ avecRecherche = true }) {
  return (
    <header className="n-tete" aria-hidden>
      <span className="sk sk-ligne" style={{ width: 170, height: 24, display: "block" }} />
      <span className="sk sk-ligne" style={{ width: 90, height: 10, display: "block", marginTop: 10 }} />
      {avecRecherche && (
        <span className="sk" style={{ display: "block", height: 48, borderRadius: 16, marginTop: 16 }} />
      )}
    </header>
  );
}

export function SqueletteProfil() {
  return (
    <div aria-hidden>
      <div className="sk" style={{ height: 150, borderRadius: 0 }} />
      <div className="p-corps">
        <span className="sk" style={{ display: "block", width: 92, height: 92, borderRadius: 32 }} />
        <span className="sk sk-ligne" style={{ display: "block", width: "50%", height: 20, marginTop: 16 }} />
        <span className="sk sk-ligne" style={{ display: "block", width: "70%", marginTop: 10 }} />
        <div style={{ display: "flex", gap: 7, marginTop: 16 }}>
          <span className="sk" style={{ width: 110, height: 26, borderRadius: 100 }} />
          <span className="sk" style={{ width: 90, height: 26, borderRadius: 100 }} />
        </div>
      </div>
      <div className="p-bloc" style={{ display: "grid", gap: 14 }}>
        <span className="sk sk-ligne" style={{ width: 90, height: 10 }} />
        <span className="sk sk-ligne" style={{ width: "85%" }} />
        <span className="sk sk-ligne" style={{ width: "75%" }} />
        <span className="sk sk-ligne" style={{ width: "80%" }} />
      </div>
    </div>
  );
}

export function SqueletteFormulaire() {
  return (
    <div className="f-corps" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ display: "grid", gap: 9 }}>
          <span className="sk sk-ligne" style={{ width: 120, height: 10 }} />
          <span className="sk" style={{ height: 50, borderRadius: 16 }} />
        </div>
      ))}
    </div>
  );
}
