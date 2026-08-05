# fai_copertina.py — l'IMMAGINE DI COPERTINA per la scheda su Google Play (1024x500).
#
#     python tools\fai_copertina.py [uscita.png]
#
# Play la mostra in cima alla scheda e nelle raccolte. Regole che vincolano il disegno:
#   · misura fissa 1024x500, senza trasparenza;
#   · viene RITAGLIATA in modo diverso a seconda di dove compare, quindi niente di importante
#     vicino ai bordi: titolo e personaggio stanno dentro a un margine di sicurezza;
#   · non deve sembrare una schermata del gioco con l'interfaccia sopra, ne' contenere scritte
#     tipo "scarica ora" o finti pulsanti.
#
# Si costruisce dai materiali VERI del gioco (gli stessi strati di sfondo e lo stesso disegno del
# personaggio), non da roba fatta apposta: cosi' chi la vede sullo store riconosce il gioco che
# poi si trova installato.
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

RADICE = Path(__file__).resolve().parent.parent
L, A = 1024, 500
MARGINE = 60          # zona di sicurezza ai bordi: qui dentro non ci va niente di essenziale

ORO = (255, 209, 102)
ORO_SCURO = (140, 96, 26)
CREMA = (255, 247, 232)


def carica_font(nomi, misura):
    for n in nomi:
        p = Path("C:/Windows/Fonts") / n
        if p.exists():
            return ImageFont.truetype(str(p), misura)
    return ImageFont.load_default()


def personaggio(alto):
    """Il personaggio, preso dal RITRATTO DELL'ICONA — che ha gia' la trasparenza giusta.

    ⚠️ QUESTA E' LA LEZIONE PIU' UTILE DI TUTTA LA COPERTINA: non rifare uno scontorno che
    qualcun altro ha gia' fatto bene. Partendo dal disegno grande su fondo nero
    (`gunpose-straight.png`) sono usciti TRE risultati sbagliati di fila:
      1. un rettangolo NERO attorno al personaggio — avevo dato per scontato il fondo magenta
         come negli altri disegni, e quello e' su nero;
      2. un francobollo blu ingrandito — col fondo nero i contorni scuri spezzano il personaggio
         in decine di pezzi, e "tieni il pezzo piu' grande" ne tiene uno solo;
      3. la montatura degli occhialini TRASPARENTE (segnalato dall'utente) — il riempimento dai
         bordi viaggia lungo i contorni, che sono neri quanto il fondo, ed entra a mangiarsi i
         dettagli interni.
    Provato anche lo sprite del gioco: trasparenza perfetta, ma e' 46x63 pixel e ingrandito per la
    copertina viene un mattone.
    Il ritratto dell'icona risolve tutto: `tools/fai_icone.py` lo ha gia' scontornato una volta
    sola e con cura, e' grande abbastanza, ed e' la stessa faccia che si vede sull'icona dell'app —
    quindi la scheda sullo store e l'icona si somigliano, che e' come dovrebbe essere.
    """
    ritratto = Image.open(RADICE / "android-res/mipmap-xxxhdpi/ic_launcher_foreground.png").convert("RGBA")
    pg = ritratto.crop(ritratto.getbbox())      # via il bordo trasparente della zona di sicurezza
    return pg.resize((round(pg.width * alto / pg.height), alto), Image.LANCZOS)


def sfondo():
    """I tre strati del condotto, gli stessi che scorrono in gioco."""
    base = Image.open(RADICE / "assets/backgrounds/2/bg2_far.jpg").convert("RGBA")
    fondo = base.resize((L, round(base.height * L / base.width)), Image.LANCZOS)
    tela = Image.new("RGBA", (L, A), (40, 12, 30, 255))
    tela.alpha_composite(fondo, (0, (A - fondo.height) // 2))
    for nome, dx, scala in [("bg2_mid.png", -40, 1.15), ("bg2_near.png", 30, 1.35)]:
        s = Image.open(RADICE / f"assets/backgrounds/2/{nome}").convert("RGBA")
        larg = round(L * scala)
        s = s.resize((larg, round(s.height * larg / s.width)), Image.LANCZOS)
        tela.alpha_composite(s, (dx, A - s.height + 40))
    return tela


def scurisci_per_il_testo(tela, fino_a):
    """Velo scuro a sinistra: senza, il titolo chiaro finisce sopra al rosa chiaro e non si legge."""
    velo = Image.new("RGBA", (L, A), (0, 0, 0, 0))
    d = ImageDraw.Draw(velo)
    for x in range(fino_a):
        # sfuma da opaco a trasparente, cosi' non si vede il bordo del velo
        alpha = int(190 * max(0.0, 1 - (x / fino_a) ** 1.6))
        d.line([(x, 0), (x, A)], fill=(24, 6, 18, alpha))
    tela.alpha_composite(velo)


def testo_con_bordo(d, xy, testo, font, colore, bordo, spessore, ancora="lm"):
    d.text(xy, testo, font=font, fill=bordo, anchor=ancora, stroke_width=spessore, stroke_fill=bordo)
    d.text(xy, testo, font=font, fill=colore, anchor=ancora)


def main():
    uscita = Path(sys.argv[1]) if len(sys.argv) > 1 else RADICE / "docs/store/copertina.png"
    uscita.parent.mkdir(parents=True, exist_ok=True)

    tela = sfondo()
    scurisci_per_il_testo(tela, 620)

    # --- il personaggio, a destra, grande. Ombra dietro per staccarlo dallo sfondo carnoso.
    # ⚠️ Sta TUTTO dentro al margine di sicurezza, mano tesa compresa: Play ritaglia la copertina
    # in modo diverso a seconda di dove la mostra, e un braccio che tocca il bordo li' sparisce.
    pg = personaggio(392)
    alt = pg.height
    px, py = L - MARGINE - pg.width, A - alt - MARGINE // 2
    ombra = Image.new("RGBA", pg.size, (0, 0, 0, 0))
    ombra.paste((0, 0, 0, 150), (0, 0), pg)
    ombra = ombra.filter(ImageFilter.GaussianBlur(9))
    tela.alpha_composite(ombra, (px + 8, py + 8))
    tela.alpha_composite(pg, (px, py))

    d = ImageDraw.Draw(tela)
    # --- titolo. Consolas Bold: e' la stessa famiglia monospazio usata dal gioco a schermo.
    f_titolo = carica_font(["consolab.ttf", "arialbd.ttf"], 108)
    f_sotto = carica_font(["consolab.ttf", "arialbd.ttf"], 34)
    f_riga = carica_font(["consolab.ttf", "arialbd.ttf"], 26)

    testo_con_bordo(d, (MARGINE, 168), "WAXOUT", f_titolo, ORO, (26, 8, 18), 6, "lm")
    testo_con_bordo(d, (MARGINE + 5, 236), "The Earwax War", f_sotto, CREMA, (26, 8, 18), 4, "lm")

    # filo dorato sotto al titolo: chiude il blocco di testo e da' ordine
    d.line([(MARGINE + 4, 268), (MARGINE + 430, 268)], fill=ORO_SCURO, width=3)

    testo_con_bordo(d, (MARGINE + 5, 306), "Pulisci il condotto.", f_riga, CREMA, (26, 8, 18), 4, "lm")
    testo_con_bordo(d, (MARGINE + 5, 342), "Sopravvivi al cerume.", f_riga, ORO, (26, 8, 18), 4, "lm")

    tela.convert("RGB").save(uscita, quality=95)
    print(f"copertina salvata: {uscita}  ({L}x{A})")
    dentro = px >= MARGINE and px + pg.width <= L - MARGINE and py + alt <= A - 20
    print(f"margine di sicurezza {MARGINE}px: personaggio da x={px} a x={px + pg.width}, "
          f"base a y={py + alt} -> {'dentro' if dentro else 'FUORI, da correggere'}")


if __name__ == "__main__":
    main()
