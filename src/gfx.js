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
  // Palette "carnosa profonda" (8 tinte, stile Death Trash ma calda): dal buio
  // esterno alla luce del timpano. Usata col dithering per un look PIXEL ART.
  BG_PALETTE: ['#2a1320', '#4e2030', '#7a2f3c', '#a3454a', '#c0625a', '#d6896f', '#e6ac8b', '#f3cca9'],

  // Sfondo del condotto in PIXEL ART: genera una texture a bassa risoluzione (poi
  // ingrandita a pixel netti) con un tunnel carnoso verso il timpano (a destra),
  // sfumato col DITHERING ordinato (Bayer 4x4), pieghe lungo i bordi, gocce e pori.
  drawBackground(scene) {
    const WW = scene.worldW, H = window.CONFIG.HEIGHT;
    const F = 4;                                   // 1 pixel-texture = F pixel a schermo
    const bw = Math.ceil(WW / F), bh = Math.ceil(H / F);
    const pal = this.BG_PALETTE.map((h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
    const N = pal.length;
    const bayer = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
    const hash = (x, y) => { const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return n - Math.floor(n); };

    // Timpano (luce) in fondo a destra; il tunnel converge li'.
    const cx = bw - 46, cy = bh * 0.44, rx = bw * 1.0, ry = bh * 1.12;

    // Pieghe carnose lungo soffitto e pavimento, ripetute per tutta la lunghezza.
    const folds = [];
    for (let fx = 30; fx < bw; fx += Phaser.Math.Between(34, 60)) {
      const top = Math.random() < 0.5;
      folds.push({ x: fx, y: top ? 0 : bh, rx: Phaser.Math.Between(20, 40), ry: Phaser.Math.Between(16, 30), d: 0.4 + Math.random() * 0.25 });
    }

    const key = 'bgTex';
    if (scene.textures.exists(key)) scene.textures.remove(key);
    const tex = scene.textures.createCanvas(key, bw, bh);
    const ctx = tex.getContext();
    const imgData = ctx.createImageData(bw, bh);
    const d = imgData.data;

    for (let y = 0; y < bh; y++) {
      for (let x = 0; x < bw; x++) {
        const ndx = (x - cx) / rx, ndy = (y - cy) / ry;
        let depth = Math.sqrt(ndx * ndx + ndy * ndy);
        if (depth > 1) depth = 1;
        for (let f = 0; f < folds.length; f++) {
          const L = folds[f];
          if (Math.abs(x - L.x) > L.rx + 2) continue;   // salta le pieghe lontane (perf)
          const gx = (x - L.x) / L.rx, gy = (y - L.y) / L.ry, gr = Math.sqrt(gx * gx + gy * gy);
          if (gr < 1) { depth += L.d * (1 - gr) * 0.7; if (gr > 0.84) depth += 0.28; }
        }
        depth += (hash(x, y) - 0.5) * 0.05;
        if (depth > 1) depth = 1; else if (depth < 0) depth = 0;
        const t = (1 - depth) * (N - 1);
        const i = Math.floor(t), frac = t - i;
        let idx = i + (frac > (bayer[y & 3][x & 3] + 0.5) / 16 ? 1 : 0);
        const pr = hash(x * 1.7 + 3.1, y * 2.3 + 1.7);
        if (pr < 0.05) idx -= 1; else if (pr > 0.985) idx += 1;   // pori scuri / riflessi
        if (idx < 0) idx = 0; else if (idx > N - 1) idx = N - 1;
        const c = pal[idx], o = (y * bw + x) * 4;
        d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
      }
    }

    // Gocce di cerume che colano dal soffitto, sparse lungo il condotto.
    const put = (x, y, c) => { if (x < 0 || y < 0 || x >= bw || y >= bh) return; const o = (y * bw + x) * 4; d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255; };
    for (let dx = 40; dx < bw; dx += Phaser.Math.Between(60, 130)) {
      const len = Phaser.Math.Between(6, 16), mid = Math.round((N - 1) * 0.6);
      for (let yy = 0; yy < len; yy++) { put(dx, yy, pal[mid]); if (yy > 2) put(dx + 1, yy, pal[Math.max(0, mid - 2)]); }
      put(dx, len, pal[Math.min(N - 1, mid + 2)]); put(dx - 1, len, pal[Math.max(0, mid - 1)]); put(dx, len + 1, pal[Math.max(0, mid - 2)]);
    }

    ctx.putImageData(imgData, 0, 0);
    tex.refresh();
    scene.add.image(0, 0, key).setOrigin(0, 0).setScale(F).setDepth(-10);

    // Alone luminoso del timpano che "respira" (in coordinate del mondo).
    scene.bgGlow = scene.add.ellipse(cx * F, cy * F, 240, H * 0.5, 0xf3cca9, 0.16).setDepth(-9);
    scene.tweens.add({
      targets: scene.bgGlow, scaleX: 1.16, scaleY: 1.16, alpha: 0.28,
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
