#!/usr/bin/env node
// Catalogue local de la banque HyperFrames MEG : sert la PAGE PUBLIQUE
// (docs/index.html) et son catalogue (docs/catalog.json), plus les fichiers du
// registre, avec un pull silencieux. Une seule page, un seul jeu de regles :
// marque x format (mobile / youtube), socle commun en tete.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { extname, join, normalize, resolve, sep } from "node:path";

const ROOT = resolve(new URL("..", import.meta.url).pathname);
const BLOCKS = join(ROOT, "registry", "blocks");
const PORT = Number(process.env.MEG_CATALOG_PORT || 3020);
const execFileAsync = promisify(execFile);
let lastPull = 0;

// La banque suit Git : un pull silencieux (max 1 fois par minute) garde la page
// a jour ; le catalogue est regenere dans la foulee si la registry a bouge.
async function syncFromGit() {
  if (Date.now() - lastPull < 60_000) return null;
  lastPull = Date.now();
  try {
    const { stdout } = await execFileAsync("git", ["pull", "--ff-only", "--quiet"], { cwd: ROOT, timeout: 20_000 });
    await execFileAsync("node", ["scripts/build-public-catalog.mjs"], { cwd: ROOT, timeout: 30_000 });
    return stdout.trim();
  } catch {
    return null;
  }
}

const MIME = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
  ".mp4": "video/mp4", ".webm": "video/webm", ".html": "text/html; charset=utf-8",
  ".css": "text/css", ".js": "text/javascript", ".woff2": "font/woff2",
  ".json": "application/json; charset=utf-8",
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  try {
    if (url.pathname === "/" || url.pathname === "/index.html") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
      res.end(await readFile(join(ROOT, "docs", "index.html")));
      return;
    }
    if (url.pathname === "/favicon.ico") { res.writeHead(204); res.end(); return; }

    const fichierStatique =
      url.pathname === "/catalog.json" ? join(ROOT, "docs", "catalog.json")
      : url.pathname.startsWith("/registry/") ? join(ROOT, normalize(url.pathname))
      // Compatibilite : l'ancienne page lisait les apercus via /media/<bloc>/<fichier>.
      : url.pathname.startsWith("/media/") ? join(BLOCKS, url.pathname.slice("/media/".length))
      : null;

    if (fichierStatique) {
      const sur = resolve(fichierStatique);
      if (!sur.startsWith(ROOT + sep)) { res.writeHead(400); res.end(); return; }
      await syncFromGit();
      await stat(sur);
      res.writeHead(200, { "content-type": MIME[extname(sur)] || "application/octet-stream", "cache-control": "no-store" });
      createReadStream(sur).pipe(res);
      return;
    }
    res.writeHead(404); res.end("not found");
  } catch (error) {
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    res.end(String(error && error.message ? error.message : error));
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("Catalogue banque MEG : http://localhost:" + PORT + "/");
});

