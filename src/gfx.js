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

  // Sfondo del condotto: FONDALE dipinto (immagine generata, parete di carne) che
  // riempie lo schermo e scorre lento (parallax). updateBackground() (da
  // GameScene.update) lo fa scorrere con la telecamera.
  // Manopole (regolabili al volo in preview via window.__BG_PX / window.__BG_ZOOM):
  //  PX   = quanto "sgranare": l'immagine viene prima RImpicciolita di PX volte e poi
  //         ringrandita a pixel netti (NEAREST) -> vera pixel art. Piu' alto = pixeloni.
  //  ZOOM = quanto zoomare dentro l'immagine. >1 mostra solo un SETTORE: cosi' ogni
  //         livello inquadra una zona diversa della stessa immagine (piu' sfondi con 1 file).
  BG_PX: 6,
  BG_ZOOM: 2.0,
  BG_LEVELS: 6,   // colori per canale (posterizzazione): pochi = look pixel-art "a poster"

  drawBackground(scene) {
    const W = window.CONFIG.WIDTH, H = window.CONFIG.HEIGHT;
    const PX = window.__BG_PX || this.BG_PX;
    const ZOOM = window.__BG_ZOOM || this.BG_ZOOM;
    const src = scene.textures.get('bg_flesh_01').getSourceImage();
    const lowW = Math.max(2, Math.round(src.width / PX));
    const lowH = Math.max(2, Math.round(src.height / PX));

    // Texture pixelata: costruita UNA volta (riusata tra i livelli); ricostruita se cambia PX.
    // Rimpicciolisco l'immagine con lo smoothing acceso (media morbida dei pixel) e poi la
    // faro' ringrandire a blocchi netti dal filtro NEAREST del TileSprite.
    const LEVELS = window.__BG_LEVELS || this.BG_LEVELS;
    const pxKey = 'bg_px';
    const existing = scene.textures.exists(pxKey) ? scene.textures.get(pxKey) : null;
    if (existing && (existing._pxFactor !== PX || existing._levels !== LEVELS)) { scene.textures.remove(pxKey); }
    if (!scene.textures.exists(pxKey)) {
      const ct = scene.textures.createCanvas(pxKey, lowW, lowH);
      const ctx = ct.getContext();
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(src, 0, 0, lowW, lowH);
      // Posterizza: snappa ogni canale a pochi livelli -> colori piatti = look pixel-art
      // (senza questo, i bloccotti sfumano tra loro e sembra solo sfocato). getImageData
      // puo' fallire da file:// (canvas "tainted"): in quel caso resta solo la sgranatura.
      if (LEVELS > 1 && LEVELS < 255) {
        try {
          const id = ctx.getImageData(0, 0, lowW, lowH);
          const d = id.data, step = 255 / (LEVELS - 1);
          for (let i = 0; i < d.length; i += 4) {
            d[i] = Math.round(Math.round(d[i] / step) * step);
            d[i + 1] = Math.round(Math.round(d[i + 1] / step) * step);
            d[i + 2] = Math.round(Math.round(d[i + 2] / step) * step);
          }
          ctx.putImageData(id, 0, 0);
        } catch (e) { /* file://: niente posterizzazione, pazienza */ }
      }
      ct.refresh();
      ct._pxFactor = PX; ct._levels = LEVELS;
    }
    scene.textures.get(pxKey).setFilter(Phaser.Textures.FilterMode.NEAREST);

    const scale = (H / lowH) * ZOOM;              // riempi l'altezza, poi zooma
    const bg = scene.add.tileSprite(0, 0, W, H, pxKey).setOrigin(0, 0).setScrollFactor(0).setDepth(-14);
    bg.tileScaleX = scale; bg.tileScaleY = scale;

    // Settore diverso per livello: offset deterministico dal numero di livello (stesso
    // livello -> stesso sfondo). Verticale entro la banda non visibile lasciata dallo zoom.
    const lvl = (window.GameState && window.GameState.level) || 1;
    const freeY = Math.max(0, lowH - H / scale);
    scene.bgBaseX = ((lvl * 137) % 997) / 997 * lowW;
    scene.bgBaseY = ((lvl * 311) % 997) / 997 * freeY;
    bg.tilePositionY = scene.bgBaseY;

    scene.bgLayers = [{ s: bg, f: 0.25 }];        // parallax lento
    this.updateBackground(scene);
  },

  // Scorre il fondale in base alla telecamera (effetto parallax), partendo dal settore
  // scelto per il livello (scene.bgBaseX).
  updateBackground(scene) {
    if (!scene.bgLayers) return;
    const sx = scene.cameras.main.scrollX;
    for (let i = 0; i < scene.bgLayers.length; i++) {
      const L = scene.bgLayers[i];
      L.s.tilePositionX = (scene.bgBaseX || 0) + (sx * L.f) / L.s.tileScaleX;
    }
  },

  // ---------- Protuberanze (scenografia in primo piano) ----------

  // Elenco delle immagini usabili come protuberanze, divise per superficie.
  // OGGI sono BOZZE SEGNAPOSTO (chiavi prot_*, caricate in BootScene): per passare
  // alle immagini AI vere basta caricare i nuovi PNG con queste stesse chiavi (o
  // aggiungerne di nuove qui). 'h' = altezza nativa, serve solo come riferimento.
  PROTUBERANCES: {
    floor:   ['prot_coral_stalk', 'prot_cluster', 'prot_cluster_b', 'prot_lobe', 'prot_tube'],
    ceiling: ['prot_cluster', 'prot_cluster_b', 'prot_lobe'],
  },

  // Sparge escrescenze organiche ancorate a PAVIMENTO e SOFFITTO lungo tutto il
  // condotto. Sono SOLO scenografia: stanno DAVANTI alle membrane ma DIETRO al
  // personaggio (depth 7 < player 10), niente collisioni. Scorrono col mondo
  // (scrollFactor 1), quindi rispetto al fondale lontano (parallax 0.25) sembrano
  // molto piu' vicine -> effetto "primo piano". Quantita' e posizioni variano a ogni
  // livello. Chiamata da GameScene.buildLevel dopo aver creato le membrane.
  drawProtuberances(scene) {
    const H = window.CONFIG.HEIGHT;
    const groundTop = scene.groundTop != null ? scene.groundTop : H - window.CONFIG.GROUND_H;
    const worldW = scene.worldW || window.CONFIG.WIDTH;
    const lvl = (window.GameState && window.GameState.level) || 1;
    const P = this.PROTUBERANCES;
    const membXs = scene.membraneXs || [];
    const DEPTH = 7;

    scene.protuberances = [];
    const span = Math.max(1, worldW - 600);
    const floorN = Phaser.Math.Clamp(4 + Math.floor(lvl * 0.8), 4, 14);
    const ceilN = Phaser.Math.Clamp(3 + Math.floor(lvl * 0.6), 3, 11);

    // Evita di piazzare una protuberanza proprio sopra a una membrana (la nasconderebbe).
    const farFromMembrane = (x) => membXs.every((mx) => Math.abs(x - mx) > 100);
    const pickX = () => {
      for (let t = 0; t < 6; t++) {
        const x = 300 + Phaser.Math.Between(0, span);
        if (farFromMembrane(x)) return x;
      }
      return 300 + Phaser.Math.Between(0, span);
    };

    const place = (key, anchor) => {
      const x = pickX();
      // floor: appoggia in basso (un filo dentro al pavimento); ceiling: pende dall'alto.
      const y = anchor === 'floor' ? groundTop + 6 : -6;
      const img = scene.add.image(x, y, key).setDepth(DEPTH);
      img.setOrigin(0.5, anchor === 'floor' ? 1 : 0);
      // Scala mirata a un'ALTEZZA a schermo (px), calcolata dall'altezza nativa: cosi'
      // funziona sia per le bozze piccole sia per le immagini AI grandi.
      const srcH = scene.textures.get(key).getSourceImage().height || 64;
      const targetH = anchor === 'floor' ? Phaser.Math.Between(150, 300) : Phaser.Math.Between(120, 230);
      img.setScale(targetH / srcH);
      if (Math.random() < 0.5) img.setFlipX(true);          // varieta'
      if (anchor === 'ceiling') img.setFlipY(true);         // pendono verso il basso
      scene.protuberances.push(img);
    };

    for (let i = 0; i < floorN; i++) place(Phaser.Utils.Array.GetRandom(P.floor), 'floor');
    for (let i = 0; i < ceilN; i++) place(Phaser.Utils.Array.GetRandom(P.ceiling), 'ceiling');
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
