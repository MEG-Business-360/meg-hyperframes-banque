#!/usr/bin/env node
// Publie un layout local dans la banque Git : fichier + manifeste + registre.
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const ROOT = resolve(new URL("..", import.meta.url).pathname);
const BLOCKS = join(ROOT, "registry", "blocks");

function args(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (key.startsWith("--")) out[key.slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
  }
  return out;
}

const a = args(process.argv.slice(2));
if (!a.file) {
  console.error("Usage: node scripts/publish-layout.mjs --file <layout.html> [--name <nom>] [--brand meg|dss] [--title \"...\"] [--desc \"...\"] [--target <chemin dans le projet>] [--tags a,b] [--push]");
  process.exit(2);
}

const src = resolve(a.file);
if (!existsSync(src)) {
  console.error("Fichier introuvable : " + src);
  process.exit(2);
}

const name = String(a.name || basename(src).replace(/\.html?$/i, "")).trim();
if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) {
  console.error("Nom invalide (kebab-case attendu) : " + name);
  process.exit(2);
}

const brand = String(a.brand || "").toLowerCase();
const extraTags = String(a.tags || "").split(",").map((t) => t.trim()).filter(Boolean);
const tags = [...new Set(["meg", ...(brand === "dss" ? ["dss"] : []), ...extraTags])];
const target = String(a.target || (brand === "dss" ? "templates-dss/" + name + ".html" : "compositions/" + name + ".html"));

const dir = join(BLOCKS, name);
await mkdir(dir, { recursive: true });
await copyFile(src, join(dir, name + ".html"));

const manifest = {
  $schema: "https://hyperframes.heygen.com/schema/registry-item.json",
  name,
  type: "hyperframes:block",
  title: String(a.title || name),
  description: String(a.desc || ""),
  tags,
  dimensions: { width: 1080, height: 1920 },
  duration: Number(a.duration || 15),
  files: [{ path: name + ".html", target, type: "hyperframes:composition" }],
};
await writeFile(join(dir, "registry-item.json"), JSON.stringify(manifest, null, 2) + "\n");

const registryPath = join(ROOT, "registry", "registry.json");
const registry = JSON.parse(await readFile(registryPath, "utf8"));
if (!registry.items.some((i) => i.name === name)) {
  registry.items.push({ name, type: "hyperframes:block" });
  await writeFile(registryPath, JSON.stringify(registry, null, 2) + "\n");
}

console.log(JSON.stringify({ published: name, brand: tags.includes("dss") ? "DSS" : "MEG", target, dir }, null, 2));

if (a.push) {
  await execFileAsync("git", ["add", "registry"], { cwd: ROOT });
  await execFileAsync("git", ["commit", "-m", "feat(registry): publie " + name], { cwd: ROOT });
  const { stdout } = await execFileAsync("git", ["push", "origin", "main"], { cwd: ROOT });
  console.log(stdout.trim());
}
