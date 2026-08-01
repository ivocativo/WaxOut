# bake_sprite.py — prepara UN singolo sprite AI su fondo magenta per il gioco.
#
#     python tools\bake_sprite.py <sorgente.png> <uscita.png> <larghezza> [livelli]
#
# PERCHE' ESISTE, visto che c'e' gia' bake_sprite.ps1. Quello ridimensiona PRIMA e scontorna DOPO
# (per un limite di GDI+, che sbava il nero dei pixel trasparenti dentro l'arte). Finche' si
# rimpicciolisce poco va bene, ma il braccio con lo spruzzino andava da 1304px a 88: a quel punto
# ogni pixel finale e' la media di quindici pixel di partenza, e attorno alla sagoma finiscono nel
# calcolo i pixel MAGENTA del fondo -> frangia viola lungo tutto il bordo.
#
# Qui si fa nell'ordine giusto:
#   1. si scontorna a PIENA risoluzione (chiave stretta: il magenta puro ha rosso e blu altissimi
#      e quasi uguali, verde bassissimo — nessun rosa dell'arte gli somiglia);
#   2. si SPALMA il colore del bordo dentro la zona trasparente per un raggio pari al fattore di
#      riduzione, cosi' la media dei pixel non incontra mai il magenta;
#   3. si rimpicciolisce colore e trasparenza separatamente;
#   4. si posterizza e si taglia al contenuto.
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage


def bake(sorgente, larghezza, livelli=0):
    im = Image.open(sorgente).convert("RGB")
    a = np.array(im).astype(int)
    magenta = ((a[:, :, 0] > 170) & (a[:, :, 2] > 170) & (a[:, :, 1] < 110)
               & (np.abs(a[:, :, 0] - a[:, :, 2]) < 70))
    opaco = ~magenta

    rgb = np.array(im)
    raggio = int(np.ceil(im.width / larghezza)) + 2
    riempito, maschera = rgb.copy(), opaco.copy()
    for _ in range(raggio):
        vicino = ndimage.grey_dilation(maschera.astype(np.uint8), size=3) > 0
        nuovi = vicino & ~maschera
        for c in range(3):
            d = ndimage.grey_dilation(np.where(maschera, riempito[:, :, c], 0), size=3)
            riempito[:, :, c] = np.where(nuovi, d, riempito[:, :, c])
        maschera = vicino

    alto = max(1, round(im.height * larghezza / im.width))
    colore = Image.fromarray(riempito).resize((larghezza, alto), Image.LANCZOS)
    alfa = Image.fromarray((opaco * 255).astype(np.uint8)).resize((larghezza, alto), Image.LANCZOS)
    if livelli >= 2:
        lut = [round(round((v / 255) * (livelli - 1)) * (255 / (livelli - 1))) for v in range(256)]
        colore = Image.merge("RGB", [c.point(lut) for c in colore.split()])

    fuori = Image.fromarray(np.dstack([np.array(colore),
                                       np.where(np.array(alfa) > 110, 255, 0).astype(np.uint8)]), "RGBA")
    return fuori.crop(fuori.getbbox())


def main():
    if len(sys.argv) < 4:
        print(__doc__)
        return 2
    uscita = Path(sys.argv[2])
    im = bake(Path(sys.argv[1]), int(sys.argv[3]), int(sys.argv[4]) if len(sys.argv) > 4 else 0)
    uscita.parent.mkdir(parents=True, exist_ok=True)
    im.save(uscita)
    a = np.array(im)
    op = a[:, :, 3] > 40
    px = a[op][:, :3].astype(int)
    viola = int(((px[:, 0] > 150) & (px[:, 2] > 150) & (px[:, 1] < 110)).sum())
    print(f"OK -> {uscita}   {im.width}x{im.height}   {uscita.stat().st_size // 1024} KB")
    print(f"     pixel opachi {int(op.sum())}, di cui ancora violacei {viola} "
          f"({'bene' if viola < op.sum() * 0.02 else 'ATTENZIONE: frangia magenta'})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
