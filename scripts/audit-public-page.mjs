#!/usr/bin/env node
// Audit machine de la page publique (docs/index.html + docs/catalog.json).
//
// Il ne rejoue pas une copie des regles : il extrait le coeur de classement de
// la page elle-meme (bloc AUDIT-CORE) et le relance sur le catalogue. Il verifie
// la partition stricte : chaque bloc est affiche une seule fois, dans la seule
// section de sa marque pour le format choisi.
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
if (Array.isArray(catalogue.formats)) {
  const juste = catalogue.formats.every((f) => f.sections.commun + f.sections.meg + f.sections.dss === f.count);
  const somme = catalogue.formats.reduce((n, f) => n + f.count, 0);
  verifie("catalog.json : sections (Commun + MEG + DSS) = total du format", juste && somme === items.length,
    catalogue.formats.map((f) => f.key + " " + f.sections.commun + "+" + f.sections.meg + "+" + f.sections.dss + "=" + f.count).join(" · "));
}

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

// 4. Partition par format : Commun + MEG + DSS, chaque bloc une seule fois.
const nomsPage = [];
for (const f of formats) {
  const plan = planDe(items, f.key, "");
  const parCle = Object.fromEntries(plan.sections.map((s) => [s.key, s]));
  const sections = [parCle.COMMUN, parCle.MEG, parCle.DSS];
  const vus = sections.flatMap((s) => s.items.map((i) => i.name));
  const doublons = vus.filter((n, i) => vus.indexOf(n) !== i);
  const attendus = items.filter((i) => i.format === f.key).map((i) => i.name).sort();
  const communs = items.filter((i) => i.format === f.key && i.commun).length;
  const propres = items.filter((i) => i.format === f.key && !i.commun).length;
  const somme = parCle.COMMUN.count + parCle.MEG.count + parCle.DSS.count;
  nomsPage.push(...vus);

  verifie("format " + f.key + " — partition Commun + MEG + DSS = total du format", somme === plan.duFormat,
    parCle.COMMUN.count + " + " + parCle.MEG.count + " + " + parCle.DSS.count + " = " + somme + " / " + plan.duFormat);
  verifie("format " + f.key + " — anti-doublon : aucune carte en double", doublons.length === 0 && new Set(vus).size === vus.length,
    vus.length + " cartes / " + new Set(vus).size + " noms uniques" + (doublons.length ? " — doublons " + [...new Set(doublons)].join(", ") : ""));
  verifie("format " + f.key + " — aucun bloc oublie", JSON.stringify([...vus].sort()) === JSON.stringify(attendus), attendus.length + " attendus / " + vus.length + " affiches");
  verifie("format " + f.key + " — Commun = blocs communs du format", parCle.COMMUN.count === communs, parCle.COMMUN.count + " / " + communs);
  verifie("format " + f.key + " — MEG + DSS = blocs non communs du format", parCle.MEG.count + parCle.DSS.count === propres,
    parCle.MEG.count + " + " + parCle.DSS.count + " = " + (parCle.MEG.count + parCle.DSS.count) + " / " + propres);
  verifie("format " + f.key + " — aucun bloc commun dans MEG ni dans DSS",
    parCle.MEG.items.every((i) => !i.commun) && parCle.DSS.items.every((i) => !i.commun),
    parCle.MEG.items.filter((i) => i.commun).length + parCle.DSS.items.filter((i) => i.commun).length + " commun(s) egare(s)");
  info(f.label + " — Commun " + parCle.COMMUN.count + " · MEG " + parCle.MEG.count + " · DSS " + parCle.DSS.count, "= " + somme + " blocs");
}

// 5. Anti-doublon global : tout le catalogue, tous formats confondus.
const doublonsPage = nomsPage.filter((n, i) => nomsPage.indexOf(n) !== i);
verifie("anti-doublon — total page : 280 cartes, 280 noms uniques", nomsPage.length === 280 && new Set(nomsPage).size === 280 && doublonsPage.length === 0,
  nomsPage.length + " cartes / " + new Set(nomsPage).size + " noms uniques" + (doublonsPage.length ? " — doublons " + [...new Set(doublonsPage)].join(", ") : ""));
verifie("anti-doublon — chaque nom du catalogue est affiche exactement une fois",
  JSON.stringify([...nomsPage].sort()) === JSON.stringify(items.map((i) => i.name).sort()), new Set(nomsPage).size + " / " + items.length);

// 6. La recherche reste dans le filtre actif et ne perd rien.
for (const q of ["meg-face", "layout", "dss", "zzz-introuvable"]) {
  for (const f of formats) {
    const plan = planDe(items, f.key, q);
    const somme = plan.sections.reduce((n, s) => n + s.count, 0);
    verifie("recherche « " + q + " » en " + f.key + " — sections = resultats", somme === plan.trouves, somme + " / " + plan.trouves);
  }
}

// 7. La page elle-meme : ordre Format puis Marque, et rien de retire des cartes.
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
verifie("page : note de partition (un bloc n'apparait qu'une fois)", html.includes("un bloc n'apparaît qu'une fois") || html.includes("Un bloc n'apparaît qu'une fois"), "note .note-sec");
verifie("page : compteurs par section", html.includes("nb(s.count)") && html.includes("plan.duFormat"), "section + resume");

// 8. Compte rendu.
affiche();
process.exit(fails ? 1 : 0);
