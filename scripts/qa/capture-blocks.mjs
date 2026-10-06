#!/usr/bin/env node
/* Harnais QA visuel de la banque — capture CHAQUE bloc EN SITUATION.
 *
 * Reproduit la structure exacte du starter : un #meg-master-frame plein cadre
 * (rush réel, object-fit:cover) injecté avant le bloc, fond de scène noir.
 * Chaque bloc est capturé à 3 instants de sa timeline GSAP (entrée posée,
 * milieu, veille de sortie) + lint géométrique mécanique dans la page
 * (débordements du cadre, gouttières < 24 px entre écrans, bande visage).
 *
 * Usage :
 *   node scripts/qa/capture-blocks.mjs --out <dir> --rush <rush.mp4>
 *     [--only nom1,nom2] [--concurrency 6] [--playwright <module>]
 *
 * Gate QA (AGENTS.md) : aucun push de blocs sans relecture de ces captures.
 */

import { readdir, readFile, writeFile, unlink, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const BLOCKS_DIR = join(ROOT, "registry", "blocks");

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const OUT_DIR = resolve(opt("out", join(ROOT, ".qa-captures")));
const RUSH = resolve(opt("rush", ""));
const RUSH_YT = opt("rush-yt", "") ? resolve(opt("rush-yt", "")) : "";
const ONLY = opt("only", "") ? new Set(opt("only", "").split(",").filter(Boolean)) : null;
const CONCURRENCY = Number(opt("concurrency", "6"));
const PLAYWRIGHT = opt(
  "playwright",
  "/Users/elgheribi/Documents/portail-meg/node_modules/.pnpm/playwright@1.59.1/node_modules/playwright/index.js",
);

if (!RUSH) {
  console.error("--rush <fichier.mp4> obligatoire (rush master réel)");
  process.exit(1);
}

const require = createRequire(join(ROOT, "package.json"));
const { chromium } = require(PLAYWRIGHT);

const rushUrl = pathToFileURL(RUSH).href;
// Master 16:9 : en prod le rush d'un projet Large EST 16:9 — un rush vertical
// en cover dans un cadre 16:9 couperait le front sur TOUS les blocs (artefact
// de rig, pas de bloc). --rush-yt fournit le master horizontal synthétique.
const rushYtUrl = RUSH_YT ? pathToFileURL(RUSH_YT).href : rushUrl;

function masterMarkup(W, H) {
  const src = W > H ? rushYtUrl : rushUrl;
  return `<div id="meg-master-frame" style="position:absolute;left:0;top:0;width:${W}px;height:${H}px;overflow:hidden;z-index:1;background:#2f2c00"><video src="${src}" style="width:100%;height:100%;object-fit:cover" muted playsinline preload="auto"></video></div>`;
}

/* Lint géométrique exécuté DANS la page, à l'instant du milieu. */
const LINT_FN = `(() => {
  const root = document.querySelector('[data-composition-id]');
  if (!root) return { error: 'root introuvable' };
  const W = Number(root.dataset.width), H = Number(root.dataset.height);
  const out = { outOfBounds: [], gutters: [], master: null, face: null };
  const label = (el) => (el.className && String(el.className).trim()) || el.tagName.toLowerCase();
  for (const el of root.querySelectorAll('*')) {
    if (el.tagName === 'STYLE' || el.tagName === 'SCRIPT') continue;
    const cs = getComputedStyle(el);
    if (cs.position !== 'absolute' && cs.position !== 'fixed') continue;
    if (cs.display === 'none' || Number(cs.opacity) < 0.05) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) continue;
    const over = { left: r.left < -2, top: r.top < -2, right: r.right > W + 2, bottom: r.bottom > H + 2 };
    if ((over.left || over.right || over.top || over.bottom) && !el.closest('[data-qa-allow-bleed],[data-layout-allow-overflow]'))
      out.outOfBounds.push({ el: label(el), rect: [r.left, r.top, r.width, r.height].map(Math.round), over });
  }
  const ecrans = [...root.querySelectorAll('.ecran, .col, .rang, .carte-av, .panneau')]
    .filter((el) => getComputedStyle(el).display !== 'none')
    .map((el) => ({ el: label(el), elRef: el, r: el.getBoundingClientRect() }));
  for (let i = 0; i < ecrans.length; i++) for (let j = i + 1; j < ecrans.length; j++) {
    if (ecrans[i].elRef?.closest?.('[data-qa-allow-overlap]') || ecrans[j].elRef?.closest?.('[data-qa-allow-overlap]')) continue;
    const a = ecrans[i].r, b = ecrans[j].r;
    const gx = Math.max(a.left, b.left) - Math.min(a.right, b.right);
    const gy = Math.max(a.top, b.top) - Math.min(a.bottom, b.bottom);
    const overlapY = a.top < b.bottom && b.top < a.bottom, overlapX = a.left < b.right && b.left < a.right;
    if (overlapY && gx >= 0 && gx < 24) out.gutters.push({ a: ecrans[i].el, b: ecrans[j].el, axe: 'x', gap: Math.round(gx) });
    else if (overlapX && gy >= 0 && gy < 24) out.gutters.push({ a: ecrans[i].el, b: ecrans[j].el, axe: 'y', gap: Math.round(gy) });
    else if (gx < 0 && gy < 0) out.gutters.push({ a: ecrans[i].el, b: ecrans[j].el, axe: 'chevauchement', gap: Math.round(Math.max(gx, gy)) });
  }
  const master = document.getElementById('meg-master-frame');
  if (master) {
    const r = master.getBoundingClientRect();
    out.master = { rect: [r.left, r.top, r.width, r.height].map(Math.round), visible: getComputedStyle(master).opacity !== '0' };
  }
  if (root.dataset.faceH) out.face = { x: +root.dataset.faceX, y: +root.dataset.faceY, w: +root.dataset.faceW, h: +root.dataset.faceH, mode: root.dataset.faceMode };
  return out;
})()`;

async function captureBlock(page, name, report) {
  const dir = join(BLOCKS_DIR, name);
  const htmlPath = join(dir, `${name}.html`);
  const source = await readFile(htmlPath, "utf8");
  const W = Number(source.match(/data-width="(\d+)"/)?.[1] ?? 1080);
  const H = Number(source.match(/data-height="(\d+)"/)?.[1] ?? 1920);
  const dur = Number(source.match(/data-duration="([\d.]+)"/)?.[1] ?? 6);
  const compId = source.match(/data-composition-id="([^"]+)"/)?.[1] ?? null;

  const gsapUrl = pathToFileURL(join(ROOT, "scripts", "qa", "gsap.min.js")).href;
  const wrapped = source
    .replace(/<body>/i, `<body>\n${masterMarkup(W, H)}`)
    .replace(/<\/head>/i, `<style>body{background:#000}</style></head>`)
    .replace(/src="https:[^"]*gsap[^"]*"/i, `src="${gsapUrl}"`);
  const qaPath = join(dir, `.qa-${name}.html`);
  await writeFile(qaPath, wrapped);

  const entry = { name, W, H, dur, compId, shots: [], lint: null, warnings: [] };
  const onError = (err) => entry.warnings.push(`js: ${String(err).split("\n")[0]}`);
  page.on("pageerror", onError);
  try {
    await page.setViewportSize({ width: W, height: H });
    await page.goto(pathToFileURL(qaPath).href, { waitUntil: "load", timeout: 30_000 });

    /* Poll explicite : waitForFunction (rAF) est throttlé sur les pages
       parallèles headless et rate des timelines pourtant présentes. */
    let hasTl = false;
    for (let i = 0; i < 40 && !hasTl; i++) {
      hasTl = await page.evaluate(
        (id) => !!(window.__timelines && (id ? window.__timelines[id] : Object.keys(window.__timelines).length)),
        compId,
      );
      if (!hasTl) await page.waitForTimeout(200);
    }
    if (!hasTl) entry.warnings.push("timeline GSAP introuvable — capture statique");

    await page
      .evaluate(async () => {
        const v = document.querySelector("#meg-master-frame video");
        if (!v) return;
        await new Promise((done) => {
          if (v.readyState >= 2) done();
          else v.addEventListener("loadeddata", done, { once: true });
          setTimeout(done, 5_000);
        });
        v.currentTime = 2.0;
        await new Promise((done) => {
          v.addEventListener("seeked", done, { once: true });
          setTimeout(done, 3_000);
        });
        v.pause();
      })
      .catch(() => entry.warnings.push("rush non chargé"));

    const instants = hasTl ? [0.55, dur * 0.5, Math.max(0.6, dur - 0.25)] : [0];
    for (let i = 0; i < instants.length; i++) {
      const t = instants[i];
      if (hasTl)
        await page.evaluate(
          ([id, at]) => {
            const tl = window.__timelines[id] ?? Object.values(window.__timelines)[0];
            // suppressEvents=false comme le runtime HyperFrames : les onUpdate (compteurs) s'exécutent.
            tl.pause().seek(at, false);
          },
          [compId, t],
        );
      await page.waitForTimeout(120);
      const shot = join(OUT_DIR, `${name}-t${i + 1}.png`);
      await page.screenshot({ path: shot, clip: { x: 0, y: 0, width: W, height: H }, scale: "css" });
      entry.shots.push({ t: Number(t.toFixed(2)), file: `${name}-t${i + 1}.png` });
      if (i === 1 || instants.length === 1) entry.lint = await page.evaluate(LINT_FN);
    }
  } catch (error) {
    entry.warnings.push(`échec capture : ${error.message.split("\n")[0]}`);
  } finally {
    page.off("pageerror", onError);
    await unlink(qaPath).catch(() => {});
  }
  report.push(entry);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const names = (await readdir(BLOCKS_DIR, { withFileTypes: true }))
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((n) => !ONLY || ONLY.has(n))
    .sort();

  const browser = await chromium.launch({
    channel: "chrome",
    args: ["--allow-file-access-from-files", "--autoplay-policy=no-user-gesture-required"],
  });
  const report = [];
  const queue = [...names];
  const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
    const page = await browser.newPage();
    while (queue.length) {
      const name = queue.shift();
      await captureBlock(page, name, report);
      if (report.length % 20 === 0) console.error(`… ${report.length}/${names.length}`);
    }
    await page.close();
  });
  await Promise.all(workers);
  await browser.close();

  report.sort((a, b) => a.name.localeCompare(b.name));
  await writeFile(join(OUT_DIR, "geometry-lint.json"), JSON.stringify(report, null, 1));
  const flagged = report.filter(
    (e) => e.warnings.length || e.lint?.outOfBounds?.length || e.lint?.gutters?.length,
  );
  console.log(
    JSON.stringify({
      blocs: report.length,
      captures: report.reduce((n, e) => n + e.shots.length, 0),
      signales: flagged.length,
      details: flagged.map((e) => ({
        name: e.name,
        warnings: e.warnings,
        outOfBounds: e.lint?.outOfBounds?.length ?? 0,
        gutters: e.lint?.gutters ?? [],
      })),
    }),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
