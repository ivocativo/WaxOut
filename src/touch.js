// Comandi a schermo (touch) per giocare da telefono o tablet.
// window.TouchControls.attach(scene) disegna i pulsanti fissi sullo schermo e
// restituisce un oggetto-stato che GameScene legge nel suo update().
//   - left / right / aimUp / aimDown / sprayHeld : true mentre il dito tiene
//     premuto il pulsante (movimento, mira verticale del getto, spruzzo continuo)
//   - jumpQueued / dashQueued : impulso singolo (consumato e azzerato da update
//     dopo averlo letto)
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
    } else if (type === 'up') {                       // mira in alto
      g.fillTriangle(x, y - s, x - s, y + s * 0.7, x + s, y + s * 0.7);
    } else if (type === 'down') {                     // mira in basso
      g.fillTriangle(x, y + s, x - s, y - s * 0.7, x + s, y - s * 0.7);
    } else if (type === 'jump') {                     // salto: freccia su + base
      g.fillTriangle(x, y - s * 1.1, x - s * 0.85, y, x + s * 0.85, y);
      g.fillRect(x - s * 0.45, y, s * 0.9, s * 0.9);
      g.fillRect(x - s * 0.9, y + s * 0.9, s * 1.8, s * 0.45);
    } else if (type === 'spray') {                    // spruzzo: gocce che si aprono a ventaglio
      g.fillCircle(x - s * 0.7, y + s * 0.5, s * 0.34);
      g.fillCircle(x, y + s * 0.8, s * 0.30);
      g.fillCircle(x + s * 0.7, y + s * 0.5, s * 0.34);
      g.fillCircle(x - s * 0.3, y - s * 0.2, s * 0.26);
      g.fillCircle(x + s * 0.3, y - s * 0.2, s * 0.26);
      g.fillCircle(x, y - s * 0.9, s * 0.22);
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
      aimUp: false, aimDown: false,        // mira verticale del getto
      sprayHeld: false,                     // tenuto premuto = spruzza in continuo
      jumpQueued: false, dashQueued: false, // impulsi singoli
    };
    if (!isTouchDevice(scene)) return state;
    state.enabled = true;

    // Assicura abbastanza "puntatori" per piu dita contemporanee
    // (muovi + mira + salta + spruzza). Idempotente tra un restart e l'altro.
    const need = 5 - scene.input.manager.pointersTotal;
    if (need > 0) scene.input.addPointer(need);

    const W = window.CONFIG.WIDTH, H = window.CONFIG.HEIGHT;

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

    // SINISTRA: pad a croce. Sinistra/Destra muovono; Su/Giu mirano il getto
    // (combinati col movimento danno le diagonali).
    const dr = 40;                          // raggio dei tasti del pad
    const dcx = 116, dcy = H - 112;         // centro della croce
    holdBtn(button(scene, dcx - 58, dcy, dr, 'left'), 'left');
    holdBtn(button(scene, dcx + 58, dcy, dr, 'right'), 'right');
    holdBtn(button(scene, dcx, dcy - 64, dr, 'up'), 'aimUp');
    holdBtn(button(scene, dcx, dcy + 64, dr, 'down'), 'aimDown');

    // DESTRA: Spruzza (tieni premuto) + Salto (dedicato).
    const ar = 50;
    holdBtn(button(scene, W - ar * 3 - 30, H - ar - 26, ar, 'spray'), 'sprayHeld');
    tapBtn(button(scene, W - ar - 22, H - ar - 26, ar, 'jump'), 'jumpQueued');

    // Scatto: solo se gia sbloccato (sopra il Salto).
    if (window.GameState.player && window.GameState.player.dash) {
      tapBtn(button(scene, W - ar - 22, H - ar * 3 - 42, ar * 0.82, 'dash'), 'dashQueued');
    }

    return state;
  }

  return { attach, isTouchDevice };
})();
