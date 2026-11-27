"""Construit la carte de Dubai de l'outro WhatsApp DSS v2 depuis OpenStreetMap (ODbL), sans dessin a main levee.

Etapes (Python 3 avec pyosmium, shapely, Pillow) :
  1. telecharger https://download.geofabrik.de/asia/gcc-states-latest.osm.pbf sous le nom gcc.osm.pbf (md5 dans preuve-carte.json) ;
  2. extraire.py : traits de cote (natural=coastline), autoroutes, lieux nommes -> osm-dubai.json ;
  3. lieux.py    : coordonnees des quartiers (noeud place=* ou centroide du polygone) -> lieux.json ;
  4. geo.py      : terre = continent (decoupe du cadre par le trait de cote) + iles, simplifiee 0,9 px ; routes 1,2 px -> carte-svg.json ;
  5. reference.py: tuiles OSM standard reprojetees dans le meme cadre -> reference-osm.png (controle visuel du pin) ;
  6. assembler.py <dossier carte> <dossier bloc> : injecte terre, routes et cadre dans gabarit.src.html -> outro-whatsapp-dss-v2.html.
Usage : python3 construire_carte.py <dossier de travail contenant gcc.osm.pbf>
"""
import subprocess, sys
from pathlib import Path
ici = Path(__file__).resolve().parent
travail = Path(sys.argv[1]).resolve()
for s, args in (("extraire.py", ["gcc.osm.pbf"]), ("lieux.py", ["gcc.osm.pbf"]), ("geo.py", []), ("reference.py", [])):
    subprocess.run([sys.executable, str(ici / s), *args], cwd=travail, check=True)
(travail / "gabarit.src.html").write_bytes((ici / "gabarit.src.html").read_bytes())
subprocess.run([sys.executable, str(ici / "assembler.py"), str(travail), str(ici.parent)], check=True)
