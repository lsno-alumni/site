// Garde-fou : un avatar ne dépasse jamais cette taille, même si la classe
// passée n'en fixe pas (a déjà causé deux photos affichées en pleine largeur).
const SECURITE = { maxWidth: 52, maxHeight: 52, objectFit: "cover", flexShrink: 0 };

export default function Avatar({ profil, className = "" }) {
  if (profil.photo) {
    return <img src={profil.photo} alt="" className={className} style={SECURITE} />;
  }
  const initiales = (profil.prenom[0] + (profil.nom[0] || "")).toUpperCase();
  return <span className={`avatar-init ${className}`} style={SECURITE}>{initiales}</span>;
}
