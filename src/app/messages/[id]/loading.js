// Une conversation qui s'ouvre : l'en-tête et la saisie sont là tout de suite,
// les bulles arrivent (de la mémoire d'onglet, puis du serveur).
export default function ChargementConversation() {
  return (
    <main className="page">
      <div className="msg-page" aria-hidden>
        <header className="msg-tete">
          <span className="sk" style={{ width: 36, height: 36, borderRadius: "50%", marginLeft: 6 }} />
          <span className="sk" style={{ width: 40, height: 40, borderRadius: "50%" }} />
          <span style={{ display: "grid", gap: 6, flex: 1 }}>
            <span className="sk sk-ligne" style={{ width: 140, height: 14 }} />
            <span className="sk sk-ligne" style={{ width: 70, height: 9 }} />
          </span>
        </header>
        <div style={{ flex: 1, padding: "16px 14px", display: "grid", gap: 10, alignContent: "end" }}>
          <span className="sk" style={{ width: "60%", height: 42, borderRadius: 16 }} />
          <span className="sk" style={{ width: "48%", height: 42, borderRadius: 16, justifySelf: "end" }} />
          <span className="sk" style={{ width: "70%", height: 42, borderRadius: 16 }} />
        </div>
        <div className="msg-saisie">
          <span className="sk" style={{ width: 44, height: 44, borderRadius: "50%", flexShrink: 0 }} />
          <span className="sk" style={{ flex: 1, height: 44, borderRadius: 20 }} />
          <span className="sk" style={{ width: 44, height: 44, borderRadius: "50%", flexShrink: 0 }} />
        </div>
      </div>
    </main>
  );
}
