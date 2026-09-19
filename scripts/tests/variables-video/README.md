# Test des variables sur une source VIDEO (19/09/2026)

Complete ../variables/README.md (test A/B/C sur du texte). Ici la variable porte une **source video** :
c'est le mecanisme qui fait « rentrer la video automatiquement » dans un layout.

## Protocole

Le projet contient deux zones :

- **gauche** : une balise video avec data-var-src=video et src=assets/red.mp4, a la racine de la composition ;
- **droite** : une sous-composition (compositions/sous.html) dont la video porte le meme data-var-src=video
  (defaut rouge), montee par un hote qui porte data-variable-values avec la valeur assets/blue.mp4.

Deux rendus : par defaut, puis --variables avec video = assets/blue.mp4.

    cd scripts/tests/variables-video && ./run-test.sh   # ~90 s, exit 1 si le resultat change

## Resultat mesure (hyperframes 0.8.50)

| Rendu | Gauche (racine) | Droite (sous-composition) |
|---|---|---|
| par defaut | ROUGE (250, 0, 0) | **ROUGE** (250, 0, 0) |
| --variables video=assets/blue.mp4 | BLEU (0, 1, 251) | **BLEU** (0, 1, 251) |

Conclusions :

1. **data-var-src pilote bien une source video** : la variable change la video reellement decodee.
2. **L'override par instance data-variable-values sur l'hote n'est pas applique** (droite rouge au lieu de
   bleue) — confirme le test C sur du texte : la voie « je passe la valeur depuis l'hote » ne marche pas en 0.8.50.
3. **--variables a la racine traverse les sous-compositions** : la droite devient bleue alors que son propre
   defaut est rouge. C'est aujourd'hui le seul chemin mesure pour injecter une valeur dans un bloc :
   declarer l'identifiant a la racine du projet (ou dans le panneau Variables du Studio) puis le passer.

Consequence pour la banque : un bloc (layout, titre, captions) se remplit en declarant ses identifiants a la
racine du projet, ou en modifiant son contenu dans le projet — jamais en comptant sur data-variable-values
de l'hote.

