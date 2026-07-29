// Abonnement de l'appareil aux notifications — logique partagée entre le
// réglage de Mon profil et l'invitation de l'accueil.
//
// ⚠ Le navigateur EXIGE une autorisation explicite de l'utilisateur : on ne
// peut pas activer les notifications d'office. On fait donc au plus près :
// auto-abonnement silencieux si l'autorisation existe déjà, sinon un geste.

// Refus EXPLICITE sur cet appareil. Indispensable : désactiver depuis l'appli ne
// révoque pas l'autorisation du navigateur — sans cette mémoire, l'auto-abonnement
// silencieux ci-dessous réactivait tout seul au rechargement suivant.
const CLE_REFUS = "lsno_push_refuse";
export const refusLocal = () => {
  try { return localStorage.getItem(CLE_REFUS) === "1"; } catch { return false; }
};
const noterRefus = (valeur) => {
  try { valeur ? localStorage.setItem(CLE_REFUS, "1") : localStorage.removeItem(CLE_REFUS); }
  catch { /* stockage indisponible */ }
};

export const pushDispo = () =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

const b64ToU8 = (base64) => {
  const p = "=".repeat((4 - (base64.length % 4)) % 4);
  const s = (base64 + p).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
};

// abonnement déjà en place sur cet appareil ?
export async function abonnementLocal() {
  if (!pushDispo()) return null;
  try {
    const sw = await navigator.serviceWorker.getRegistration("/sw.js");
    return (await sw?.pushManager.getSubscription()) ?? null;
  } catch {
    return null;
  }
}

// enregistre l'appareil (demande l'autorisation si besoin)
export async function abonner(supabase, profilId, { silencieux = false } = {}) {
  if (!pushDispo()) throw new Error("non pris en charge");
  // l'utilisateur a désactivé ici : on ne le contredit jamais en silence
  if (silencieux && refusLocal()) return false;
  if (Notification.permission !== "granted") {
    if (silencieux) return false;             // on ne demande rien sans geste
    const p = await Notification.requestPermission();
    if (p !== "granted") throw new Error("autorisation refusée");
  }
  if (!silencieux) noterRefus(false);         // geste volontaire : on oublie le refus
  const sw = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const abo = await sw.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: b64ToU8(process.env.NEXT_PUBLIC_VAPID_PUBLIC),
  });
  const j = abo.toJSON();
  const { error } = await supabase.from("push_abonnements").upsert({
    profil: profilId,
    endpoint: j.endpoint,
    p256dh: j.keys.p256dh,
    auth: j.keys.auth,
    appareil: navigator.userAgent.slice(0, 120),
  }, { onConflict: "endpoint" });
  if (error) throw error;
  return true;
}

export async function desabonner(supabase) {
  noterRefus(true);   // mémorise le choix, sinon il serait réactivé au rechargement
  const abo = await abonnementLocal();
  if (abo) {
    await supabase.from("push_abonnements").delete().eq("endpoint", abo.endpoint);
    await abo.unsubscribe();
  }
}
