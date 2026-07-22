# schermata.py — salva una schermata del gioco senza dover aprire nessuna finestra.
#
#     python tools\schermata.py [livello] [x] [file.png]
#
# Esempio:  python tools\schermata.py 4 1400 schermata.png
# Utile per giudicare l'aspetto (sfondo, terreno, soffitto) e quando il pannello del preview
# si impunta. Usa lo stesso browser invisibile dei controlli automatici.
import functools
import http.server
import socket
import socketserver
import sys
import threading
from pathlib import Path

RADICE = Path(__file__).resolve().parent.parent


def porta_libera():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def main():
    livello = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    x = sys.argv[2] if len(sys.argv) > 2 else "null"
    uscita = Path(sys.argv[3]) if len(sys.argv) > 3 else RADICE / "schermata.png"

    from playwright.sync_api import sync_playwright

    class Silenzioso(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass

    porta = porta_libera()
    httpd = socketserver.ThreadingTCPServer(
        ("127.0.0.1", porta), functools.partial(Silenzioso, directory=str(RADICE)))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--use-gl=swiftshader", "--mute-audio"])
        pagina = browser.new_page(viewport={"width": 960, "height": 540})
        pagina.goto(f"http://127.0.0.1:{porta}/")
        pagina.wait_for_function(
            "() => window.game && window.game.scene "
            "&& window.game.scene.getScenes(true).some(s => s.scene.key === 'MenuScene')",
            timeout=90_000)
        pagina.evaluate("""([lv, px]) => {
            const g = window.game;
            ['UpgradeScene','PauseScene','ShopScene','MenuScene'].forEach(k => { try { g.scene.stop(k); } catch(e){} });
            window.GameState.reset(); window.GameState.level = lv;
            g.scene.start('GameScene');
            const gs = g.scene.getScene('GameScene');
            let t = g.loop.time;
            const arm = () => { window.GameState.player.hp = 999999; gs.invulnUntil = 1e12; };
            for (let i = 0; i < 20; i++) { t += 16.6; g.loop.step(t); arm(); }
            const x = (px == null) ? Math.round(gs.worldW * 0.35) : px;
            gs.player.x = x; gs.player.body.reset(x, gs.terrainTopAt(x) - 40);
            for (let i = 0; i < 8; i++) { t += 16.6; g.loop.step(t); arm(); }
            g.loop.sleep();                      // congela il fotogramma
        }""", [livello, None if x == "null" else int(x)])
        pagina.screenshot(path=str(uscita))
        browser.close()
    httpd.shutdown()
    print(f"salvata: {uscita}")


if __name__ == "__main__":
    sys.exit(main())
