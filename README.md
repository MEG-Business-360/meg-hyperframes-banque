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
- `borumi/` : kit portable Borumi MEG (83 favoris, manifeste externe, rendu de titres A/B/E et installateur macOS en lecture seule par défaut). Voir [`borumi/README.md`](borumi/README.md).

Les licences et crédits propres à chaque banque source restent dans son dossier. Le code MEG de la registry demeure la propriété de MEG Business 360.

## Catalogue local (voir les layouts de manière dynamique)

Lancer : node scripts/catalog.mjs — puis ouvrir http://localhost:3020/

La page lit le registre en direct (rafraîchissement toutes les 15 s) et sépare **MEG** de **DSS Real Estate**,
avec recherche, aperçus, tags et la commande d'installation de chaque bloc.

## Publier un nouveau layout dans la banque

Lancer : node scripts/publish-layout.mjs --file /chemin/layout.html --name mon-layout --brand dss --title "Mon layout" --desc "Description courte" --target templates-dss/mon-layout.html --push

Le script copie le fichier dans registry/blocks/<nom>/, écrit son registry-item.json, met à jour
registry/registry.json et, avec --push, commit et pousse sur main. Le catalogue le montre immédiatement.

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
