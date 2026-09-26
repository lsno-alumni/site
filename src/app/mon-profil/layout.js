// « Voir mon profil comme les autres le voient » ouvre la feuille glissante
// (slot parallèle @modal) par-dessus le formulaire — on revient dessus en la
// fermant, sans rien perdre de ce qu'on tapait.
export default function LayoutMonProfil({ children, modal }) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}
