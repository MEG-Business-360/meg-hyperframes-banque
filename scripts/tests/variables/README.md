# Test des variables HyperFrames (19/09/2026)

Protocole verifie :
1. Rendu A : npx hyperframes render --quality draft --variables '{title:AAA,accent:#ff0000}'
2. Rendu B : memes fichiers, --variables '{title:BBB,accent:#00ff00}'
3. Comparer une frame de A et B : si les pixels changent, les variables s'appliquent.

Resultat mesure : A (AAA rouge) vs B (BBB vert) = 1917 pixels differents (0,37 %), visuellement confirme.
Conclusion : les variables declarees sur <html data-composition-variables> et liees par data-var-text fonctionnent au rendu via --variables.

## Resultat du test C (mesure du 19/09/2026)

Test : meme projet, sous-composition avec l'attribut data-variable-values (valeur "SOUS TEST C") sur
l'element hote, rendu avec les memes variables que le rendu B.

Mesure : **0 pixel different** entre B (valeur par defaut) et C (valeur injectee).

Conclusion : en HyperFrames 0.8.50, **l'override par instance d'une sous-composition via
data-variable-values ne s'applique pas** (l'override racine via --variables fonctionne, lui).

Consequence pratique pour la banque :

- un bloc (sous-composition) se remplit aujourd'hui en modifiant son contenu dans le projet,
  ou en integrant la composition a la racine ;
- ne pas promettre "je passe la valeur depuis l'hote" tant que ce point n'est pas corrige ou
  contourne par un autre mecanisme verifie.
