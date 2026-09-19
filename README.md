# Banque universelle MEG HyperFrames

Source centrale des layouts MEG réutilisables dans toutes les timelines HyperFrames.

La structure suit la registry officielle HyperFrames : `registry/registry.json`, puis un manifeste et les fichiers de chaque bloc sous `registry/blocks/<nom>/`.

## Utilisation dans une timeline

Chaque projet pointe vers cette URL dans `hyperframes.json` :

```text
https://raw.githubusercontent.com/megbusiness360/meg-hyperframes-banque/main/registry
```

Pour synchroniser une ancienne ou une nouvelle timeline :

```bash
node scripts/sync-project.mjs /chemin/vers/la-timeline
```

La synchronisation installe uniquement les blocs absents dans `compositions/`. Elle ne remplace jamais un layout déjà utilisé : les anciennes vidéos restent donc reproductibles. Un layout amélioré est publié sous un nouveau nom versionné, puis devient disponible dans toutes les timelines au prochain lancement.

## Contenu

- `registry/` : layouts MEG adaptés et directement utilisables dans HyperFrames Studio.
- `sources/` : cinq banques Remotion MIT téléchargées (`onda`, `remocn`, `rve-templates`, `captions-themes`, `scenes`). Elles servent de matière première et ne sont jamais chargées directement dans une timeline HyperFrames.
- `scripts/sync-project.mjs` : synchronisation universelle des blocs manquants.
- `scripts/lib-format.mjs` : règle unique du classement (format par dimensions réelles + socle commun).
- `scripts/build-public-catalog.mjs` : génère `docs/catalog.json` (marque, format, commun) pour la page publique.
- `scripts/audit-public-page.mjs` : audit machine de la page publique — rejoue le classement de `docs/index.html` sur le catalogue et refuse tout bloc perdu ou dupliqué.
- `borumi/` : kit portable Borumi MEG (83 favoris, manifeste externe, rendu de titres A/B/E et installateur macOS en lecture seule par défaut). Voir [`borumi/README.md`](borumi/README.md).

Les licences et crédits propres à chaque banque source restent dans son dossier. Le code MEG de la registry demeure la propriété de MEG Business 360.

## Catalogue local (voir les layouts de manière dynamique)

Lancer : node scripts/catalog.mjs — puis ouvrir http://localhost:3020/

Le serveur local sert la **même page que la page publique** (`docs/index.html` + `docs/catalog.json`),
avec pull silencieux (1x/min) et rafraîchissement automatique toutes les 15 s en local.

## Ranger la banque : FORMAT d'abord, puis marque

La page publique et le catalogue local demandent d'abord le **format**, puis affichent les marques :

1. **Format** — deux boutons toujours visibles, **Mobile (9:16 · 1080×1920)** et **YouTube (16:9 · 1920×1080)**,
   chacun avec son nombre de blocs. Le format retenu filtre toute la page (recherche et compteurs compris)
   et se garde dans l'adresse (`?f=youtube`).
2. **Marque** — dans ce format, une **partition stricte** (chaque bloc apparaît une seule fois) :
   **Commun (MEG + DSS)** — les blocs montés par les deux marques et eux seuls —, puis **MEG** et
   **DSS Real Estate** avec leurs blocs **non communs** seulement, chacun avec son compte.

Un bloc qui n'est ni 1080×1920 ni 1920×1080 garde le groupe de **sa dimension réelle** et son propre bouton
de format (jamais un format inventé) ; une marque sans bloc pour le format affiché garde la mention discrète
« Aucun bloc pour ce format. ».

Rien ne disparaît et rien n'est compté deux fois : `node scripts/audit-public-page.mjs` relit la page
publiée ou locale, rejoue le classement réel et vérifie que Commun + MEG + DSS font exactement le total
du format, que chaque nom n'apparaît qu'une fois et que les 280 blocs sont tous affichés.
Résultat du 20/09/2026 : Mobile 191 = Commun 11 + MEG 178 + DSS 2 ; YouTube 89 = Commun 0 + MEG 89 + DSS 0.

### Ce qui rend un bloc « commun »

Un bloc est commun **uniquement** avec une preuve d'usage par les deux marques :

- la même source (contenu identique) est présente dans un projet **MEG** et dans un projet **DSS** ; ou
- le manifeste le déclare pour les deux marques (`tags: ["meg", "dss", ...]`) et cet usage est constaté des deux côtés.

Une ressemblance de nom ne suffit jamais. Le détail des preuves (chemin de chaque copie) est tenu dans le
rapport de la passe du 19/09/2026 ; le tag `commun` est la trace durable dans le manifeste.

Blocs communs au 20/09/2026 (11, tous en Mobile 9:16) : `meg-face-full`, `meg-tiktok-title-classic`,
`meg-face-proof-split-t04`, `meg-face-proof-split-t17`, `meg-proof-full`, `meg-face-cta-arrows`,
`meg-captions-global`, `meg-masked-face-stage`, `layout-sequence`, `layout-face-9-16`, `layout-plein-16-9`.
`captions-dss` et `titre-tiktok-dss` sont revenus DSS seulement (commit `723e011`, presets non partagés).

Précision de preuve (19/09/2026) : `layout-face-9-16`, `layout-plein-16-9` et `layout-sequence` ont une copie
**identique** au registry dans la librairie du skill `meg-clipping` (`templates/layouts/`) ; leurs copies dans
les projets vidéo MEG et DSS sont en retard d'une ligne — elles portent encore `data-composition-vars` alors que
le registry utilise `data-variable-values` (correction du 19/09/2026, commit `daf8c45`). Le bloc est le même :
la propagation de l'attribut dans les projets reste à faire, elle ne change pas le classement.

## Publier un nouveau layout dans la banque

Lancer : node scripts/publish-layout.mjs --file /chemin/layout.html --name mon-layout --brand dss --title "Mon layout" --desc "Description courte" --target templates-dss/mon-layout.html --push

Le script copie le fichier dans registry/blocks/<nom>/, écrit son registry-item.json, met à jour
registry/registry.json, régénère docs/catalog.json et, avec --push, commit et pousse sur main.
Catalogue local : http://localhost:3020/ — il fait un git pull silencieux (1x/min) et affiche
immédiatement tout layout publié dans Git.

Page publique : https://meg-business-360.github.io/meg-hyperframes-banque/ (GitHub Pages, source main /)
— mise à jour automatique à chaque push.

## Ajouter un layout

1. Chercher d’abord un existant dans `registry/` et `sources/`.
2. Adapter le rendu à la charte MEG et au contrat HyperFrames.
3. Pour tout emplacement de marque, utiliser les fichiers officiels du générateur : `meg-logo-dark.png` sur fond clair et `meg-logo-light.png` sur fond sombre. Ne jamais recomposer le logo avec du texte.
4. Créer `registry/blocks/<nom>/registry-item.json` et le bloc HTML.
5. Ajouter le bloc à `registry/registry.json`, puis exécuter `node scripts/gen-layouts/index.mjs`. Le générateur ajoute automatiquement le layout à `MEG - Reel` ou `MEG - YouTube` et à son dossier selon ses dimensions et ses tags métier.
6. Exécuter `hyperframes lint`, `hyperframes validate`, puis tester `hyperframes add` dans un projet neuf.
7. Publier sur `main`. Toutes les timelines verront le nouveau bloc à leur prochaine synchronisation.

## Organisation automatique du Studio

La source unique reste Git. Aucun rangement manuel n’est nécessaire après publication.

- `1080 × 1920` → `MEG - Reel`.
- `1920 × 1080` → `MEG - YouTube`.
- Chaque layout reçoit exactement un tag de dossier `meg-reel-folder-*` ou `meg-youtube-folder-*` lors de la régénération.
- Les dossiers visibles sont : aperçu, intros, écran & visage, détourage, preuves & B-roll, motion & texte, transitions, chapitres, CTA & outros et habillages.
