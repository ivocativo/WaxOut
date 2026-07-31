# bake_sheet.py — prepara uno SPRITE SHEET animato (nemici, personaggio, ...) per il gioco.
#
#     python tools\bake_sheet.py <sheet.png> <frame> <uscita.png> [larghezza_cella] [livelli]
#
# Esempio:  python tools\bake_sheet.py "cerumino-crawl-256.png" 12 assets\spritesheets\enemies\cerumino_crawl_px.png 116 20
#
# Cosa fa, e perche':
# 1. RITAGLIO UNICO. Cerca il rettangolo che contiene la creatura in TUTTI i frame (unione dei
#    riquadri) e ritaglia ogni cella con QUELLO. Ritagliare ogni frame per conto suo sembra piu'
#    furbo ma rovina l'animazione: la creatura verrebbe ri-centrata a ogni frame e il movimento
#    (che sta proprio nello scorrimento dentro la cella) sparirebbe, lasciando solo un tremolio.
# 2. RIDIMENSIONA vicino alla dimensione a schermo, cosi' il gioco reingrandisce con NEAREST e
#    nasce la grana "pixel" del resto dell'arte (stessa idea di tools\bake_sprite.ps1).
# 3. POSTERIZZA i colori (opzionale) per appiattirli come gli altri sprite.
#
# NB: qui NON si scontorna il magenta — questi sheet arrivano gia' con la trasparenza. Per un
# singolo sprite AI su fondo magenta si usa tools\bake_sprite.ps1.
import sys
from pathlib import Path

from PIL import Image


def main():
    if len(sys.argv) < 4:
        print(__doc__)
        return 2
    sorgente = Path(sys.argv[1])
    n_frame = int(sys.argv[2])
    uscita = Path(sys.argv[3])
    larghezza = int(sys.argv[4]) if len(sys.argv) > 4 else 116
    livelli = int(sys.argv[5]) if len(sys.argv) > 5 else 0
    # --piedi: allinea tutti i frame sulla stessa linea di terra. Serve alle animazioni dove la
    # creatura si abbassa e si alza (salto, accovacciamento): in quei disegni l'autore sposta
    # tutto il corpo verso il basso, e senza allineamento il gioco — che appoggia lo sprite sul
    # terreno per il bordo INFERIORE della cella — farebbe sprofondare la creatura mentre si
    # accovaccia. Allineando i piedi resta a terra e si vede solo lo schiacciamento, che e'
    # esattamente l'effetto voluto. NON usarlo sulle camminate: li' non serve e toglie il passo.
    piedi = "--piedi" in sys.argv

    sheet = Image.open(sorgente).convert("RGBA")
    cella = sheet.width // n_frame
    if sheet.width % n_frame:
        print(f"ATTENZIONE: {sheet.width}px non sono divisibili per {n_frame} frame")

    # 1) riquadro UNICO valido per tutti i frame
    mnx, mny, mxx, mxy = cella, sheet.height, 0, 0
    for i in range(n_frame):
        f = sheet.crop((i * cella, 0, (i + 1) * cella, sheet.height))
        bb = f.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
        if bb is None:
            continue
        mnx, mny = min(mnx, bb[0]), min(mny, bb[1])
        mxx, mxy = max(mxx, bb[2]), max(mxy, bb[3])
    cw, ch = mxx - mnx, mxy - mny
    altezza = max(1, round(ch * (larghezza / cw)))

    # 2) LUT di posterizzazione (stessa formula di bake_sprite.ps1)
    lut = None
    if livelli >= 2:
        lut = [round(round((v / 255) * (livelli - 1)) * (255 / (livelli - 1))) for v in range(256)]

    # Con --piedi ogni frame viene ritagliato con la stessa ALTEZZA ma facendo finire il taglio
    # sui piedi di QUEL frame: le creature restano appoggiate alla stessa linea.
    fondi = []
    if piedi:
        for i in range(n_frame):
            f = sheet.crop((i * cella, 0, (i + 1) * cella, sheet.height))
            bb = f.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
            fondi.append(bb[3] if bb else mxy)

    fuori = Image.new("RGBA", (larghezza * n_frame, altezza), (0, 0, 0, 0))
    for i in range(n_frame):
        if piedi:
            basso = min(sheet.height, fondi[i] + 2)
            alto = basso - ch
            f = sheet.crop((i * cella + mnx, alto, i * cella + mxx, basso))
        else:
            f = sheet.crop((i * cella + mnx, mny, i * cella + mxx, mxy))
        f = f.resize((larghezza, altezza), Image.LANCZOS)
        if lut:
            r, g, b, a = f.split()
            f = Image.merge("RGBA", (r.point(lut), g.point(lut), b.point(lut), a))
        fuori.paste(f, (i * larghezza, 0))

    uscita.parent.mkdir(parents=True, exist_ok=True)
    fuori.save(uscita)
    kb = uscita.stat().st_size // 1024
    print(f"OK -> {uscita}   {n_frame} frame da {larghezza}x{altezza}   {kb} KB")
    print(f"     (riquadro comune nell'originale: {cw}x{ch} a partire da {mnx},{mny})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
