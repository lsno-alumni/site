import TabBar from "@/components/TabBar";
import { SqueletteEnTeteListe, SqueletteFiche } from "@/components/Squelettes";

export default function ChargementFil() {
  return (
    <main className="page avec-tabbar">
      <SqueletteEnTeteListe avecRecherche={false} />
      <div className="n-liste" style={{ paddingTop: 16, display: "grid", gap: 12 }} aria-hidden>
        <span className="sk" style={{ display: "block", height: 56, borderRadius: 100 }} />
        <div style={{ display: "flex", gap: 14, padding: "4px 0" }}>{[0, 1, 2, 3].map((i) => <span key={i} className="sk" style={{ width: 62, height: 62, borderRadius: "50%", flexShrink: 0 }} />)}</div>
        {[0, 1].map((i) => <SqueletteFiche key={i} />)}
      </div>
      <TabBar actif="Fil" />
    </main>
  );
}
