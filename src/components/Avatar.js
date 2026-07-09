export default function Avatar({ profil, className = "" }) {
  if (profil.photo) {
    return <img src={profil.photo} alt="" className={className} />;
  }
  const initiales = (profil.prenom[0] + (profil.nom[0] || "")).toUpperCase();
  return <span className={`avatar-init ${className}`}>{initiales}</span>;
}
