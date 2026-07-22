# controlla.py — lancia i CONTROLLI AUTOMATICI del gioco con un comando solo.
#
#     python tools\controlla.py
#
# Cosa fa: apre il gioco in un browser invisibile, gli inietta tools/checks.js (dove stanno i
# controlli veri) e stampa l'esito. Esce con codice 0 se e' tutto a posto, 1 se qualcosa e'
# rotto — cosi' un domani lo si puo' agganciare a GitHub e bloccare la build dell'APK.
#
# Serve una tantum:  python -m pip install playwright  &&  python -m playwright install chromium
import functools
import http.server
import socket
import socketserver
import sys
import threading
from pathlib import Path

RADICE = Path(__file__).resolve().parent.parent   # cartella del gioco
CHECKS = RADICE / "tools" / "checks.js"


def porta_libera():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def avvia_server(porta):
    """Serve la cartella del gioco. Silenzioso: senza questo stampa una riga per ogni file."""
    class Silenzioso(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *args):
            pass

    handler = functools.partial(Silenzioso, directory=str(RADICE))
    httpd = socketserver.ThreadingTCPServer(("127.0.0.1", porta), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def main():
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("Manca Playwright. Installalo cosi':")
        print("    python -m pip install playwright")
        print("    python -m playwright install chromium")
        return 2

    if not CHECKS.exists():
        print(f"Non trovo {CHECKS}")
        return 2

    porta = porta_libera()
    httpd = avvia_server(porta)
    url = f"http://127.0.0.1:{porta}/"
    print(f"Gioco servito su {url}")

    errori_console = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--use-gl=swiftshader", "--mute-audio"])
        pagina = browser.new_page(viewport={"width": 960, "height": 540})
        pagina.set_default_timeout(180_000)
        pagina.on("console", lambda m: errori_console.append(m.text) if m.type == "error" else None)
        pagina.on("pageerror", lambda e: errori_console.append(str(e)))

        pagina.goto(url)
        print("Attendo il caricamento del gioco...")
        pagina.wait_for_function(
            "() => window.game && window.game.scene "
            "&& window.game.scene.getScenes(true).some(s => s.scene.key === 'MenuScene')",
            timeout=90_000,
        )

        pagina.add_script_tag(content=CHECKS.read_text(encoding="utf-8"))
        print("Eseguo i controlli (ci vuole un minuto)...\n")
        esito = pagina.evaluate("() => window.__earwaxChecks()")
        browser.close()

    httpd.shutdown()

    # ---- stampa ----
    larghezza = max((len(e["controllo"]) for e in esito["esiti"]), default=20)
    for e in esito["esiti"]:
        segno = "OK   " if e["esito"] == "OK" else "ROTTO"
        liv = f"lv {e['livello']}" if e["livello"] != "-" else "    "
        riga = f"  [{segno}] {e['controllo']:<{larghezza}}  {liv}"
        if e["dettaglio"]:
            riga += f"   {e['dettaglio']}"
        print(riga)

    if errori_console:
        print("\nErrori dalla console del browser:")
        for m in errori_console[:10]:
            print(f"  - {m}")

    falliti = esito["falliti"] + (1 if errori_console else 0)
    print("\n" + "-" * 70)
    if falliti == 0:
        print(f"TUTTO A POSTO — {esito['totale']} controlli superati.")
        return 0
    print(f"ATTENZIONE — {esito['falliti']} controlli falliti su {esito['totale']}.")
    if errori_console:
        print(f"             + {len(errori_console)} errori in console.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
