"use client";

// Une vidéo lisible PARTOUT ?
//
// On ne peut pas convertir une vidéo dans le navigateur, mais on peut lire
// son étiquette avant l'envoi et prévenir. Ce que tous les téléphones et
// navigateurs lisent : un MP4 (ou MOV) en H.264 avec son AAC — ce que produit
// Android, et l'iPhone réglé sur « Le plus compatible ». Ce qui ne passe pas
// partout : le HEVC (H.265) des iPhone réglés sur « Haute efficacité » (refusé
// par Firefox et bien des Android), l'AV1, et les conteneurs WebM/MKV (pas lus
// sur iPhone). On lit les en-têtes du fichier (les « boîtes » MP4 : moov →
// trak → mdia → minf → stbl → stsd) sans charger la vidéo entière.
const lireBoite = async (fichier, debut) => {
  const tete = new DataView(await fichier.slice(debut, debut + 16).arrayBuffer());
  if (tete.byteLength < 8) return null;
  let taille = tete.getUint32(0);
  const type = String.fromCharCode(tete.getUint8(4), tete.getUint8(5), tete.getUint8(6), tete.getUint8(7));
  let entete = 8;
  if (taille === 1) { taille = Number(tete.getBigUint64(8)); entete = 16; }
  else if (taille === 0) taille = fichier.size - debut;
  return { type, taille, entete };
};
const type4 = (v, o) => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));
// parcourt les boîtes d'un tampon mémoire, et récupère les types d'échantillons (stsd)
function stsd(vue, debut, fin, out) {
  let i = debut;
  while (i + 8 <= fin) {
    let taille = vue.getUint32(i); const type = type4(vue, i + 4); let entete = 8;
    if (taille === 1) { taille = Number(vue.getBigUint64(i + 8)); entete = 16; } else if (taille === 0) taille = fin - i;
    if (taille < 8) return;
    if (["moov", "trak", "mdia", "minf", "stbl"].includes(type)) stsd(vue, i + entete, Math.min(fin, i + taille), out);
    else if (type === "stsd") {
      const nb = vue.getUint32(i + entete + 4);
      let j = i + entete + 8;
      for (let k = 0; k < nb && j + 8 <= fin; k++) { const t = vue.getUint32(j); out.push(type4(vue, j + 4)); if (t < 8) break; j += t; }
    }
    i += taille;
  }
}

// → { conteneur: "mp4" | "webm" | "autre", codecs: ["avc1", "mp4a", …] }  (codecs vide si on n'a pas su lire)
export async function analyserVideo(fichier) {
  const debut = new Uint8Array(await fichier.slice(0, 12).arrayBuffer());
  if (debut[0] === 0x1a && debut[1] === 0x45 && debut[2] === 0xdf && debut[3] === 0xa3) return { conteneur: "webm", codecs: [] };
  const ftyp = String.fromCharCode(...debut.slice(4, 8));
  if (ftyp !== "ftyp" && ftyp !== "moov" && ftyp !== "mdat" && ftyp !== "wide" && ftyp !== "free") return { conteneur: "autre", codecs: [] };
  const codecs = [];
  let pos = 0, tours = 0;
  while (pos + 8 <= fichier.size && tours++ < 64) {
    const b = await lireBoite(fichier, pos);
    if (!b || b.taille < 8) break;
    if (b.type === "moov") {
      const vue = new DataView(await fichier.slice(pos + b.entete, pos + Math.min(b.taille, 8 * 1024 * 1024)).arrayBuffer());
      stsd(vue, 0, vue.byteLength, codecs);
      break;
    }
    pos += b.taille;
  }
  return { conteneur: "mp4", codecs };
}

const VIDEO_OK = new Set(["avc1", "avc3", "mp4v", "s263", "jpeg", "mjpa"]);
const AUDIO_OK = new Set(["mp4a", ".mp3", "mp3 ", "sowt", "twos", "lpcm", "ulaw", "alaw"]);
const VIDEO_HEVC = new Set(["hvc1", "hev1", "dvh1", "dvhe"]);

// null si la vidéo passera partout, sinon la phrase à montrer à l'envoyeur
export function verdictVideo(info) {
  if (!info) return null;
  if (info.conteneur === "webm") return "Cette vidéo est au format WebM, que les iPhone ne lisent pas. Choisis une vidéo MP4 (filmée avec le téléphone) ou exporte-la en MP4.";
  if (info.conteneur === "autre") return null;   // on ne sait pas : on laisse passer
  const hevc = info.codecs.find((c) => VIDEO_HEVC.has(c));
  if (hevc) return "Cette vidéo est en HEVC (H.265), que beaucoup de téléphones ne lisent pas. Sur iPhone : Réglages › Appareil photo › Formats › « Le plus compatible », puis refilme ou exporte la vidéo en H.264.";
  if (info.codecs.some((c) => c === "av01")) return "Cette vidéo est en AV1, que beaucoup de téléphones ne lisent pas encore. Exporte-la en MP4 H.264.";
  if (info.codecs.some((c) => c === "vp09" || c === "vp08")) return "Cette vidéo est en VP9, que les iPhone ne lisent pas. Exporte-la en MP4 H.264.";
  const inconnu = info.codecs.find((c) => !VIDEO_OK.has(c) && !AUDIO_OK.has(c) && !/^(enca|encv|tx3g|mp4s|rtp |text|sbtl|wvtt|c608|stpp)$/.test(c));
  if (inconnu) return `Cette vidéo utilise un codage (${inconnu.trim()}) que tous les téléphones ne lisent pas. Exporte-la en MP4 H.264.`;
  return null;
}
