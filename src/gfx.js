// GameGfx: rendering ed effetti visivi del gioco, SEPARATI dalla logica di gameplay
// (che resta in GameScene.js). Ogni funzione riceve la scena come primo argomento e
// disegna usando le sue API (scene.add, scene.tweens, ...). Tenere la grafica qui e il
// gameplay in GameScene permette di lavorarci in parallelo da due sessioni senza
// pestarsi i piedi: la sessione "grafica" tocca questo file, quella "gameplay" l'altro.
//
// GameScene mantiene piccoli metodi-richiamo di una riga (es. drawWax() ->
// GameGfx.drawWax(this)) cosi' i punti di chiamata nel gameplay restano invariati.
window.GameGfx = {

  // ---------- Sfondo ----------

  // Condotto uditivo "a tunnel": parete scura + ellissi concentriche verso la luce del
  // timpano (in fondo a destra), anelli di profondita', pieghe carnose e alone che respira.
  drawBackground(scene) {
    const WW = scene.worldW, H = window.CONFIG.HEIGHT, C = window.CONFIG.COLORS;
    const g = scene.add.graphics().setDepth(-10);

    // Il timpano (luce) e' in fondo a destra: il condotto schiarisce mentre avanzi.
    const cx = WW - 220, cy = H * 0.46;

    // Parete scura del condotto (base). Si estende oltre i bordi alto/basso del mondo
    // cosi' il tremolio della telecamera non scopre mai aree vuote.
    g.fillStyle(0x5e3528, 1);
    g.fillRect(0, -180, WW, H + 360);

    // Gradiente "a tunnel": ellissi concentriche dal buio (ingresso, sinistra) alla
    // luce calda in fondo (timpano, destra). La piu' grande copre tutto il mondo.
    const cols = [0x6e3f30, 0x7c4736, 0x8d5340, 0xa5654b, 0xbb7657, 0xd08c67, 0xe2a578, 0xf0c293, 0xf8d8b0];
    const n = cols.length;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);                       // 0 = esterno/buio, 1 = interno/luce
      const rx = (WW * 1.08) * (1 - t) + 130 * t;
      const ry = (H * 1.15) * (1 - t) + 50 * t;
      g.fillStyle(cols[i], 1);
      g.fillEllipse(cx, cy, rx, ry);
    }

    // Anelli di profondita del condotto (sottili e scuri).
    g.lineStyle(6, 0x4f2c20, 0.12);
    for (let i = 1; i <= 6; i++) g.strokeEllipse(cx, cy, WW * 0.16 * i, H * 0.22 * i);

    // Pieghe carnose lungo i bordi, ripetute per tutta la lunghezza.
    g.fillStyle(0x5a3322, 0.14);
    for (let x = 120; x < WW; x += 280) {
      g.fillEllipse(x, 64, 360, 70);
      g.fillEllipse(x + 140, H - 64, 360, 70);
    }

    // Alone luminoso del timpano che "respira".
    scene.bgGlow = scene.add.ellipse(cx, cy, 240, H * 0.5, 0xfbe2bf, 0.22).setDepth(-9);
    scene.tweens.add({
      targets: scene.bgGlow, scaleX: 1.16, scaleY: 1.16, alpha: 0.34,
      duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.inOut',
    });
  },

  // ---------- Muro di cerume ----------

  // Disegna il muro come UN'UNICA massa di cerume gommosa e lucida, sovrapponendo
  // blob arrotondati ai blocchi (cosi i bordi si fondono e non si vede piu il reticolo).
  // Richiamata a ogni colpo per "erodere" la massa col muro.
  drawWax(scene) {
    const g = scene.waxGfx;
    if (!g) return;
    const C = window.CONFIG.COLORS;
    const B = window.CONFIG.BLOCK;
    g.clear();
    const blocks = scene.blocks.getChildren().filter((b) => b.active);
    if (!blocks.length) return;

    const occ = new Set(blocks.map((b) => b.col + ',' + b.row));
    const has = (col, row) => occ.has(col + ',' + row);
    const PAL = {
      soft: [C.waxSoft, C.waxSoftLight, C.waxSoftDark],
      hard: [C.waxHard, C.waxHardLight, C.waxHardDark],
      dirt: [C.dirt, C.dirtLight, C.dirtDark],
    };

    // 1) Ombra/base: blob scuri spostati in basso, danno spessore alla massa.
    blocks.forEach((b) => {
      g.fillStyle(PAL[b.waxType][2], 1);
      g.fillCircle(b.x + 2, b.y + 4, B * 0.80);
    });

    // 2) Gocce che colano dagli sporti (blocco senza nulla sotto).
    blocks.forEach((b) => {
      if (b.row > 0 && !has(b.col, b.row - 1) && b.dripLen > 0) {
        const x = b.x, y0 = b.y + B * 0.40, len = b.dripLen, w = 5;
        g.fillStyle(PAL[b.waxType][2], 1);
        g.fillRect(x - w / 2, y0, w, len);
        g.fillCircle(x, y0 + len, w * 0.9);
        g.fillStyle(PAL[b.waxType][0], 1);
        g.fillRect(x - w / 2 + 1, y0, w - 2, len * 0.7);
      }
    });

    // 3) Corpo principale a colore pieno; piu scuro dove e danneggiato ("livido").
    blocks.forEach((b) => {
      g.fillStyle(PAL[b.waxType][0], 1);
      g.fillCircle(b.x, b.y, B * 0.76);
    });
    blocks.forEach((b) => {
      const t = Phaser.Math.Clamp(b.hp / b.maxHp, 0, 1);
      if (t < 0.98) {
        g.fillStyle(PAL[b.waxType][2], (1 - t) * 0.55);
        g.fillCircle(b.x, b.y, B * 0.70);
      }
    });

    // 4) Riflessi lucidi: bordo superiore e faccia esposta + puntini speculari.
    blocks.forEach((b) => {
      const light = PAL[b.waxType][1];
      if (!has(b.col, b.row + 1)) {           // niente blocco sopra = cresta
        g.fillStyle(light, 0.6);
        g.fillEllipse(b.x - 4, b.y - B * 0.34, B * 0.70, B * 0.34);
      }
      if (!has(b.col + 1, b.row)) {            // niente blocco a sinistra = faccia verso il giocatore
        g.fillStyle(light, 0.28);
        g.fillEllipse(b.x - B * 0.32, b.y, B * 0.26, B * 0.62);
      }
    });
    blocks.forEach((b) => {
      if (!has(b.col, b.row + 1) && !has(b.col + 1, b.row)) {
        g.fillStyle(0xffffff, 0.5);
        g.fillCircle(b.x - B * 0.22, b.y - B * 0.26, 2.6);
      }
    });
  },

  // ---------- Effetti / particelle ----------

  // Piccolo "splat" di feedback quando un pezzo di cerume si stacca.
  splat(scene, x, y, type) {
    const C = window.CONFIG.COLORS;
    const col = { soft: C.waxSoftLight, hard: C.waxHardLight, dirt: C.dirtLight }[type] || C.waxSoftLight;
    const ring = scene.add.circle(x, y, 6, col, 0.7).setDepth(7);
    scene.tweens.add({ targets: ring, scale: 3.4, alpha: 0, duration: 260, ease: 'Quad.out', onComplete: () => ring.destroy() });
  },

  // Esplosione di particelle (briciole di cerume/sporco).
  burst(scene, key, x, y, n) {
    const e = scene.add.particles(x, y, key, {
      speed: { min: 60, max: 210 }, angle: { min: 0, max: 360 },
      lifespan: 450, scale: { start: 1, end: 0 }, gravityY: 520, emitting: false,
    });
    e.setDepth(15);
    e.explode(n, x, y);
    scene.time.delayedCall(700, () => e.destroy());
  },

  // Sbuffo di terriccio/cerume quando qualcosa emerge dal pavimento.
  groundPuff(scene, x, groundTop, big) {
    this.burst(scene, 'bit_dirt', x, groundTop - 4, big ? 18 : 9);
    const C = window.CONFIG.COLORS;
    const mound = scene.add.ellipse(x, groundTop - 2, big ? 70 : 44, big ? 26 : 16, C.dirtDark, 0.8).setDepth(7);
    scene.tweens.add({ targets: mound, scaleX: 1.6, scaleY: 0.2, alpha: 0, duration: 360, ease: 'Quad.out', onComplete: () => mound.destroy() });
  },

  // Filo di cerume che cola dal soffitto sopra al volante mentre scende.
  ceilingDrip(scene, x, restY) {
    const C = window.CONFIG.COLORS;
    const strand = scene.add.rectangle(x, 0, 5, restY + 20, C.waxSoftDark, 0.85).setOrigin(0.5, 0).setDepth(7);
    const blob = scene.add.circle(x, 6, 6, C.waxSoft, 0.9).setDepth(7);
    scene.tweens.add({ targets: [strand], scaleY: 0, alpha: 0, duration: 540, ease: 'Quad.in', onComplete: () => strand.destroy() });
    scene.tweens.add({ targets: [blob], y: 0, scale: 0, alpha: 0, duration: 300, onComplete: () => blob.destroy() });
  },

  // ---------- UI a schermo (effetti) ----------

  // Animazione dell'arma (swab/martello) quando si attacca.
  showWeaponSwing(scene, facing, isHammer) {
    const key = isHammer ? 'hammer' : 'swab';
    const w = scene.add.sprite(scene.player.x + facing * 20, scene.player.y - (isHammer ? 6 : 2), key);
    w.setDepth(20);
    w.setFlipX(facing < 0);
    w.setOrigin(facing > 0 ? 0.05 : 0.95, 0.5);
    const fromAngle = facing > 0 ? -70 : 70;
    const toAngle = facing > 0 ? 45 : -45;
    w.angle = fromAngle;
    scene.tweens.add({
      targets: w, angle: toAngle, duration: 130, ease: 'Quad.out',
      onComplete: () => scene.tweens.add({ targets: w, alpha: 0, duration: 90, onComplete: () => w.destroy() }),
    });
  },

  // Cartello a schermo per annunciare i livelli speciali (boss / sciame).
  showBanner(scene, text, color) {
    const W = window.CONFIG.WIDTH;
    const t = scene.add.text(W / 2, 120, text, {
      fontFamily: 'monospace', fontSize: '24px', color: color || '#ffd166',
      stroke: '#14161f', strokeThickness: 5, align: 'center',
    }).setOrigin(0.5).setDepth(120).setScrollFactor(0).setAlpha(0);
    scene.tweens.add({
      targets: t, alpha: 1, y: 100, duration: 300, ease: 'Back.out',
      onComplete: () => scene.tweens.add({ targets: t, alpha: 0, delay: 1700, duration: 600, onComplete: () => t.destroy() }),
    });
  },
};
