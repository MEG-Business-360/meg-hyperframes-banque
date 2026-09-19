# Test des variables HyperFrames (19/09/2026)

Protocole verifie :
1. Rendu A : npx hyperframes render --quality draft --variables '{title:AAA,accent:#ff0000}'
2. Rendu B : memes fichiers, --variables '{title:BBB,accent:#00ff00}'
3. Comparer une frame de A et B : si les pixels changent, les variables s'appliquent.

Resultat mesure : A (AAA rouge) vs B (BBB vert) = 1917 pixels differents (0,37 %), visuellement confirme.
Conclusion : les variables declarees sur <html data-composition-variables> et liees par data-var-text fonctionnent au rendu via --variables.

Reste a verifier : l'override par instance d'une sous-composition (data-variable-values sur l'hote) - test C lance, resultat non conclu.
