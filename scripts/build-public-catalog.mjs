#!/usr/bin/env node
// Genere docs/catalog.json : un seul fichier pour la page publique (et le catalogue local).
// Chaque item porte sa MARQUE, son FORMAT (dimensions reelles) et son socle COMMUN.
import { readFile, stat, writeFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { formatDe, estCommun, FORMATS } from "./lib-format.mjs";

const ROOT = resolve(new URL("..", import.meta.url).pathname);
const BLOCKS = join(ROOT, "registry", "blocks");

const registry = JSON.parse(await readFile(join(ROOT, "registry", "registry.json"), "utf8"));
const names = registry.items.filter((i) => i.type === "hyperframes:block").map((i) => i.name);
const items = [];

for (const name of names) {
  let meta = {};
  try {
    meta = JSON.parse(await readFile(join(BLOCKS, name, "registry-item.json"), "utf8"));
  } catch {}
  let preview = null;
  for (const file of ["preview.jpg", "preview.png"]) {
    try { await stat(join(BLOCKS, name, file)); preview = file; break; } catch {}
  }
  const tags = meta.tags || [];
  const format = formatDe(meta);
  items.push({
    name,
    brand: tags.includes("dss") ? "DSS" : "MEG",
    commun: estCommun(meta),
    format: format.key,
    formatLabel: format.label,
    ratio: format.ratio,
    dimensions: { width: format.width, height: format.height },
    title: meta.title || name,
    description: meta.description || "",
    tags,
    duration: meta.duration || null,
    target: (meta.files || []).filter((f) => f.type === "hyperframes:composition").map((f) => f.target)[0] || null,
    preview: preview ? "registry/blocks/" + name + "/" + preview : null,
  });
}

items.sort((a, b) => (a.brand === b.brand ? a.name.localeCompare(b.name) : a.brand === "MEG" ? -1 : 1));
// Compteurs FORMAT d'abord, relus a chaque generation : la page publique fait
// choisir Mobile (9:16) ou YouTube (16:9), puis affiche Commun, MEG, DSS.
const cles = [
  ...FORMATS.map((f) => f.key),
  ...[...new Set(items.map((i) => i.format))].filter((k) => !FORMATS.some((f) => f.key === k)).sort(),
];
const formats = cles.map((cle) => {
  const lot = items.filter((i) => i.format === cle);
  const compte = (garde) => lot.filter(garde).length;
  return {
    key: cle,
    label: lot[0]?.formatLabel || cle,
    count: lot.length,
    sections: {
      commun: compte((i) => i.commun),
      meg: compte((i) => i.brand === "MEG"),
      dss: compte((i) => i.brand === "DSS"),
    },
  };
});
const sommeMarques = formats.reduce((n, f) => n + f.sections.meg + f.sections.dss, 0);

await mkdir(join(ROOT, "docs"), { recursive: true });
const payload = { generatedAt: new Date().toISOString(), count: items.length, formats, items };
await writeFile(join(ROOT, "docs", "catalog.json"), JSON.stringify(payload, null, 2) + "\n");

console.log(JSON.stringify({
  items: items.length,
  commun: items.filter((i) => i.commun).length,
  meg: items.filter((i) => i.brand === "MEG").length,
  dss: items.filter((i) => i.brand === "DSS").length,
  formats: formats.map((f) => f.label + " : " + f.count + " (Commun " + f.sections.commun + " · MEG " + f.sections.meg + " · DSS " + f.sections.dss + ")"),
  controle: "somme des marques par format = " + sommeMarques + " / " + items.length,
}, null, 2));
