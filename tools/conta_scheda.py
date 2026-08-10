# conta_scheda.py — misura i testi della scheda di Google Play e li confronta coi limiti.
#
#     python tools\conta_scheda.py
#
# Serve perche' i limiti di Play sono rigidi (il campo non si salva, se si sfora) e a contare i
# caratteri a occhio si sbaglia di brutto: la prima stesura dichiarava 1638 caratteri su una
# descrizione che ne ha 2148.
import re
import sys
from pathlib import Path

SCHEDA = Path(__file__).resolve().parent.parent / "docs/store/testi-scheda.md"
# nell'ordine in cui compaiono nel documento
CAMPI = [
    ("nome IT", 30), ("descrizione breve IT", 80), ("descrizione completa IT", 4000),
    ("nome EN", 30), ("descrizione breve EN", 80), ("descrizione completa EN", 4000),
    # Note di rilascio: Play le chiede a ogni caricamento, 500 caratteri per lingua.
    ("note prova IT", 500), ("note prova EN", 500),
    ("note 1.0.0 IT", 500), ("note 1.0.0 EN", 500),
]


def main():
    testi = re.findall(r"```\n(.*?)\n```", SCHEDA.read_text(encoding="utf-8"), re.S)
    if len(testi) < len(CAMPI):
        print(f"trovati {len(testi)} testi, ne servono {len(CAMPI)}: il documento e' cambiato?")
        return 1
    print(f"{'campo':26s} {'caratteri':>10} {'limite':>8}   esito")
    problemi = 0
    for (nome, limite), testo in zip(CAMPI, testi):
        n = len(testo)
        ok = n <= limite
        problemi += 0 if ok else 1
        print(f"{nome:26s} {n:10d} {limite:8d}   {'ok' if ok else 'SFORA, Play lo rifiuta'}")
    return 1 if problemi else 0


if __name__ == "__main__":
    sys.exit(main())
