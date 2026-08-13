// Comandi a schermo (touch) per giocare da telefono o tablet.
// window.TouchControls.attach(scene) disegna i pulsanti fissi sullo schermo e
// restituisce un oggetto-stato che GameScene legge nel suo update().
//   - left / right / aimUp / aimDown : direzione corrente (movimento + mira a 8
//     vie). Su mobile sono pilotati dallo STICK analogico virtuale (un solo dito
//     da' anche le diagonali); da tastiera dai tasti.
//   - sprayHeld : true mentre si tiene premuto il tasto Spruzza (getto continuo)
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

  // QUANTO SPAZIO SI PRENDONO LE BARRE DI SISTEMA, in unita' di gioco.
  // Da Android 15 il sistema disegna l'app A TUTTO SCHERMO, barre comprese: senza questa
  // correzione i tasti home/indietro/recenti finiscono SOPRA il pulsante di salto e sopra la
  // leva, e toccandoli si esce dal gioco (segnalato dai tester su Galaxy A34, Android 16).
  // Il browser espone quello spazio con env(safe-area-inset-*), ma solo alla CSS: si misura
  // mettendo un elemento invisibile che usa quei valori come spaziatura e rileggendoli.
  // ⚠️ E' la SECONDA difesa, non la prima: l'app nasconde gia' le barre (vedi
  // android-src/MainActivity.java). Serve per i telefoni in cui quel meccanismo non funziona,
  // e nel momento in cui l'utente le fa ricomparire con una strisciata. Le due difese sono
  // indipendenti apposta: se cade una, l'altra tiene.
  function margineSicurezza(scene) {
    const vuoto = { sx: 0, dx: 0, giu: 0 };
    let css;
    try {
      // Forzatura per le prove: ?safe=40 finge barre da 40px su tutti i lati.
      const q = new URLSearchParams(window.location.search).get('safe');
      if (q !== null) {
        const v = parseFloat(q) || 0;
        css = { sx: v, dx: v, giu: v };
      } else {
        const d = document.createElement('div');
        d.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;'
          + 'padding-left:env(safe-area-inset-left);padding-right:env(safe-area-inset-right);'
          + 'padding-bottom:env(safe-area-inset-bottom)';
        document.body.appendChild(d);
        const s = getComputedStyle(d);
        css = { sx: parseFloat(s.paddingLeft) || 0, dx: parseFloat(s.paddingRight) || 0,
          giu: parseFloat(s.paddingBottom) || 0 };
        d.remove();
      }
    } catch (e) { return vuoto; }
    // Da pixel dello schermo a unita' di gioco: il canvas e' scalato, e displayScale dice
    // quante unita' di gioco vale un pixel a schermo.
    const k = (scene.scale && scene.scale.displayScale) || { x: 1, y: 1 };
    // ⚠️ Con un tetto: una lettura strana non deve poter spingere i comandi in mezzo allo
    // schermo. Meglio una protezione parziale che comandi in un posto assurdo.
    const cap = (v) => Math.min(Math.max(v, 0), 90);
    return { sx: cap(css.sx * k.x), dx: cap(css.dx * k.x), giu: cap(css.giu * k.y) };
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
      jumpHeld: false,                      // tenuto premuto (per il salto ad altezza variabile)
    };
    if (!isTouchDevice(scene)) return state;
    state.enabled = true;

    // Assicura abbastanza "puntatori" per piu dita contemporanee
    // (muovi + mira + salta + spruzza). Idempotente tra un restart e l'altro.
    const need = 5 - scene.input.manager.pointersTotal;
    if (need > 0) scene.input.addPointer(need);

    const W = window.CONFIG.WIDTH, H = window.CONFIG.HEIGHT;
    // Spazio occupato dalle barre di sistema: tutti i comandi si spostano verso l'interno di
    // altrettanto. A barre nascoste vale zero e non cambia niente.
    const M = margineSicurezza(scene);

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

    // SINISTRA: STICK analogico virtuale (muovi + mira a 8 vie con una sola spinta
    // del pollice, anche in diagonale). Piu' fedele al cabinato Metal Slug e risolve
    // l'impossibilita' di fare le diagonali con un solo dito del vecchio pad a frecce.
    // Il pomello segue il dito (sensazione analogica); la direzione viene "agganciata"
    // a 8 vie e tradotta negli stessi flag left/right/aimUp/aimDown letti da GameScene.
    const baseX = 122 + M.sx, baseY = H - 108 - M.giu, R = 66, knobR = 34, DEAD = 0.36;
    const ring = scene.add.circle(baseX, baseY, R, 0xfff7e8, 0.10).setScrollFactor(0).setDepth(DEPTH);
    ring.setStrokeStyle(3, 0xfff7e8, 0.45);
    const knob = scene.add.circle(baseX, baseY, knobR, 0xfff7e8, 0.34).setScrollFactor(0).setDepth(DEPTH + 1);
    knob.setStrokeStyle(2, 0xfff7e8, 0.65);
    // Zona di presa generosa attorno alla base (anche se il dito parte un po' fuori).
    const zone = scene.add.zone(baseX, baseY, R * 2.7, R * 2.7).setScrollFactor(0).setDepth(DEPTH - 1).setInteractive();
    let stickId = null;

    function clearDirs() { state.left = state.right = state.aimUp = state.aimDown = false; }
    function applyVec(dx, dy) {
      const mag = Math.hypot(dx, dy);
      clearDirs();
      if (mag < R * DEAD) return;                       // zona morta centrale
      let a = Math.atan2(dy, dx) * 180 / Math.PI;       // 0 = destra; y verso il basso
      if (a < 0) a += 360;
      const sec = Math.round(a / 45) % 8;               // 8 settori
      if (sec === 0) { state.right = true; }                              // E
      else if (sec === 1) { state.right = true; state.aimDown = true; }   // SE
      else if (sec === 2) { state.aimDown = true; }                       // S
      else if (sec === 3) { state.left = true; state.aimDown = true; }    // SO
      else if (sec === 4) { state.left = true; }                          // O
      else if (sec === 5) { state.left = true; state.aimUp = true; }      // NO
      else if (sec === 6) { state.aimUp = true; }                         // N
      else { state.right = true; state.aimUp = true; }                    // NE
    }
    function moveKnob(px, py) {
      const dx = px - baseX, dy = py - baseY;
      const len = Math.hypot(dx, dy) || 0.0001;
      const cl = Math.min(len, R);
      knob.setPosition(baseX + (dx / len) * cl, baseY + (dy / len) * cl);
      applyVec(dx, dy);
    }
    function releaseStick() { stickId = null; knob.setPosition(baseX, baseY); clearDirs(); }

    zone.on('pointerdown', (pointer) => { window.Sfx.unlock(); stickId = pointer.id; moveKnob(pointer.x, pointer.y); });
    scene.input.on('pointermove', (pointer) => { if (stickId === pointer.id) moveKnob(pointer.x, pointer.y); });
    scene.input.on('pointerup', (pointer) => { if (stickId === pointer.id) releaseStick(); });
    scene.input.on('pointerupoutside', (pointer) => { if (stickId === pointer.id) releaseStick(); });

    // DESTRA: Spruzza (tieni premuto) + Salto (dedicato).
    const ar = 50;
    const bx = W - M.dx, by = H - M.giu;    // angolo in basso a destra, barre escluse
    holdBtn(button(scene, bx - ar * 3 - 30, by - ar - 26, ar, 'spray'), 'sprayHeld');
    // Salto: impulso (jumpQueued) per far partire il salto + stato "tenuto" (jumpHeld)
    // per il salto ad altezza variabile (rilasci presto = saltino, tieni = salto pieno).
    const jumpBtn = button(scene, bx - ar - 22, by - ar - 26, ar, 'jump');
    jumpBtn.on('pointerdown', () => { window.Sfx.unlock(); state.jumpQueued = true; state.jumpHeld = true; press(jumpBtn, true); });
    jumpBtn.on('pointerup', () => { state.jumpHeld = false; press(jumpBtn, false); });
    jumpBtn.on('pointerout', () => { state.jumpHeld = false; press(jumpBtn, false); });

    // Scatto: solo se gia sbloccato (sopra il Salto).
    if (window.GameState.player && window.GameState.player.dash) {
      tapBtn(button(scene, bx - ar - 22, by - ar * 3 - 42, ar * 0.82, 'dash'), 'dashQueued');
    }

    return state;
  }

  return { attach, isTouchDevice };
})();
