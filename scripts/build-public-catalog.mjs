#!/usr/bin/env node
// Genere docs/catalog.json : un seul fichier pour la page publique (et le catalogue local).
// Chaque item porte sa MARQUE, son FORMAT (dimensions reelles) et son socle COMMUN.
import { readFile, stat, writeFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { formatDe, estCommun } from "./lib-format.mjs";

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
await mkdir(join(ROOT, "docs"), { recursive: true });
const payload = { generatedAt: new Date().toISOString(), count: items.length, items };
await writeFile(join(ROOT, "docs", "catalog.json"), JSON.stringify(payload, null, 2) + "\n");

// Compteurs par groupe, relus a chaque generation : la page affiche le socle
// COMMUN en tete (vue transversale) puis chaque marque, chaque fois par format.
const groupes = {};
const ajoute = (cle, n) => { groupes[cle] = (groupes[cle] || 0) + n; };
for (const forme of [...new Set(items.map((i) => i.formatLabel))]) {
  ajoute("Commun (MEG + DSS) / " + forme, items.filter((i) => i.commun && i.formatLabel === forme).length);
  ajoute("MEG / " + forme, items.filter((i) => i.brand === "MEG" && i.formatLabel === forme).length);
  ajoute("DSS Real Estate / " + forme, items.filter((i) => i.brand === "DSS" && i.formatLabel === forme).length);
}
console.log(JSON.stringify({
  items: items.length,
  commun: items.filter((i) => i.commun).length,
  meg: items.filter((i) => i.brand === "MEG").length,
  dss: items.filter((i) => i.brand === "DSS").length,
  groupes,
}, null, 2));
