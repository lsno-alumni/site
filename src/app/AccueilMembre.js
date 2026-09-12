import Link from "next/link";
import { Hourglass, ArrowRight } from "lucide-react";
import TabBar from "@/components/TabBar";
import { RestaurerDefilement } from "@/components/SuiviNavigation";
import InviteNotifications from "@/components/InviteNotifications";
import { InviteInstallation } from "@/components/InstallerAppli";
import Avatar from "@/components/Avatar";
import Salutation from "@/components/Salutation";
import Reveal from "@/components/Reveal";
import TexteReplie from "@/components/TexteReplie";
import IconeDomaine from "@/components/IconeDomaine";
import Roue3D from "@/components/Roue3D";
import NuagePays from "@/components/NuagePays";
import { DOMAINES, nomDomaine, tauxCompletion } from "@/lib/donnees";

const TYPES_OFFRE = {
  stage: "Stage", emploi: "Emploi", bourse: "Bourse",
  cooptation: "Cooptation", concours: "Concours", autre: "Autre",
};

export default function AccueilMembre({ moi, donnees }) {
  const { nouveaux, offres, conseil, demandesEnAttente, parPromo, parPays, parDomaine } = donnees;
  const promos = Object.entries(parPromo ?? {})
    .map(([num, n]) => [Number(num), n])
    .filter(([, n]) => n > 0)
    .sort((a, b) => a[0] - b[0]);
  // aperçu compact des domaines représentés (la roue plus haut sert déjà à
  // les PARCOURIR un par un — ceci ne donne qu'un chiffre en un coup d'œil).
  // Tous s'affichent, aucun plafond — comme le nuage de pays.
  const domainesTries = Object.entries(parDomaine ?? {})
    .filter(([cle, n]) => cle !== "autre" && n > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  // complétion : même fonction que Mon profil (source de vérité unique)
  const completion = tauxCompletion(moi);

  return (
    <main className="page avec-tabbar">
      <header className="am-tete">
        <div className="a-marque" style={{ marginBottom: 26 }}>
          <img className="sceau" src="/img/logo.jpg" alt="Blason du LSNO" /> LSNO Amicale
        </div>
        <h1><Salutation prenom={moi.prenom} /></h1>
        <p className="am-sous">Que peut le réseau pour toi aujourd&apos;hui ?</p>

        {demandesEnAttente > 0 && (
          <Link href="/admin" className="am-alerte">
            <Hourglass size={15} strokeWidth={2} aria-hidden />
            {demandesEnAttente} demande{demandesEnAttente > 1 ? "s" : ""} attend{demandesEnAttente > 1 ? "ent" : ""} ta validation
            <ArrowRight size={14} aria-hidden style={{ marginLeft: "auto" }} />
          </Link>
        )}
        {completion < 100 && (
          <Link href="/mon-profil" className="am-rappel">
            Ton profil est à {completion} % — le compléter
          </Link>
        )}
      </header>

      <InviteNotifications profilId={moi.id} />
      <InviteInstallation />

      {nouveaux.length > 0 && (
        <Reveal>
        <section className="a-section">
          <h2 className="a-titre">Ils viennent d&apos;arriver</h2>
          <p className="a-sous">Tu peux consulter leurs profils.</p>
          <div className="am-nouveaux">
            {nouveaux.map((m) => (
              <Link key={m.id} href={`/profil/${m.id}`} className="am-nouveau">
                <Avatar profil={{ prenom: m.prenom, nom: m.nom, photo: m.photo_url }} className="am-nouveau-photo" />
                <b>{m.prenom}</b>
                <span className="am-nouveau-detail">P{m.promotions?.numero} · {nomDomaine(m.domaine, m.domaine_precision, true)}</span>
              </Link>
            ))}
          </div>
        </section>
        </Reveal>
      )}

      {offres.length > 0 && (
        <Reveal>
        <section className="a-section">
          <h2 className="a-titre" style={{ marginBottom: 12 }}>Dernières opportunités</h2>
          <div className="am-offres">
            {offres.map((o) => (
              <Link key={o.id} href={`/offres#o-${o.id}`} className="am-offre">
                <span className="meta doree" style={{ flexShrink: 0 }}>{TYPES_OFFRE[o.type]}</span>
                <span className="am-offre-titre">{o.titre}</span>
              </Link>
            ))}
          </div>
          <Link href="/offres" className="am-tout">Toutes les offres <ArrowRight size={13} aria-hidden /></Link>
        </section>
        </Reveal>
      )}

      {conseil && (
        <Reveal>
        <section className="a-temoin" style={{ marginTop: 26 }}>
          <TexteReplie lignes={4}>{conseil.conseil}</TexteReplie>
          <Link href={`/profil/${conseil.id}`} className="qui">
            <Avatar profil={{ prenom: conseil.prenom, nom: conseil.nom, photo: conseil.photo_url }} className="am-conseil-photo" />
            <div>
              <b>{conseil.prenom} {conseil.nom}</b>
              <span>Promotion {conseil.promotions?.numero} · voir son parcours</span>
            </div>
          </Link>
          <Link href="/conseils" className="am-tout" style={{ marginTop: 14, color: "var(--encre)", opacity: .75 }}>
            Tous les conseils par thème <ArrowRight size={13} aria-hidden />
          </Link>
        </section>
        </Reveal>
      )}

      <Reveal>
      <section className="a-section" style={{ paddingBottom: 30 }}>
        <h2 className="a-titre">Chercher par domaine</h2>
        <Roue3D memo="membre-domaines" classeCarteListe="dom"
          sousRoue="Fais tourner la roue, touche un domaine pour l'explorer."
          sousListe="Touche un domaine pour l'explorer." aria="Domaines — flèches haut et bas pour parcourir"
          items={DOMAINES.filter((d) => d.cle !== "autre").map((d) => ({
            cle: d.cle,
            href: `/annuaire?domaine=${d.cle}`,
            rendu: (
              <>
                <span className="pictol"><IconeDomaine domaine={d.cle} /></span>
                <span className="txt"><b>{d.nom}</b><span>{d.detail}</span></span>
                <span className="fl" aria-hidden>→</span>
              </>
            ),
          }))} />
      </section>
      </Reveal>

      {parPays && Object.keys(parPays).length > 0 && (
        <Reveal>
        <section className="a-section" style={{ paddingBottom: 30 }}>
          <h2 className="a-titre">Le réseau dans le monde</h2>
          <p className="a-sous">Touche un pays pour voir qui y est.</p>
          <NuagePays parPays={parPays} />
        </section>
        </Reveal>
      )}

      {domainesTries.length > 0 && (
        <Reveal>
        <section className="a-section" style={{ paddingBottom: 30 }}>
          <h2 className="a-titre">Qui fait quoi</h2>
          <p className="a-sous">Touche un domaine pour voir qui y est.</p>
          <div className="am-anneaux">
            {domainesTries.map(([cle, n]) => {
              const pct = Math.round((n / domainesTries[0][1]) * 100);
              return (
                <Link key={cle} href={`/annuaire?domaine=${cle}`} className="am-anneau-bloc">
                  <span className="am-anneau" style={{ background: `conic-gradient(#3B6FD1 ${pct * 3.6}deg, rgba(147,165,192,.18) ${pct * 3.6}deg)` }}>
                    <span className="am-anneau-int"><IconeDomaine domaine={cle} taille={18} /></span>
                  </span>
                  <b>{n}</b>
                  <span className="am-anneau-nom">{nomDomaine(cle)}</span>
                </Link>
              );
            })}
          </div>
        </section>
        </Reveal>
      )}

      {promos.length > 0 && (
        <Reveal>
        <section className="a-section" style={{ paddingBottom: 30 }}>
          <h2 className="a-titre">Le réseau par promotion</h2>
          <Roue3D memo="membre-promos"
            sousRoue="Fais tourner la roue, touche une promotion pour la parcourir."
            sousListe="Membres inscrits — touche une promotion pour la parcourir." axe="x" pitch={114} hauteur={100}
            classeCarte="am-promo" classeListe="am-promos"
            aria="Promotions — flèches gauche et droite pour parcourir"
            items={promos.map(([num, n]) => ({
              cle: `p${num}`,
              href: `/annuaire?promo=${num}`,
              rendu: (
                <>
                  <b>P{num}</b>
                  <span>{n} membre{n > 1 ? "s" : ""}</span>
                </>
              ),
            }))} />
        </section>
        </Reveal>
      )}

      <RestaurerDefilement />
      <TabBar />
    </main>
  );
}
