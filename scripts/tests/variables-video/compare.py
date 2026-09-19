#!/usr/bin/env python3
"""Mesure la couleur moyenne d'une moitie de frame (gauche / droite)."""
import subprocess
import sys


def mean(png, crop):
    out = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", png, "-vf", "crop=" + crop + ",scale=1:1",
         "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
        capture_output=True, check=True).stdout[:3]
    return tuple(out)


def couleur(rgb):
    r, g, b = rgb
    if r > 128 and b < 64:
        return "ROUGE"
    if b > 128 and r < 64:
        return "BLEU"
    return "AUTRE" + str(rgb)


if __name__ == "__main__":
    png = sys.argv[1]
    print(couleur(mean(png, "270:960:0:0")) + " " + couleur(mean(png, "270:960:270:0")))
