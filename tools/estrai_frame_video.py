# estrai_frame_video.py — ritrova nel VIDEO originale i fotogrammi di un'animazione gia' in
# gioco, e li riesporta GRANDI e puliti per poterli modificare a mano.
#
#     python tools\estrai_frame_video.py <video.mp4> <foglio_px.png> <n_frame> <cartella_uscita>
#
# Esempio:
#     python tools\estrai_frame_video.py "assets\spritesheets\hero\crouch move\crouch move.mp4" ^
#         assets\spritesheets\hero\hero_crouchwalk_px.png 8 ^
#         assets\spritesheets\hero\da_modificare
#
# A COSA SERVE. Quando serve una VARIANTE di un'animazione che c'e' gia' (per esempio la stessa
# camminata ma sparando), i fotogrammi da far ridisegnare devono essere gli STESSI, se no le
# gambe non combaciano e passando da una versione all'altra il personaggio scatta.
# La strada ovvia — ritagliare i fotogrammi dal foglio gia' pronto e ingrandirli — NON funziona:
# quel foglio e' l'arrivo della lavorazione, celle da 84x84 con i colori ridotti a sei livelli.
# Ingrandirlo restituisce un'immagine minuscola e sgranata, inutile da ridisegnare.
# Qui si torna alla SORGENTE: si ritrovano nel video i fotogrammi giusti e si esportano alla loro
# risoluzione vera.
#
# COME LI RITROVA (non sono annotati da nessuna parte). Di ogni fotogramma del video si prende la
# SAGOMA, la si normalizza (ritagliata sul soggetto e riportata a una griglia fissa) e la si
# confronta con la sagoma di ogni cella del foglio. Per ogni cella vince il fotogramma piu'
# somigliante. Si confrontano le sagome e non i colori perche' il foglio ha subito ridimensiona-
# mento e riduzione della tavolozza: la forma sopravvive a entrambi, il colore no.
#
# COSA ESCE. Un PNG per fotogramma, a piena risoluzione, personaggio scontornato su MAGENTA
# (#FF00FF) — il fondo che tutta la lavorazione del gioco si aspetta.
import sys
from pathlib import Path

import numpy as np
from PIL import Image

MAGENTA = (255, 0, 255)
GRIGLIA = 64          # lato della sagoma normalizzata usata per il confronto
# Da quanti pixel in su un buco nella sagoma e' VERO e va lasciato aperto. Sotto questa soglia
# sono i forellini lasciati dai contorni interni (misurati: ~1000 per fotogramma, tutti sotto i
# 100 px); i due buchi veri — l'ansa del tubo e il vuoto fra le gambe incrociate — stanno sopra
# i 9.000. In mezzo non c'e' niente, quindi la soglia non e' delicata.
BUCO_VERO = 600
CONTORNO = 2          # di quanti pixel riallargare la sagoma per riprendersi il contorno esterno


def scontorna_registrazione(im):
    """Scontorno per i fotogrammi di una REGISTRAZIONE DI SCHERMO.

    ⚠️ IL PROBLEMA VERO, misurato sul video dell'accovacciamento il 2026-08-02: il fondo
    dell'interfaccia sta a (30,30,32) e i CONTORNI del personaggio a (32,33,36). Sono LO STESSO
    COLORE. Quindi NESSUNA soglia di colore puo' separarli: con la tolleranza piu' stretta
    provata (6) meta' dei pixel scuri del personaggio finiva comunque nel fondo.
    Le due strade ovvie falliscono per motivi opposti:
      · classificare per colore (quello che si faceva prima) buca il personaggio: alla
        risoluzione piena venivano ~1000 forellini per fotogramma, e alla lavorazione non si
        vedevano solo perche' la riduzione a 84x84 li faceva sparire;
      · il riempimento a macchia d'olio dai bordi non buca ma DILAGA: i contorni interni (fra
        braccio e busto, fra le gambe) formano una rete continua dello stesso colore del fondo,
        e la macchia ci viaggia dentro fino al cuore del personaggio.

    QUELLO CHE SI FA QUI: non si cerca di distinguere il contorno dal fondo — non si puo'. Si
    ricostruisce la SAGOMA e si dice che tutto quello che ci sta dentro appartiene al
    personaggio, contorni compresi.
      1. si prende cio' che di sicuro NON e' fondo (i pixel colorati) e si tiene il pezzo piu'
         grande: e' il personaggio senza i suoi contorni, e cosi' si scarta anche la filigrana;
      2. si TAPPANO i buchi. I forellini lasciati dai contorni interni spariscono tutti insieme;
      3. si RIAPRONO solo i buchi GRANDI, che sono veri: l'ansa del tubo che esce dallo zaino,
         e il vuoto fra le gambe quando una incrocia l'altra;
      4. si ALLARGA di due pixel per riprendersi il contorno esterno, che al passo 1 era stato
         scambiato per fondo. Quei due pixel sono scuri quanto il fondo, quindi anche se
         qualcosa di fondo entra non si distingue dal contorno.
    """
    from scipy import ndimage
    a = np.array(im)
    rgb = a[:, :, :3].astype(int)
    bordo = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
    colore = np.median(bordo, axis=0)
    simile = (np.abs(rgb - colore).max(axis=2) <= 14)

    # 1) il pezzo colorato piu' grande = il personaggio senza contorni
    pezzi, quanti = ndimage.label(~simile)
    if quanti > 1:
        aree = ndimage.sum(np.ones_like(pezzi), pezzi, range(1, quanti + 1))
        corpo = pezzi == (int(np.argmax(aree)) + 1)
    else:
        corpo = ~simile

    # 2) tappa tutti i buchi, 3) riapri solo quelli grandi
    # ⚠️ Le aree si calcolano TUTTE IN UN COLPO con `ndimage.sum`, e la selezione si fa con una
    # tabella di consultazione. Scritto come ciclo (`for ogni buco: se e' grande, aggiungilo`)
    # sembra piu' chiaro ma e' inservibile: i buchi sono ~1000 per fotogramma e i fotogrammi 121,
    # quindi si finisce a fare centomila operazioni su tutta l'immagine.
    pieno = ndimage.binary_fill_holes(corpo)
    buchi, nb = ndimage.label(pieno & ~corpo)
    if nb:
        aree_buchi = ndimage.sum(np.ones_like(buchi), buchi, range(1, nb + 1))
        grande = np.concatenate([[False], np.asarray(aree_buchi) >= BUCO_VERO])
        veri = grande[buchi]
    else:
        veri = np.zeros_like(pieno)

    # 4) riprenditi il contorno esterno (e togli lo stesso spessore ai buchi veri, per coerenza)
    maschera = ndimage.binary_dilation(pieno, iterations=CONTORNO)
    if veri.any():
        maschera &= ~ndimage.binary_erosion(veri, iterations=CONTORNO)

    a[:, :, 3] = np.where(maschera, 255, 0)
    return Image.fromarray(a)


def sagoma(alpha):
    """Sagoma normalizzata: ritagliata sul soggetto e riportata su una griglia fissa.

    Serve la normalizzazione perche' nel video il personaggio e' grande centinaia di pixel e nel
    foglio poche decine: senza, si confronterebbero due cose incommensurabili.
    """
    sel = alpha > 100
    if not sel.any():
        return None
    ys, xs = np.where(sel)
    ritaglio = sel[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    return np.asarray(
        Image.fromarray((ritaglio * 255).astype(np.uint8)).resize((GRIGLIA, GRIGLIA), Image.BILINEAR),
        dtype=np.float64) / 255.0


def su_magenta(im):
    a = np.array(im)
    op = a[:, :, 3:4] / 255.0
    fondo = np.zeros_like(a[:, :, :3])
    fondo[:, :] = MAGENTA
    misto = (a[:, :, :3] * op + fondo * (1 - op)).astype(np.uint8)
    return Image.fromarray(misto, "RGB")


def main():
    if len(sys.argv) < 5:
        print(__doc__)
        return 1
    video = Path(sys.argv[1])
    foglio = Path(sys.argv[2])
    n = int(sys.argv[3])
    uscita = Path(sys.argv[4])
    uscita.mkdir(parents=True, exist_ok=True)

    # --- le sagome che si cercano: una per cella del foglio gia' in gioco
    fg = Image.open(foglio).convert("RGBA")
    lato = fg.size[0] // n
    cercate = []
    for i in range(n):
        cella = np.array(fg.crop((i * lato, 0, (i + 1) * lato, fg.size[1])))
        s = sagoma(cella[:, :, 3])
        if s is None:
            print(f"cella {i} vuota nel foglio")
            return 2
        cercate.append(s)

    # --- tutti i fotogrammi del video, scontornati
    import imageio_ffmpeg
    it = imageio_ffmpeg.read_frames(str(video))
    meta = next(it)
    w, h = meta["size"]
    print(f"video {w}x{h}, lo scorro tutto...")
    frame, sagome = [], []
    for f in it:
        im = scontorna_registrazione(Image.fromarray(
            np.frombuffer(f, np.uint8).reshape(h, w, 3).copy()).convert("RGBA"))
        s = sagoma(np.array(im)[:, :, 3])
        if s is None:
            frame.append(None); sagome.append(None); continue
        frame.append(im); sagome.append(s)
    print(f"{len(frame)} fotogrammi letti")

    # --- per ogni cella, il fotogramma piu' somigliante
    # ⚠️ VINCOLO: i fotogrammi devono venire IN ORDINE CRESCENTE. Senza, il confronto sbaglia in
    # modo prevedibile: una camminata ha due mezzi passi che si somigliano molto, e la ricerca
    # libera assegna a due celle diverse lo STESSO fotogramma (visto: la cella 5 ripescava il 78,
    # gia' preso dalla cella 1). Un video pero' non torna indietro, quindi imporre l'ordine non e'
    # una furbizia: e' un fatto sulla sorgente, e da solo scioglie l'ambiguita'.
    scelti = []
    minimo = 0
    for i, c in enumerate(cercate):
        migliore, punteggio = None, 1e9
        for k in range(minimo, len(sagome)):
            if sagome[k] is None:
                continue
            d = float(np.abs(sagome[k] - c).mean())
            if d < punteggio:
                punteggio, migliore = d, k
        if migliore is None:
            print(f"  cella {i}: nessun fotogramma disponibile dopo il {minimo}")
            return 2
        scelti.append((migliore, punteggio))
        minimo = migliore + 1
        print(f"  cella {i} -> fotogramma {migliore} del video (scarto {punteggio:.4f})")

    # --- esportazione a piena risoluzione, ritagliata larga attorno al personaggio
    for i, (k, _) in enumerate(scelti):
        im = frame[k]
        a = np.array(im)
        ys, xs = np.where(a[:, :, 3] > 100)
        m = 40   # un po' d'aria attorno: il braccio va ridisegnato e gli serve spazio
        box = (max(0, xs.min() - m), max(0, ys.min() - m),
               min(im.size[0], xs.max() + 1 + m), min(im.size[1], ys.max() + 1 + m))
        su_magenta(im.crop(box)).save(uscita / f"crouchwalk_{i}.png")
    print(f"salvati {n} fotogrammi in {uscita}")
    print("fotogrammi del video usati:", ",".join(str(k) for k, _ in scelti))
    return 0


if __name__ == "__main__":
    sys.exit(main())
