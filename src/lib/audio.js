"use client";

// Un vocal lisible PARTOUT.
//
// Chaque navigateur enregistre dans son propre format (webm/opus pour Chrome
// et Samsung, ogg/opus pour Firefox, mp4/AAC pour Safari) et aucun n'est lu
// par tous les autres : le webm de Firefox est refusé par Chrome, l'ogg est
// inconnu de Safari… (03/10 : vocaux illisibles entre un Firefox Windows et un
// Android). Le seul format que tous lisent est le MP3. Alors, avant l'envoi,
// le téléphone qui a enregistré — et qui sait forcément relire son propre
// enregistrement — le décode et le réencode en MP3 (mono, 64 kbit/s : la voix
// n'a pas besoin de plus ; une minute ≈ 480 Ko). L'encodeur (lamejs) n'est
// chargé qu'à ce moment-là. L'encodage est découpé pour ne pas figer l'écran.
// Si quoi que ce soit échoue, l'appelant envoie l'enregistrement tel quel.
const KBPS = 64;
const PAS = 1152 * 20;   // échantillons encodés d'une traite avant de rendre la main

export async function versMp3(blob) {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) throw new Error("pas de Web Audio");
  const [{ default: lame }, brut] = await Promise.all([import("@breezystack/lamejs"), blob.arrayBuffer()]);
  const Mp3Encoder = lame?.Mp3Encoder ?? lame;
  const ctx = new Ctx();
  let tampon;
  try {
    tampon = await new Promise((ok, ko) => { const p = ctx.decodeAudioData(brut, ok, ko); if (p?.then) p.then(ok, ko); });
  } finally { ctx.close?.().catch?.(() => {}); }
  // mono : moyenne des canaux, en entiers 16 bits
  const n = tampon.length;
  const pcm = new Int16Array(n);
  const canaux = Array.from({ length: tampon.numberOfChannels }, (_, i) => tampon.getChannelData(i));
  for (let i = 0; i < n; i++) {
    let v = 0;
    for (const c of canaux) v += c[i];
    v /= canaux.length;
    pcm[i] = v < 0 ? Math.max(-32768, Math.round(v * 32768)) : Math.min(32767, Math.round(v * 32767));
  }
  const enc = new Mp3Encoder(1, tampon.sampleRate, KBPS);
  const morceaux = [];
  for (let i = 0; i < n; i += PAS) {
    const b = enc.encodeBuffer(pcm.subarray(i, Math.min(n, i + PAS)));
    if (b.length) morceaux.push(b);
    await new Promise((r) => setTimeout(r, 0));   // on rend la main à l'écran
  }
  const fin = enc.flush();
  if (fin.length) morceaux.push(fin);
  const fichier = new File(morceaux, "vocal.mp3", { type: "audio/mpeg" });
  return { fichier, duree: Math.max(1, Math.round(tampon.duration)) };
}
