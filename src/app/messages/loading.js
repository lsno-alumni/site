import TabBar from "@/components/TabBar";
import { SqueletteEnTeteListe, SqueletteFiche } from "@/components/Squelettes";

export default function ChargementMessages() {
  return (
    <main className="page avec-tabbar">
      <SqueletteEnTeteListe />
      <div className="n-liste" style={{ paddingTop: 16 }}>
        {[0, 1, 2, 3].map((i) => <SqueletteFiche key={i} />)}
      </div>
      <TabBar actif="Messages" />
    </main>
  );
}
