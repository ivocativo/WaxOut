# fai_icone.py — dall'immagine dell'icona ricava TUTTI i file che servono ad Android.
#
#     python tools\fai_icone.py art_sources\icona_waxout.png
#
# PERCHE' UNO STRUMENTO. La cartella del progetto Android NON e' versionata: la ricostruisce da
# zero la macchina a ogni compilazione (`npx cap add android`), quindi non si puo' semplicemente
# metterci dentro l'icona a mano. I file prodotti qui finiscono in `android-res/`, che e' nel
# repository, e il workflow li ricopia dentro dopo aver generato il progetto.
#
# LA ZONA SICURA, che e' il modo piu' comune di sbagliare un'icona Android. Da Android 8 l'icona
# e' "adattiva": il telefono la ritaglia con una maschera che cambia da marca a marca (cerchio,
# quadrato stondato, goccia) e mangia circa il 39% esterno. Quindi il disegno NON puo' arrivare ai
# bordi: qui il soggetto viene scontornato e rimpicciolito dentro il 61% centrale, e attorno resta
# solo il colore di fondo. L'immagine consegnata dall'utente aveva la testa al 95% dell'altezza:
# lasciata com'era, su mezzo parco telefoni si sarebbe vista col casco tagliato.
#
# Cosa produce:
#   android-res/mipmap-<densita>/ic_launcher.png          icona classica (quadrata)
#   android-res/mipmap-<densita>/ic_launcher_round.png    icona classica tonda
#   android-res/mipmap-<densita>/ic_launcher_foreground.png   strato davanti dell'adattiva
#   android-res/values/ic_launcher_background.xml         colore dello strato dietro
#   store/icona-512.png                                   scheda del Play Store (senza trasparenza)
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

RAD = Path(__file__).resolve().parent.parent
# Lato in pixel per ogni densita': 48dp per l'icona classica, 108dp per l'adattiva.
DENSITA = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}
CLASSICA_DP = 48
ADATTIVA_DP = 108
ZONA_SICURA = 0.58      # quanto del lato puo' occupare il soggetto (il limite vero e' 0,611)
TOLLERANZA = 26         # quanto un pixel puo' discostarsi dal fondo restando "fondo"


def separa(percorso):
    """Scontorna il soggetto dal fondo a tinta unita e restituisce (soggetto RGBA, colore fondo)."""
    im = Image.open(percorso).convert("RGB")
    a = np.array(im).astype(int)
    bordo = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
    fondo = np.median(bordo, axis=0)
    pieno = np.abs(a - fondo).max(axis=2) > TOLLERANZA
    # solo il pezzo piu' grande (via eventuali firme o sbavature negli angoli) e buchi riempiti
    pezzi, n = ndimage.label(pieno)
    if n > 1:
        aree = ndimage.sum(np.ones_like(pezzi), pezzi, range(1, n + 1))
        pieno = pezzi == int(np.argmax(aree)) + 1
    pieno = ndimage.binary_fill_holes(pieno)
    rgba = np.dstack([np.array(im), np.where(pieno, 255, 0).astype(np.uint8)])
    sog = Image.fromarray(rgba)
    return sog.crop(sog.getbbox()), tuple(int(v) for v in fondo)


def dentro(tela, sog, frazione):
    """Mette il soggetto al centro di una tela quadrata, alto/largo al massimo `frazione` del lato."""
    lato = tela.width
    massimo = lato * frazione
    s = min(massimo / sog.width, massimo / sog.height)
    r = sog.resize((max(1, round(sog.width * s)), max(1, round(sog.height * s))), Image.LANCZOS)
    tela.paste(r, (lato // 2 - r.width // 2, lato // 2 - r.height // 2), r)
    return tela


def tonda(im):
    m = Image.new("L", im.size, 0)
    ImageDraw.Draw(m).ellipse((0, 0, im.width - 1, im.height - 1), fill=255)
    out = Image.new("RGBA", im.size, (0, 0, 0, 0))
    out.paste(im, (0, 0), m)
    return out


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    sorgente = Path(sys.argv[1])
    if not sorgente.exists():
        print(f"MANCA: {sorgente}")
        return 1

    sog, fondo = separa(sorgente)
    print(f"soggetto {sog.width}x{sog.height}, fondo #{fondo[0]:02x}{fondo[1]:02x}{fondo[2]:02x}")

    res = RAD / "android-res"
    for nome, k in DENSITA.items():
        cart = res / f"mipmap-{nome}"
        cart.mkdir(parents=True, exist_ok=True)

        # CLASSICA: fondo pieno + soggetto grande. Qui la maschera non c'e', quindi il soggetto
        # puo' prendersi piu' spazio (ma non tutto: certi lanciatori arrotondano lo stesso).
        lato = round(CLASSICA_DP * k)
        q = dentro(Image.new("RGBA", (lato, lato), fondo + (255,)), sog, 0.86)
        q.save(cart / "ic_launcher.png")
        tonda(dentro(Image.new("RGBA", (lato, lato), fondo + (255,)), sog, 0.74)).save(
            cart / "ic_launcher_round.png")

        # ADATTIVA: solo il soggetto su trasparente, dentro la zona sicura. Il fondo lo mette
        # Android con il colore qui sotto, e puo' scorrere per conto suo (effetto parallasse).
        latoA = round(ADATTIVA_DP * k)
        dentro(Image.new("RGBA", (latoA, latoA), (0, 0, 0, 0)), sog, ZONA_SICURA).save(
            cart / "ic_launcher_foreground.png")
        print(f"  {nome:8s} classica {lato}px, adattiva {latoA}px")

    (res / "values").mkdir(parents=True, exist_ok=True)
    (res / "values" / "ic_launcher_background.xml").write_text(
        '<?xml version="1.0" encoding="utf-8"?>\n'
        '<resources>\n'
        f'    <color name="ic_launcher_background">#{fondo[0]:02X}{fondo[1]:02X}{fondo[2]:02X}</color>\n'
        '</resources>\n', encoding="utf-8")

    # PLAY STORE: 512x512 SENZA trasparenza (Google la rifiuta se ha il canale alfa).
    store = RAD / "store"
    store.mkdir(exist_ok=True)
    p = dentro(Image.new("RGBA", (512, 512), fondo + (255,)), sog, 0.88).convert("RGB")
    p.save(store / "icona-512.png")
    print("OK -> android-res/ e store/icona-512.png")
    return 0


if __name__ == "__main__":
    sys.exit(main())
