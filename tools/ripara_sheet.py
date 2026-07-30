# ripara_sheet.py — ripara i difetti tipici degli spritesheet montati "a ritaglio".
#
#     python tools\ripara_sheet.py <sheet.png> <larghezza_cella> [--buchi N] [--sfuma] [--copia A=B ...]
#
# Le animazioni arrivano da un montaggio a pezzi (corpo + zampe/ali ritagliate e ruotate). Due
# difetti nascono da li', e si vedono anche dopo aver rimpicciolito lo sprite:
#
# 1. BUCHI ALL'ATTACCATURA. Ruotando una zampa resta un cuneo TRASPARENTE fra zampa e corpo: a
#    schermo la zampa sembra staccata. Sono buchi CHIUSI (non collegati allo sfondo esterno), e
#    per questo si possono trovare e riempire senza rischiare di chiudere i vuoti veri fra una
#    zampa e l'altra, che invece sono collegati fuori. Il riempimento prende il colore dal pixel
#    opaco piu' vicino, quindi la toppa e' della stessa carne che ha intorno.
#    `--buchi N` = riempi solo i buchi fino a N pixel (predefinito 1200): oltre quella soglia e'
#    quasi sempre un vuoto voluto e non va toccato.
#
# 2. TAGLIO AL BORDO DELLA CELLA. Se l'ala esce dal riquadro viene tranciata di netto e resta una
#    linea dritta, che l'occhio legge come un'amputazione. I pixel persi NON si recuperano: con
#    `--sfuma` si ammorbidisce l'alfa sull'ultima manciata di pixel, cosi' il taglio smette di
#    essere una lama e diventa una punta sfumata. E' un ripiego: se il taglio e' largo (decine di
#    pixel) l'unica soluzione vera e' rigenerare il disegno con piu' margine.
#
# 3. `--copia 1=0 5=4` sostituisce interi frame con altri (per i casi irrecuperabili).
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage


def ripara(sheet, cella, max_buco=1200, sfuma=False, copie=None):
    im = Image.open(sheet).convert("RGBA")
    h = im.height
    n = im.width // cella
    frames = [np.array(im.crop((i * cella, 0, (i + 1) * cella, h))) for i in range(n)]

    for a, b in (copie or {}).items():
        frames[a] = frames[b].copy()
        print("  frame %2d  <- copiato dal frame %d" % (a, b))

    for i, fr in enumerate(frames):
        alfa = fr[:, :, 3] > 16
        vuoto = ~alfa
        lab, k = ndimage.label(vuoto)
        fuori = set(lab[0, :]) | set(lab[-1, :]) | set(lab[:, 0]) | set(lab[:, -1])
        chiusi = np.zeros_like(alfa)
        riempiti = 0
        for j in range(1, k + 1):
            if j in fuori:
                continue
            m = lab == j
            dim = int(m.sum())
            if dim > max_buco:
                continue
            chiusi |= m
            riempiti += dim
        if riempiti:
            # ⚠️ Il colore va preso SOLO da pixel PIENI (alfa quasi 255). I pixel di bordo sono
            # semitrasparenti e portano dentro l'alone magenta rimasto dallo scontorno: usandoli
            # la toppa veniva a chiazze viola, ben peggio del buco che doveva chiudere.
            pieni = fr[:, :, 3] > 200
            if not pieni.any():
                continue
            _, idx = ndimage.distance_transform_edt(~pieni, return_indices=True)
            for c in range(3):
                canale = fr[:, :, c]
                canale[chiusi] = canale[idx[0][chiusi], idx[1][chiusi]]
            fr[:, :, 3][chiusi] = 255
            # Ammorbidisce la toppa: senza, il rattoppo si vede come una macchia a tinta piatta.
            for c in range(3):
                sfocato = ndimage.uniform_filter(fr[:, :, c].astype(np.float32), size=5)
                fr[:, :, c][chiusi] = sfocato[chiusi].astype(np.uint8)
            print("  frame %2d  riempiti %d pixel di buchi all'attaccatura" % (i, riempiti))

        if sfuma:
            # Sfuma l'alfa sulle 4 righe/colonne di bordo, ma SOLO dove il disegno le tocca:
            # dove non tocca non c'e' niente da ammorbidire.
            for lato in range(4):
                peso = (lato + 1) / 5.0
                if fr[0, :, 3].max() > 16:
                    fr[lato, :, 3] = (fr[lato, :, 3] * peso).astype(np.uint8)
                if fr[-1, :, 3].max() > 16:
                    fr[-1 - lato, :, 3] = (fr[-1 - lato, :, 3] * peso).astype(np.uint8)
                if fr[:, 0, 3].max() > 16:
                    fr[:, lato, 3] = (fr[:, lato, 3] * peso).astype(np.uint8)
                if fr[:, -1, 3].max() > 16:
                    fr[:, -1 - lato, 3] = (fr[:, -1 - lato, 3] * peso).astype(np.uint8)

    fuori_img = Image.new("RGBA", (cella * n, h))
    for i, fr in enumerate(frames):
        fuori_img.paste(Image.fromarray(fr), (i * cella, 0))
    return fuori_img


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        return 2
    sheet = Path(sys.argv[1])
    cella = int(sys.argv[2])
    max_buco, sfuma, copie = 1200, False, {}
    args = sys.argv[3:]
    i = 0
    while i < len(args):
        if args[i] == "--buchi":
            max_buco = int(args[i + 1]); i += 2
        elif args[i] == "--sfuma":
            sfuma = True; i += 1
        elif args[i] == "--copia":
            i += 1
            while i < len(args) and "=" in args[i]:
                a, b = args[i].split("="); copie[int(a)] = int(b); i += 1
        else:
            i += 1
    print("Riparo", sheet.name)
    out = ripara(sheet, cella, max_buco, sfuma, copie)
    dest = sheet.with_name(sheet.stem + "_rip.png")
    out.save(dest)
    print("OK ->", dest.name)
    return 0


if __name__ == "__main__":
    sys.exit(main())
