#!/usr/bin/env node
// Classification unique de la banque : FORMAT (dimensions réelles du manifeste)
// et socle COMMUN (tag « commun »). Aucune dimension inventée : un bloc hors
// 1080x1920 / 1920x1080 tombe dans le groupe de sa dimension réelle.
export const FORMATS = [
  { key: "mobile", ratio: "9:16", width: 1080, height: 1920, label: "Mobile (9:16 · 1080×1920)" },
  { key: "youtube", ratio: "16:9", width: 1920, height: 1080, label: "YouTube (16:9 · 1920×1080)" },
];

export function formatDe(manifest = {}) {
  const { width = 0, height = 0 } = manifest.dimensions ?? {};
  const connu = FORMATS.find((f) => f.width === width && f.height === height);
  if (connu) return { ...connu, width, height };
  if (!width && !height) return { key: "dim-inconnue", ratio: null, width, height, label: "dimension non déclarée" };
  return { key: "dim-" + width + "x" + height, ratio: null, width, height, label: width + " × " + height };
}

export function estCommun(manifest = {}) {
  return Array.isArray(manifest.tags) && manifest.tags.includes("commun");
}
