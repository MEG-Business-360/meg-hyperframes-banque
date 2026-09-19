#!/usr/bin/env node
// Audit machine de la page publique (docs/index.html + docs/catalog.json).
//
// Il ne rejoue pas une copie des regles : il extrait le coeur de classement de
// la page elle-meme (bloc AUDIT-CORE) et le relance sur le catalogue, puis
// verifie qu'aucun bloc ne disparait, ne se duplique ou ne change de format.
//
//   node scripts/audit-public-page.mjs
//   node scripts/audit-public-page.mjs --url https://meg-business-360.github.io/meg-hyperframes-banque/docs/
//
// Code retour 1 des le premier FAIL.
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import vm from "node:vm";

const ROOT = resolve(new URL("..", import.meta.url).pathname);
const argUrl = process.argv.includes("--url") ? process.argv[process.argv.indexOf("--url") + 1] : null;
const source = argUrl ? argUrl.replace(/\/?$/, "/") : null;

const lignes = [];
let fails = 0;
const point = (statut, nom, mesure) => lignes.push({ statut, nom, mesure });
const verifie = (nom, ok, mesure) => {
  if (!ok) fails++;
  point(ok ? "PASS" : "FAIL", nom, mesure);
};
const info = (nom, mesure) => point("INFO", "   " + nom, mesure);
function affiche() {
  const largeur = Math.max(...lignes.map((l) => l.nom.length));
  console.log("AUDIT PAGE PUBLIQUE — " + (source || "fichiers locaux"));
  for (const l of lignes) console.log(l.statut.padEnd(5) + "| " + l.nom.padEnd(largeur) + " | " + l.mesure);
  const total = lignes.filter((l) => l.statut !== "INFO").length;
  console.log((total - fails) + "/" + total + " points PASS, " + fails + " FAIL");
}

async function lire(nom) {
  if (!source) return readFile(resolve(ROOT, nom), "utf8");
  const url = source + nom.split("/").pop();
  const reponse = await fetch(url, { cache: "no-store" });
  verifie("HTTP 200 — " + url, reponse.status === 200, "statut " + reponse.status);
  return reponse.text();
}

// 1. Le coeur de classement, recopie tel quel depuis la page.
const html = await lire("docs/index.html");
// Le marqueur ouvre un commentaire dans la page : on le rouvre pour relire le
// bloc tel quel, sans jamais recopier les regles dans ce script.
const brut = html.split("/* AUDIT-CORE-START")[1]?.split("/* AUDIT-CORE-END */")[0];
const coeur = brut ? "/*" + brut : null;
verifie("coeur de classement extrait de docs/index.html", Boolean(coeur), coeur ? coeur.length + " caracteres" : "marqueurs AUDIT-CORE absents");
const contexte = {};
let erreurCoeur = null;
try {
  vm.runInNewContext((coeur || "") + "\nglobalThis.__coeur = { formatsDe, planDe, MARQUES, FORMATS_CONNUS };", contexte);
} catch (error) {
  erreurCoeur = String(error && error.message ? error.message : error);
  verifie("coeur de classement executable", false, erreurCoeur);
}
const { formatsDe, planDe, MARQUES } = contexte.__coeur || {};

// 2. Les donnees relues a la source (page publiee ou fichiers locaux).
const catalogue = JSON.parse(await lire("docs/catalog.json"));
const registry = JSON.parse(await readFile(resolve(ROOT, "registry", "registry.json"), "utf8"));
const items = catalogue.items;
const blocsRegistry = registry.items.filter((i) => i.type === "hyperframes:block");

verifie("catalogue = registry (aucun bloc perdu a la generation)", items.length === blocsRegistry.length, items.length + " items / " + blocsRegistry.length + " blocs registry");
verifie("effectif de reference 280", items.length === 280, items.length + " blocs");
verifie("catalogue : noms uniques", new Set(items.map((i) => i.name)).size === items.length, new Set(items.map((i) => i.name)).size + " noms / " + items.length + " items");
verifie("catalogue : chaque bloc a un apercu", items.every((i) => i.preview), items.filter((i) => !i.preview).length + " sans apercu");

if (!formatsDe || !planDe) {
  point("FAIL", "coeur de classement indisponible — audit interrompu", erreurCoeur || "fonctions formatsDe / planDe absentes");
  fails++;
  affiche();
  process.exit(1);
}

// 3. Format d'abord : chaque bloc est atteignable par exactement un format.
const formats = formatsDe(items);
const totalFormats = formats.reduce((n, f) => n + f.count, 0);
verifie("chaque bloc appartient a un format propose par la page", totalFormats === items.length, totalFormats + " / " + items.length);
verifie("les deux formats connus ont leur bouton", formats.filter((f) => f.connu).length === 2, formats.filter((f) => f.connu).map((f) => f.key).join(", "));

// 4. Par format : sections de marque, doublons, oublis, socle commun.
const nomsVus = [];
for (const f of formats) {
  const plan = planDe(items, f.key, "");
  const sections = plan.sections.filter((s) => !s.commun);
  const somme = sections.reduce((n, s) => n + s.count, 0);
  const vus = sections.flatMap((s) => s.items.map((i) => i.name));
  const attendus = items.filter((i) => i.format === f.key).map((i) => i.name).sort();
  const communs = plan.sections.find((s) => s.commun);
  const attendusCommuns = items.filter((i) => i.format === f.key && i.commun).length;
  nomsVus.push(...vus);
  verifie("format " + f.key + " — sections de marque = blocs du format", somme === plan.duFormat, somme + " / " + plan.duFormat);
  verifie("format " + f.key + " — aucun doublon de bloc", new Set(vus).size === vus.length, vus.length + " lignes / " + new Set(vus).size + " noms");
  verifie("format " + f.key + " — aucun bloc oublie", JSON.stringify([...vus].sort()) === JSON.stringify(attendus), attendus.length + " attendus / " + vus.length + " affiches");
  verifie("format " + f.key + " — section Commun = blocs communs du format", communs.count === attendusCommuns, communs.count + " / " + attendusCommuns);
  for (const s of sections) info(f.label + " — " + s.label + " : " + s.count + " bloc" + (s.count > 1 ? "s" : ""), s.count === 0 ? "aucun bloc pour ce format" : s.items.slice(0, 2).map((i) => i.name).join(", ") + (s.count > 2 ? ", …" : ""));
}
verifie("aucun bloc partage entre deux formats", new Set(nomsVus).size === nomsVus.length, nomsVus.length + " noms / " + new Set(nomsVus).size + " uniques");
verifie("somme des marques et des formats = 280", nomsVus.length === items.length && nomsVus.length === 280, nomsVus.length + " / 280");

// 5. La recherche reste dans le filtre actif et ne perd rien.
for (const q of ["meg-face", "layout", "dss", "zzz-introuvable"]) {
  for (const f of formats) {
    const plan = planDe(items, f.key, q);
    const somme = plan.sections.filter((s) => !s.commun).reduce((n, s) => n + s.count, 0);
    verifie("recherche « " + q + " » en " + f.key + " — sections = resultats", somme === plan.trouves, somme + " / " + plan.trouves);
  }
}

// 6. La page elle-meme : ordre Format puis Marque, et rien de retire des cartes.
const avant = html.indexOf("1 · Format");
const apres = html.indexOf("2 · Marque");
verifie("page : le Format est demande avant la Marque", avant > -1 && apres > avant, "Format@" + avant + " < Marque@" + apres);
verifie("page : sections dans l'ordre Commun, MEG, DSS", MARQUES.map((m) => m.key).join(",") === "COMMUN,MEG,DSS", MARQUES.map((m) => m.titre).join(" → "));
verifie("page : rendu branche sur le coeur teste", html.includes("planDe(items, formatActif, q)"), "planDe(items, formatActif, q)");
verifie("page : commande d'installation inchangee", html.includes('"npx hyperframes add " + it.name'), "npx hyperframes add <nom>");
verifie(
  "page : apercu, titre, description, tags et commande dans chaque carte",
  ["it.preview", "esc(it.title)", "esc(it.description)", "(it.tags || [])", "commande(it)"].every((m) => html.includes(m)),
  "5/5 elements presents"
);
verifie("page : mention discrete quand un format est vide", html.includes("vide-msg") && html.includes("Aucun bloc pour ce format."), "classe .vide-msg");
verifie("page : le socle commun dit qu'il est repris dans sa marque", html.includes("restent aussi listés dans leur marque"), "note .note-sec");
verifie("page : compteurs par section", html.includes("nb(s.count)") && html.includes("plan.duFormat"), "section + resume");

// 7. Compte rendu.
affiche();
process.exit(fails ? 1 : 0);
