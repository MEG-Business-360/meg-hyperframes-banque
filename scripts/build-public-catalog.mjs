#!/usr/bin/env node
// Genere docs/catalog.json : un seul fichier pour la page publique (et le catalogue local).
import { readFile, readdir, stat, writeFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";

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
  items.push({
    name,
    brand: tags.includes("dss") ? "DSS" : "MEG",
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
console.log(JSON.stringify({ items: items.length, meg: items.filter((i) => i.brand === "MEG").length, dss: items.filter((i) => i.brand === "DSS").length }));
