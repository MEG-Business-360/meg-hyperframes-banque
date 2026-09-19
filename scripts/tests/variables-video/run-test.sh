#!/bin/bash
# Test des variables HyperFrames sur une SOURCE VIDEO (projet autonome, sans dependance externe).
# Attendu (mesure du 19/09/2026, hyperframes 0.8.50) :
#   rendu par defaut  -> ROUGE ROUGE  (l'override par instance data-variable-values est ignore)
#   rendu --variables -> BLEU  BLEU   (la variable racine traverse la sous-composition)
set -u
cd "$(dirname "$0")"
fail=0

npx hyperframes render -q draft -o out-default.mp4 . > render-default.log 2>&1
npx hyperframes render -q draft --variables '{"video":"assets/blue.mp4"}' -o out-var.mp4 . > render-var.log 2>&1

for n in out-default out-var; do
  ffmpeg -v error -y -i "$n.mp4" -vf "select=eq(n\,15)" -vframes 1 "$n.png"
done

echo "PROJET              GAUCHE (video racine, data-var-src) | DROITE (sous-comp, data-variable-values)"
for n in out-default out-var; do
  printf '%-18s  %s\n' "$n" "$(python3 compare.py "$n.png")"
done

defaut=$(python3 compare.py out-default.png)
var=$(python3 compare.py out-var.png)
[ "$defaut" = "ROUGE ROUGE" ] || { echo "FAIL: rendu par defaut = $defaut (attendu ROUGE ROUGE)"; fail=1; }
[ "$var" = "BLEU BLEU" ] || { echo "FAIL: rendu --variables = $var (attendu BLEU BLEU)"; fail=1; }
[ "$fail" -eq 0 ] && echo "PASS: override par instance ignore, variable racine propagee dans la sous-composition"
exit $fail
