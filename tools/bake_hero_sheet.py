# bake_hero_sheet.py — prepara uno SPRITE SHEET del PERSONAGGIO, registrato sul suo "rig".
#
#     python tools\bake_hero_sheet.py <cartella_frame> <uscita.png> <n1,n2,...> [livelli]
#     python tools\bake_hero_sheet.py "<file1>|<file2>|..." <uscita.png> pose [livelli]
#     python tools\bake_hero_sheet.py <video.mp4> <uscita.png> video:<n1,n2,...> [livelli] [rif=<file>]
#
# Esempi:
#     python tools\bake_hero_sheet.py "assets\spritesheets\hero\crouch" ^
#         assets\spritesheets\hero\hero_crouch_px.png 1,17,21,26,30,35 6
#     python tools\bake_hero_sheet.py "riposo.png|passoA.png|passoB.png" ^
#         assets\spritesheets\hero\hero_crouchwalk_px.png pose 6
#     python tools\bake_hero_sheet.py "...\crouch move\crouch move.mp4" ^
#         assets\spritesheets\hero\hero_crouchwalk_px.png video:74,80,88,94 6 rif=...\Image35.png
#
# QUALE MODO USARE. Il migliore e' il VIDEO, quando c'e': tutti i fotogrammi vengono dalla stessa
# generazione, quindi condividono inquadratura, scala, colori e proporzioni del personaggio, e
# basta una trasformazione sola. Le pose generate una per una sono l'ultima scelta: costano un
# metro (il casco), un allineamento dei colori, e resta comunque la testa disegnata un po'
# diversa da una generazione all'altra.
#
# PERCHE' NON BASTA bake_sheet.py. Quello serve ai NEMICI: ritaglia il riquadro comune e
# ridimensiona, e va benissimo perche' ogni nemico e' un'immagine a se'. Il personaggio no: ha
# gia' quattro animazioni in gioco (fermo, camminata, corsa, salto) tutte in celle 84x84 con
# **i piedi al 86% dell'altezza della cella** (GameScene: HERO_ORIGIN_Y = 0.86) e il corpo alto
# 62px. Una nuova animazione baked "a modo suo" farebbe SALTARE il personaggio di qualche pixel
# ogni volta che si passa da un'animazione all'altra — il difetto piu' visibile che ci sia.
# Qui invece si costringe il disegno DENTRO quel rig, con UNA sola trasformazione valida per
# tutti i frame (se ogni frame venisse adattato per conto suo, il movimento sparirebbe).
#
# COSA FA:
# 1. SCONTORNA il fondo quasi nero partendo dai BORDI (riempimento a macchia d'olio). Non si usa
#    una semplice soglia: i contorni e gli scarponi del personaggio sono scuri quanto il fondo e
#    verrebbero mangiati. Partendo dal bordo si toglie solo il fondo, che e' tutto attaccato.
#    (I fogli dei nemici arrivano gia' trasparenti; questi di Claude Design no.)
# 2. ANCORA sul PRIMO frame scelto — che deve essere la posa in piedi: se ne prendono il centro
#    orizzontale e la linea dei piedi, e da li' si ricava una scala unica (corpo alto ALTO_RIF).
# 3. INCOLLA ogni frame nella cella con la stessa trasformazione, piedi sulla linea del rig.
# 4. POSTERIZZA i colori (stessa formula di bake_sprite.ps1 e bake_sheet.py).
import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

CELLA = 84        # lato della cella, come le altre animazioni del personaggio
ALTO_RIF = 62     # altezza del corpo dentro la cella (misurata su hero_idle_px)
PIEDI_Y = 72      # linea dei piedi dentro la cella (= 0.86 * 84, vedi HERO_ORIGIN_Y)
FONDO = 60        # sopra questo valore un pixel non e' piu' "fondo nero"


def scontorna(percorso):
    """Fondo -> trasparente, partendo dai bordi. Restituisce l'immagine RGBA."""
    return scontorna_immagine(Image.open(percorso).convert("RGBA"))


def scontorna_immagine(im):
    """Come sopra ma su un'immagine gia' in memoria (serve ai fotogrammi tirati fuori dal video)."""
    a = np.array(im)
    scuro = a[:, :, :3].max(axis=2) <= FONDO
    h, w = scuro.shape
    visto = np.zeros((h, w), bool)
    coda = deque()
    bordo = ([(0, x) for x in range(w)] + [(h - 1, x) for x in range(w)]
             + [(y, 0) for y in range(h)] + [(y, w - 1) for y in range(h)])
    for y, x in bordo:
        if scuro[y, x] and not visto[y, x]:
            visto[y, x] = True
            coda.append((y, x))
    while coda:
        y, x = coda.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and scuro[ny, nx] and not visto[ny, nx]:
                visto[ny, nx] = True
                coda.append((ny, nx))
    a[:, :, 3] = np.where(visto, 0, 255)
    return Image.fromarray(a)


def riquadro(im):
    a = np.array(im)[:, :, 3]
    ys, xs = np.nonzero(a > 40)
    return xs.min(), ys.min(), xs.max(), ys.max()


FASCIA_CASCO = 0.07   # quanta parte dell'altezza guardare per misurare il casco
CASCO_RIF = 13.8      # larghezza del casco dentro la cella 84x84 (vedi sotto)


def casco(im):
    """Larghezza e centro del CASCO. E' l'unico pezzo RIGIDO del personaggio: non si deforma con
    la posa, quindi fa da metro per rimettere in scala pose disegnate in generazioni diverse (che
    arrivano con inquadrature e dimensioni tutte diverse).

    ⚠️ La fascia e' il 7% dell'altezza, non di piu': lo ZAINO sporge alla stessa altezza del
    casco e da lì in giu' inquina la misura. Verifica usata per sceglierlo: due frame della
    STESSA generazione (che quindi devono dare lo stesso numero) misurano 278 e 278 al 7%, ma
    291 e 425 al 10%. Sotto il 5% resta troppo poco disegno e la misura balla.

    CASCO_RIF viene da lì: il casco misura 278px nella posa in piedi originale, che il rig
    rimpicciolisce di 0,0496 per portarla a 62px di statura -> 278 x 0,0496 = 13,8px nella cella.
    """
    a = np.array(im)[:, :, 3]
    ys, xs = np.nonzero(a > 40)
    cima, fondo = ys.min(), ys.max()
    banda = a[cima:cima + max(1, round((fondo - cima) * FASCIA_CASCO))]
    bx = np.nonzero(banda > 40)[1]
    return bx.max() - bx.min() + 1, (bx.min() + bx.max()) / 2


def allinea_colore(im, rif):
    """Porta i colori di `im` sulle stesse statistiche di `rif` (media e scarto, canale per
    canale, contando solo i pixel opachi).

    Serve perche' pose generate in momenti diversi tornano con una resa diversa: le due pose del
    passo misuravano saturazione media 110 contro 61 della posa gia' in gioco — stesso vestito,
    ma molto piu' acceso. Alternandole nel ciclo si vedeva lampeggiare il personaggio. La media
    da sola non bastava (era gia' simile): quello che cambia e' il CONTRASTO, cioe' lo scarto."""
    a = np.array(im).astype(float)
    op = np.array(im)[:, :, 3] > 40
    r = np.array(rif).astype(float)
    opr = np.array(rif)[:, :, 3] > 40
    for c in range(3):
        m, s = a[:, :, c][op].mean(), a[:, :, c][op].std()
        mr, sr = r[:, :, c][opr].mean(), r[:, :, c][opr].std()
        if s < 1e-6:
            continue
        a[:, :, c] = np.clip((a[:, :, c] - m) * (sr / s) + mr, 0, 255)
    return Image.fromarray(a.astype(np.uint8))


def lut_di(livelli):
    if livelli < 2:
        return None
    return [round(round((v / 255) * (livelli - 1)) * (255 / (livelli - 1))) for v in range(256)]


def scontorna_registrazione(im):
    """Scontorno per i fotogrammi presi da una REGISTRAZIONE DI SCHERMO.

    Qui non va bene lo scontorno normale, per due motivi visti sul video dell'accovacciamento:
    1. il fondo non e' nero ma il grigio dell'interfaccia (~30,31,34), mentre i CONTORNI del
       personaggio sono quasi neri (<=20). Accettando come fondo "tutto cio' che e' scuro" la
       macchia d'olio entrava nel personaggio seguendo i contorni e lo bucava.
       Rimedio: si considera fondo solo cio' che ASSOMIGLIA al grigio del bordo (tolleranza
       stretta), cosi' la macchia si ferma sul contorno nero invece di attraversarlo.
    2. la registrazione ha una FILIGRANA chiara in un angolo, che sopravvive allo scontorno e
       gonfia il riquadro sempre allo stesso modo (si vedeva: tutti i fotogrammi uscivano
       identici, 43x56).
       Rimedio: dei pezzi rimasti si tiene solo il piu' GRANDE, che e' il personaggio.

    NB: qui NON si usa la macchia d'olio dai bordi ma si classifica ogni pixel per COLORE. La
    macchia lascerebbe pieni i buchi CHIUSI — e ce n'e' uno grosso: l'ansa del tubo che esce
    dallo zaino. Il suo interno e' fondo a tutti gli effetti, ma essendo circondato dal tubo la
    macchia non ci arriva, e a schermo restava un grumo scuro dietro al personaggio.
    """
    from scipy import ndimage
    a = np.array(im)
    rgb = a[:, :, :3].astype(int)
    bordo = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
    colore = np.median(bordo, axis=0)
    simile = (np.abs(rgb - colore).max(axis=2) <= 14)

    pezzi, quanti = ndimage.label(~simile)
    if quanti > 1:
        aree = ndimage.sum(np.ones_like(pezzi), pezzi, range(1, quanti + 1))
        tieni = int(np.argmax(aree)) + 1
        soggetto = pezzi == tieni
    else:
        soggetto = ~simile
    a[:, :, 3] = np.where(soggetto, 255, 0)
    return Image.fromarray(a)


def leggi_video(percorso, numeri):
    """Tira fuori da un mp4 i fotogrammi chiesti, gia' scontornati.

    Perche' passare dal video invece che da immagini singole: i fotogrammi di un video vengono
    TUTTI dalla stessa generazione, quindi condividono inquadratura, scala, colori e proporzioni
    del personaggio. Le pose generate una per una no — e rimetterle in riga costa un metro
    (il casco), un allineamento dei colori, e resta comunque la testa disegnata un po' diversa."""
    import imageio_ffmpeg
    it = imageio_ffmpeg.read_frames(str(percorso))
    meta = next(it)
    w, h = meta["size"]
    voluti = set(numeri)
    grezzi = {}
    for i, f in enumerate(it):
        if i in voluti:
            grezzi[i] = np.frombuffer(f, np.uint8).reshape(h, w, 3).copy()
        if len(grezzi) == len(voluti):
            break
    mancanti = voluti - set(grezzi)
    if mancanti:
        raise SystemExit(f"il video non arriva ai fotogrammi {sorted(mancanti)}")
    return [scontorna_registrazione(Image.fromarray(grezzi[n]).convert("RGBA")) for n in numeri]


def monta_video(frame, numeri, uscita, livelli, rif=None, alto=None):
    """Fotogrammi da video: UNA sola scala per tutti (se no il movimento sparisce); in orizzontale
    uno spostamento unico, cosi' resta l'ondeggio del corpo; in verticale ogni fotogramma appoggia
    sulla stessa linea di terra, se no il personaggio sembra affondare e riemergere camminando.

    La SCALA: `alto=<px>` dice quanto deve venire alto il personaggio nel PRIMO fotogramma, ed e'
    il modo da preferire. Il metro del casco (usato per le pose singole) qui non regge: nel video
    il personaggio e' piu' accovacciato, quindi la cima dello ZAINO finisce dentro la fascia che
    dovrebbe misurare solo il casco e la falsa (176px invece di ~124). Con `alto` il numero lo si
    ricava una volta confrontando col fotogramma equivalente dell'accovacciamento e si verifica
    a occhio, invece di dipendere da una misura fragile."""
    lut = lut_di(livelli)
    if rif is not None:
        frame = [allinea_colore(f, rif) for f in frame]

    if alto:
        x0, y0, x1, y1 = riquadro(frame[0])
        scala = alto / (y1 - y0 + 1)
        print(f"personaggio {y1-y0+1}px -> {alto}px (scala {scala:.4f})")
    else:
        largo0, _ = casco(frame[0])
        scala = CASCO_RIF / largo0
        print(f"casco {largo0}px -> {CASCO_RIF} (scala {scala:.4f})")

    foglio = Image.new("RGBA", (CELLA * len(frame), CELLA), (0, 0, 0, 0))
    dx = None
    for i, im in enumerate(frame):
        r = im.resize((max(1, round(im.width * scala)), max(1, round(im.height * scala))), Image.LANCZOS)
        if lut:
            rr, gg, bb, aa = r.split()
            r = Image.merge("RGBA", (rr.point(lut), gg.point(lut), bb.point(lut), aa))
        _, _, _, piedi = riquadro(r)
        if dx is None:                       # deciso UNA volta sul primo: l'ondeggio resta
            _, c = casco(r)
            dx = CELLA / 2 - c
        foglio.alpha_composite(r, (round(i * CELLA + dx), round(PIEDI_Y - piedi)))

    uscita.parent.mkdir(parents=True, exist_ok=True)
    foglio.save(uscita)
    print(f"OK -> {uscita}   {len(frame)} fotogrammi da {CELLA}x{CELLA}   "
          f"{uscita.stat().st_size // 1024} KB")
    a = np.array(Image.open(uscita))[:, :, 3]
    for i, n in enumerate(numeri):
        cel = a[:, i * CELLA:(i + 1) * CELLA]
        ys, xs = np.nonzero(cel > 40)
        print(f"  video {n:3d}: testa y={ys.min():2d}  piedi y={ys.max():2d}  "
              f"altezza {ys.max()-ys.min()+1:2d}  largh {xs.max()-xs.min()+1:2d}")
    return 0


def monta_pose(frame, sorgenti, uscita, livelli):
    """Pose generate SEPARATAMENTE: ognuna rimessa in scala sul CASCO e riallineata su piedi +
    centro del casco, cosi' testa e busto restano fermi e si muovono solo le gambe.

    Perche' il casco e non l'altezza: in una camminata il corpo si abbassa quando le gambe si
    aprono. Usare l'altezza come metro schiaccerebbe proprio quel movimento — che e' l'unica cosa
    che vogliamo vedere."""
    lut = lut_di(livelli)
    casco_rif = CASCO_RIF

    foglio = Image.new("RGBA", (CELLA * len(frame), CELLA), (0, 0, 0, 0))
    for i, im in enumerate(frame):
        if i > 0:
            im = allinea_colore(im, frame[0])   # la prima posa detta la resa a tutte le altre
        largo, _ = casco(im)
        s = casco_rif / largo
        r = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
        if lut:
            rr, gg, bb, aa = r.split()
            r = Image.merge("RGBA", (rr.point(lut), gg.point(lut), bb.point(lut), aa))
        _, cx = casco(r)                                  # centro del casco DOPO il ridimensionamento
        _, _, _, piedi = riquadro(r)
        foglio.alpha_composite(r, (round(i * CELLA + CELLA / 2 - cx), round(PIEDI_Y - piedi)))
        print(f"  {sorgenti[i].name[:34]:34s} casco {largo}px -> {round(casco_rif)} (scala {s:.3f})")

    uscita.parent.mkdir(parents=True, exist_ok=True)
    foglio.save(uscita)
    print(f"OK -> {uscita}   {len(frame)} pose da {CELLA}x{CELLA}   "
          f"{uscita.stat().st_size // 1024} KB")
    a = np.array(Image.open(uscita))[:, :, 3]
    for i in range(len(frame)):
        cel = a[:, i * CELLA:(i + 1) * CELLA]
        ys, xs = np.nonzero(cel > 40)
        print(f"  posa {i}: testa y={ys.min():2d}  piedi y={ys.max():2d}  "
              f"altezza {ys.max()-ys.min()+1:2d}  largh {xs.max()-xs.min()+1:2d}")
    return 0


def main():
    if len(sys.argv) < 4:
        print(__doc__)
        return 2
    uscita = Path(sys.argv[2])
    livelli = int(sys.argv[4]) if len(sys.argv) > 4 else 0

    # DUE MODI, perche' i disegni arrivano in due modi diversi.
    # - una CARTELLA + i numeri dei frame: e' un'animazione generata tutta insieme, quindi tutti i
    #   frame condividono inquadratura e dimensione e va applicata UNA sola trasformazione (se se
    #   ne applicasse una per frame, il movimento — che sta proprio nello scorrimento dentro la
    #   cella — verrebbe annullato e resterebbe un tremolio).
    # - dei FILE separati (terzo argomento "pose"): ogni posa e' stata generata per conto suo, con
    #   inquadratura e dimensione sue, quindi ognuna va rimessa in scala e riallineata. Il metro e'
    #   il CASCO (rigido); l'allineamento e' la linea dei piedi e il centro del casco, cosi' testa
    #   e busto restano fermi e si muovono solo le gambe.
    terzo = sys.argv[3].strip()
    modo_pose = terzo.lower() == "pose"
    modo_video = terzo.lower().startswith("video:")

    # riferimento per allineare i colori (facoltativo): rif=<file>
    rif, alto = None, None
    for arg in sys.argv[5:]:
        if arg.startswith("rif="):
            rif = scontorna(Path(arg[4:]))
        elif arg.startswith("alto="):
            alto = int(arg[5:])

    if modo_video:
        numeri = [int(n) for n in terzo.split(":", 1)[1].split(",")]
        video = Path(sys.argv[1])
        if not video.exists():
            print(f"MANCA: {video}")
            return 1
        return monta_video(leggi_video(video, numeri), numeri, uscita, livelli, rif, alto)

    if modo_pose:
        sorgenti = [Path(p) for p in sys.argv[1].split("|")]
    else:
        cartella = Path(sys.argv[1])
        sorgenti = [cartella / f"Image{int(n)}.png" for n in terzo.split(",")]

    frame = []
    for p in sorgenti:
        if not p.exists():
            print(f"MANCA: {p}")
            return 1
        frame.append(scontorna(p))

    if modo_pose:
        return monta_pose(frame, sorgenti, uscita, livelli)

    # ANCORAGGIO sul PRIMO frame (che dev'essere la posa in piedi). La scala e l'allineamento si
    # RIMISURANO sul risultato invece di fidarsi del calcolo: ridimensionando da 1300px a 62 il
    # bordo si ammorbidisce e un paio di righe di pixel scendono sotto la soglia, quindi il corpo
    # veniva 60px invece di 62 e i piedi finivano 3px sopra la linea del rig — abbastanza da far
    # "saltare" il personaggio passando da un'animazione all'altra, cioe' proprio il difetto che
    # questo strumento esiste per evitare.
    x0, y0, x1, y1 = riquadro(frame[0])
    scala = ALTO_RIF / (y1 - y0 + 1)
    for _ in range(6):
        prova = frame[0].resize((max(1, round(frame[0].width * scala)),
                                 max(1, round(frame[0].height * scala))), Image.LANCZOS)
        px0, py0, px1, py1 = riquadro(prova)
        alto = py1 - py0 + 1
        if alto == ALTO_RIF:
            break
        scala *= ALTO_RIF / alto
    centro, piedi = (px0 + px1) / 2, py1        # misurati DOPO il ridimensionamento
    print(f"posa in piedi: {x1-x0+1}x{y1-y0+1}px -> scala {scala:.4f} "
          f"= corpo {alto}px (voluto {ALTO_RIF}), piedi a y={PIEDI_Y} nella cella {CELLA}")

    lut = lut_di(livelli)

    foglio = Image.new("RGBA", (CELLA * len(frame), CELLA), (0, 0, 0, 0))
    for i, im in enumerate(frame):
        nuovo = (max(1, round(im.width * scala)), max(1, round(im.height * scala)))
        r = im.resize(nuovo, Image.LANCZOS)
        if lut:
            rr, gg, bb, aa = r.split()
            r = Image.merge("RGBA", (rr.point(lut), gg.point(lut), bb.point(lut), aa))
        # stessa trasformazione per tutti: il movimento del disegno resta intatto
        dx = round(i * CELLA + CELLA / 2 - centro)
        dy = round(PIEDI_Y - piedi)
        foglio.alpha_composite(r, (dx, dy))

    uscita.parent.mkdir(parents=True, exist_ok=True)
    foglio.save(uscita)
    print(f"OK -> {uscita}   {len(frame)} frame da {CELLA}x{CELLA}   "
          f"{uscita.stat().st_size // 1024} KB")
    # controllo: dove finiscono davvero i piedi e la testa di ogni frame
    a = np.array(Image.open(uscita))[:, :, 3]
    for i in range(len(frame)):
        cel = a[:, i * CELLA:(i + 1) * CELLA]
        ys, xs = np.nonzero(cel > 40)
        print(f"  {sorgenti[i].stem:>9s}: testa y={ys.min():2d}  piedi y={ys.max():2d}  "
              f"altezza {ys.max()-ys.min()+1:2d}  largh {xs.max()-xs.min()+1:2d}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
