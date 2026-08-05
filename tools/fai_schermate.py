# fai_schermate.py — le SCHERMATE per la scheda su Google Play.
#
#     python tools\fai_schermate.py [cartella_uscita]
#
# Play ne chiede almeno 2 (fino a 8) per telefono, fra 320 e 3840px di lato. Il gioco gira a
# 960x540, quindi si raddoppia a 1920x1080: proporzione da telefono in orizzontale, e la pixel-art
# resta netta perche' il fattore e' esatto (x2, nessuna sfocatura).
#
# ⚠️ Sono schermate VERE, catturate facendo girare il gioco, non fotomontaggi: quello che si vede
# sullo store dev'essere quello che ci si trova installato.
# ⚠️ Ogni scena si prepara in modo DETERMINISTICO (livello scelto, nemici piazzati, personaggio in
# posizione), se no due esecuzioni danno immagini diverse e non si puo' rifarle uguali.
import functools
import http.server
import socket
import socketserver
import sys
import threading
from pathlib import Path

RADICE = Path(__file__).resolve().parent.parent

PREPARA = """
(cfg) => {
  const g = window.game;
  ['UpgradeScene','PauseScene','ShopScene','MenuScene','DoorScene','TaraturaScene'].forEach(k => {
    try { g.scene.stop(k); } catch(e){}
  });
  window.GameState.reset();
  window.GameState.level = cfg.livello;
  window.GameState.prossimoLivello = { kind: cfg.tipo, mutator: null, waxMult: 1 };
  g.scene.start('GameScene');
}
"""

SCENA = """
(cfg) => {
  const gs = window.game.scene.getScene('GameScene');
  if (!gs || !gs.player) return 'non pronta';
  window.GameState.player.hp = Math.round(window.GameState.player.maxHp * 0.72);
  gs.invulnUntil = 1e12;
  if (cfg.fermaSpawn) gs.spawnTimer && gs.spawnTimer.remove();
  const x = Math.round(gs.worldW * cfg.dove);
  gs.player.x = x;
  gs.player.body.reset(x, gs.terrainTopAt(x) - 40);
  gs.facing = 1;
  (cfg.nemici || []).forEach((n, i) => {
    const e = gs.spawnEnemy(n, { x: x + 170 + i * 130 });
    if (e && cfg.subito) { e.spawning = false; }
  });
  return 'pronta';
}
"""

AZIONE = """
(cfg) => {
  const gs = window.game.scene.getScene('GameScene');
  gs.touch.right = !!cfg.cammina;
  gs.touch.aimDown = !!cfg.abbassato;
  gs.touch.sprayHeld = !!cfg.spara;
}
"""

# livello, tipo, dove nel mondo, nemici da mettere, cosa sta facendo il personaggio
SCATTI = [
    ("1-pulizia", dict(livello=3, tipo="normal", dove=0.30, nemici=["blob", "crust"],
                       subito=True, fermaSpawn=True, spara=True)),
    ("2-accovacciato", dict(livello=6, tipo="normal", dove=0.42, nemici=["spit"],
                            subito=True, fermaSpawn=True, spara=True, abbassato=True, cammina=True)),
    ("3-assedio", dict(livello=13, tipo="siege", dove=0.35, nemici=["blob", "blob", "crust"],
                       subito=True, fermaSpawn=False, spara=True)),
    ("4-boss", dict(livello=10, tipo="boss", dove=0.60, nemici=[],
                    subito=False, fermaSpawn=False, spara=True)),
]


class Silenzioso(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def porta_libera():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def main():
    uscita = Path(sys.argv[1]) if len(sys.argv) > 1 else RADICE / "docs/store/schermate"
    uscita.mkdir(parents=True, exist_ok=True)
    from playwright.sync_api import sync_playwright

    porta = porta_libera()
    httpd = socketserver.ThreadingTCPServer(
        ("127.0.0.1", porta), functools.partial(Silenzioso, directory=str(RADICE)))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()

    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, args=["--use-gl=swiftshader", "--mute-audio"])
        # x2 esatto: la pixel-art non si sfoca
        pg = b.new_page(viewport={"width": 960, "height": 540}, device_scale_factor=2)
        pg.on("pageerror", lambda e: print("ERRORE JS:", e))
        pg.goto(f"http://127.0.0.1:{porta}/")
        pg.wait_for_function(
            "() => window.game && window.game.scene "
            "&& window.game.scene.getScenes(true).some(s => s.scene.key === 'MenuScene')",
            timeout=90_000)

        # il MENU e' la prima schermata: e' quello che si vede aprendo il gioco
        pg.wait_for_timeout(2000)
        pg.screenshot(path=str(uscita / "0-menu.png"))
        print("  0-menu")

        for nome, cfg in SCATTI:
            pg.evaluate(PREPARA, cfg)
            pg.wait_for_timeout(2600)          # costruzione del livello + banner d'apertura
            pg.evaluate(SCENA, cfg)
            pg.wait_for_timeout(3000)          # i nemici finiscono di uscire dal terreno
            pg.evaluate(AZIONE, cfg)
            pg.wait_for_timeout(900)
            pg.screenshot(path=str(uscita / f"{nome}.png"))
            print(f"  {nome}")
        b.close()
    httpd.shutdown()

    from PIL import Image
    print()
    for f in sorted(uscita.glob("*.png")):
        im = Image.open(f)
        print(f"  {f.name:22s} {im.size[0]}x{im.size[1]}  {f.stat().st_size // 1024} KB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
