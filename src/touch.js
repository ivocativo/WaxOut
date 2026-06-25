// Comandi a schermo (touch) per giocare da telefono o tablet.
// window.TouchControls.attach(scene) disegna i pulsanti fissi sullo schermo e
// restituisce un oggetto-stato che GameScene legge nel suo update().
//   - left / right : true mentre il dito tiene premuto il pad direzionale
//   - jumpQueued / attackQueued / dashQueued : impulso singolo (consumato e
//     azzerato da update dopo averlo letto)
//   - enabled : false su dispositivi senza touch (PC), così GameScene può
//     riattivare il "clic per attaccare" del mouse.
window.TouchControls = (function () {
  const DEPTH = 200;

  function isTouchDevice(scene) {
    // Forzatura per i test: aggiungi ?touch=1 (mostra) o ?touch=0 (nascondi)
    // all'URL per provare i comandi a schermo anche da PC.
    try {
      const q = new URLSearchParams(window.location.search).get('touch');
      if (q === '1') return true;
      if (q === '0') return false;
    } catch (e) { /* ignora */ }
    return ('ontouchstart' in window) ||
      (navigator.maxTouchPoints > 0) ||
      (scene.sys.game.device.input.touch === true);
  }

  // Disegna l'icona del pulsante (vettoriale: indipendente dal font).
  function drawIcon(g, x, y, r, type) {
    const s = r * 0.42;
    g.fillStyle(0xfff7e8, 0.92);
    if (type === 'left') {
      g.fillTriangle(x - s, y, x + s * 0.7, y - s, x + s * 0.7, y + s);
    } else if (type === 'right') {
      g.fillTriangle(x + s, y, x - s * 0.7, y - s, x - s * 0.7, y + s);
    } else if (type === 'up') {
      g.fillTriangle(x, y - s, x - s, y + s * 0.7, x + s, y + s * 0.7);
    } else if (type === 'attack') {
      g.fillPoints([
        new Phaser.Geom.Point(x, y - s * 1.15),
        new Phaser.Geom.Point(x + s * 0.85, y),
        new Phaser.Geom.Point(x, y + s * 1.15),
        new Phaser.Geom.Point(x - s * 0.85, y),
      ], true);
    } else if (type === 'dash') {
      g.fillTriangle(x - s, y - s, x, y, x - s, y + s);
      g.fillTriangle(x, y - s, x + s, y, x, y + s);
    }
  }

  // Crea un pulsante rotondo fisso sullo schermo. Restituisce l'Arc interattivo.
  function button(scene, x, y, r, type) {
    const arc = scene.add.circle(x, y, r, 0xfff7e8, 0.16)
      .setScrollFactor(0).setDepth(DEPTH)
      .setInteractive({ useHandCursor: true });
    arc.setStrokeStyle(3, 0xfff7e8, 0.55);
    const g = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH + 1);
    drawIcon(g, x, y, r, type);
    arc._icon = g;
    return arc;
  }

  function press(arc, on) {
    arc.setFillStyle(0xfff7e8, on ? 0.40 : 0.16);
  }

  function attach(scene) {
    const state = {
      enabled: false,
      left: false, right: false,
      jumpQueued: false, attackQueued: false, dashQueued: false,
    };
    if (!isTouchDevice(scene)) return state;
    state.enabled = true;

    // Assicura abbastanza "puntatori" per piu dita contemporanee
    // (muovi + salta + attacca). Idempotente tra un restart e l'altro.
    const need = 4 - scene.input.manager.pointersTotal;
    if (need > 0) scene.input.addPointer(need);

    const W = window.CONFIG.WIDTH, H = window.CONFIG.HEIGHT;
    const r = 52;
    const bottom = H - r - 18;

    function holdBtn(arc, key) {
      arc.on('pointerdown', () => { window.Sfx.unlock(); state[key] = true; press(arc, true); });
      arc.on('pointerup', () => { state[key] = false; press(arc, false); });
      arc.on('pointerout', () => { state[key] = false; press(arc, false); });
    }
    function tapBtn(arc, key) {
      arc.on('pointerdown', () => { window.Sfx.unlock(); state[key] = true; press(arc, true); });
      arc.on('pointerup', () => press(arc, false));
      arc.on('pointerout', () => press(arc, false));
    }

    // Sinistra: direzioni
    holdBtn(button(scene, r + 22, bottom, r, 'left'), 'left');
    holdBtn(button(scene, r * 3 + 40, bottom, r, 'right'), 'right');

    // Destra: azioni
    tapBtn(button(scene, W - r - 22, bottom, r, 'attack'), 'attackQueued');
    tapBtn(button(scene, W - r * 3 - 40, bottom + 6, r, 'up'), 'jumpQueued');

    // Scatto: solo se gia sbloccato
    if (window.GameState.player && window.GameState.player.dash) {
      tapBtn(button(scene, W - r - 22, bottom - r * 2 - 16, r * 0.82, 'dash'), 'dashQueued');
    }

    return state;
  }

  return { attach, isTouchDevice };
})();
