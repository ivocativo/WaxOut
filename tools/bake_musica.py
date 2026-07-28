# bake_musica.py — prepara i brani per il gioco.
#
#     python tools\bake_musica.py <sorgente.mp3|wav> <uscita.ogg> [qualita] [secondi_max]
#
# Cosa fa e perche':
# 1. CONVERTE in OGG Vorbis. E' il formato che il webview Android legge da solo, e a parita' di
#    ascolto pesa una frazione di un MP3 a 320 kbps o (peggio) di un WAV.
# 2. NORMALIZZA il volume (filtro loudnorm, standard EBU R128). I brani CC0 arrivano da autori
#    diversi e hanno livelli molto lontani tra loro: senza questo passaggio il menu spacca le
#    orecchie e il livello non si sente, e non e' una cosa che si sistema col cursore del volume.
# 3. Toglie i silenzi in testa e in coda e mette una dissolvenza corta: un brano che si ripete
#    all'infinito con mezzo secondo di silenzio in mezzo fa notare la giuntura a ogni giro.
# 4. Opzionale: TAGLIA a N secondi (il menu di solito si guarda per venti secondi, tenere cinque
#    minuti di musica e' peso sprecato).
#
# ffmpeg non serve installarlo: arriva col pacchetto Python imageio-ffmpeg.
import subprocess
import sys
from pathlib import Path

import imageio_ffmpeg


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        return 2
    sorgente = Path(sys.argv[1])
    uscita = Path(sys.argv[2])
    qualita = sys.argv[3] if len(sys.argv) > 3 else "1"      # -q:a di Vorbis (1 ~ 80 kbps stereo)
    secondi = float(sys.argv[4]) if len(sys.argv) > 4 else 0  # 0 = tutto

    exe = imageio_ffmpeg.get_ffmpeg_exe()
    filtri = [
        "silenceremove=start_periods=1:start_threshold=-50dB",   # via il silenzio iniziale
        "loudnorm=I=-16:TP=-1.5:LRA=11",                         # volume uniforme tra i brani
    ]
    cmd = [exe, "-y", "-i", str(sorgente)]
    if secondi > 0:
        cmd += ["-t", str(secondi)]
        filtri.append("afade=t=out:st=%.2f:d=2.5" % max(0.0, secondi - 2.5))   # chiusura morbida
    cmd += ["-af", ",".join(filtri), "-c:a", "libvorbis", "-q:a", qualita, "-ar", "44100", str(uscita)]

    uscita.parent.mkdir(parents=True, exist_ok=True)
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stderr[-1500:])
        return 1
    kb = uscita.stat().st_size // 1024
    print("OK -> %s   %d KB" % (uscita, kb))
    return 0


if __name__ == "__main__":
    sys.exit(main())
