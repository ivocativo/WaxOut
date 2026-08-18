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
import random
import http.server
import socket
import socketserver
import sys
import threading
from pathlib import Path

RADICE = Path(__file__).resolve().parent.parent   # cartella del gioco
CHECKS = RADICE / "tools" / "checks.js"


def porta_libera():
    # Sopra la 2048 e sotto la 32000: Chromium RIFIUTA di aprire una lunga lista di porte
    # "pericolose" (ERR_UNSAFE_PORT) — quasi tutte sotto la 1024 piu' parecchie sparse fino alla
    # 1900 circa. Lasciando scegliere al sistema (porta 0) prima o poi ne esce una bloccata e i
    # controlli falliscono senza motivo: successo due volte di fila il 2026-07-27.
    # ⚠️ SI PROVANO PORTE DELL'INTERVALLO, non si chiede al sistema. Chiedendo al sistema una
    # porta qualsiasi (bind sulla 0) su Windows si ottiene sempre un numero sopra la 49000, che
    # e' fuori dall'intervallo accettato qui: il ciclo non trovava MAI un numero buono e si
    # finiva sempre sul ripiego fisso 8321. Risultato: due esecuzioni dei controlli non potevano
    # coesistere, e la seconda moriva con un errore di socket che sembrava un guasto del gioco
    # (successo il 2026-08-18, due giri persi a cercare un controllo rotto che non esisteva).
    for _ in range(200):
        porta = random.randint(8000, 32000)
        with socket.socket() as s:
            try:
                s.bind(("127.0.0.1", porta))
                return porta
            except OSError:
                continue
    return 8321


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

    # ⚠️ RIPROVARE SE LA PORTA E' OCCUPATA. porta_libera() ne sceglie una libera, la lascia e
    # poi avvia_server la riprende: fra i due momenti qualcun altro puo' portarsela via. Succede
    # sul serio quando girano DUE esecuzioni dei controlli insieme, e allora lo script muore con
    # un errore di socket che sembra un guasto del gioco (successo il 2026-08-18: due giri persi
    # a cercare un controllo rotto che non esisteva).
    httpd = None
    for tentativo in range(6):
        porta = porta_libera()
        try:
            httpd = avvia_server(porta)
            break
        except OSError:
            if tentativo == 5:
                print("Non riesco a prendere una porta libera: c'e' un'altra esecuzione dei "
                      "controlli in corso? Aspetta che finisca e rilancia.")
                return 2
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

        # ATTENZIONE: PRIMA LA SINTASSI, POI TUTTO IL RESTO. Un errore di battitura in checks.js
        # — un apostrofo dentro una stringa basta — rende ILLEGGIBILE l'intero file: nessun
        # controllo gira, e il sintomo e' "window.__earwaxChecks is not a function" con uscita 1,
        # cioe' sembra un controllo fallito quando invece non ne sta girando NEMMENO UNO.
        # Successo il 2026-08-18: due giri a vuoto a cercare il controllo sbagliato.
        # In questo progetto non c'e' Node: la sintassi la si fa verificare al browser, che e'
        # gia' aperto. Costa un istante e dice subito dov'e' il guaio.
        sorgente = CHECKS.read_text(encoding="utf-8")
        errore = pagina.evaluate(
            "(src) => { try { new Function(src); return null; } catch (e) { return e.message; } }",
            sorgente,
        )
        if errore:
            print(f"ERRORE DI SINTASSI in {CHECKS.name}: {errore}")
            print("Nessun controllo e' stato eseguito. Correggi il file e rilancia.")
            browser.close()
            httpd.shutdown()
            return 2

        pagina.add_script_tag(content=sorgente)
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
