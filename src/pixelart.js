// Generatore di texture pixel-art: costruisce texture Phaser da griglie di stringhe.
// Ogni carattere della griglia mappa a un colore della palette; '.' e ' ' = trasparente.
window.PixelArt = (function () {

  // Disegna una griglia di "pixel" (ognuno grande `scale`) in una nuova texture.
  function fromGrid(scene, key, grid, palette, scale) {
    scale = scale || 4;
    const h = grid.length;
    const w = grid[0].length;
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const ch = grid[y][x];
        if (ch === '.' || ch === ' ') continue;
        const color = palette[ch];
        if (color === undefined || color === null) continue;
        g.fillStyle(color, 1);
        g.fillRect(x * scale, y * scale, scale, scale);
      }
    }
    g.generateTexture(key, w * scale, h * scale);
    g.destroy();
  }

  // Rettangolo pieno (per particelle / segnaposto).
  function solid(scene, key, color, w, h) {
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(color, 1);
    g.fillRect(0, 0, w, h);
    g.generateTexture(key, w, h);
    g.destroy();
  }

  // Blocco "mattone" con bordo chiaro in alto/sx, ombra in basso/dx e qualche granello.
  function block(scene, key, base, light, dark, spots) {
    const s = window.CONFIG.BLOCK;
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(base, 1);
    g.fillRect(0, 0, s, s);
    g.fillStyle(light, 1);
    g.fillRect(0, 0, s, 3);
    g.fillRect(0, 0, 3, s);
    g.fillStyle(dark, 1);
    g.fillRect(0, s - 3, s, 3);
    g.fillRect(s - 3, 0, 3, s);
    g.fillStyle(dark, 1);
    (spots || []).forEach(function (p) { g.fillRect(p[0], p[1], 3, 3); });
    g.fillStyle(light, 1);
    (spots || []).forEach(function (p) { g.fillRect(p[0] + 1, p[1] - 2, 2, 2); });
    g.generateTexture(key, s, s);
    g.destroy();
  }

  // Cotton fioc orizzontale (arma iniziale).
  function swab(scene, key) {
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    // asta
    g.fillStyle(0xdfe3ea, 1); g.fillRect(9, 3, 22, 3);
    g.fillStyle(0xaab2c0, 1); g.fillRect(9, 6, 22, 1);
    // punte di cotone
    g.fillStyle(0xfdf6e3, 1);
    g.fillRect(0, 1, 10, 7);
    g.fillRect(29, 1, 10, 7);
    g.fillStyle(0xe9e0c4, 1);
    g.fillRect(0, 6, 10, 2);
    g.fillRect(29, 6, 10, 2);
    g.generateTexture(key, 39, 9);
    g.destroy();
  }

  // Martello di cerume (arma ad area).
  function hammer(scene, key) {
    const C = window.CONFIG.COLORS;
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    // manico
    g.fillStyle(0x8a6a45, 1); g.fillRect(4, 14, 26, 5);
    // testa
    g.fillStyle(C.waxHard, 1); g.fillRect(24, 2, 16, 28);
    g.fillStyle(C.waxHardLight, 1); g.fillRect(24, 2, 16, 4);
    g.fillStyle(C.waxHardDark, 1); g.fillRect(24, 26, 16, 4);
    g.generateTexture(key, 42, 32);
    g.destroy();
  }

  // Spruzzatore di sapone (arma a distanza tenuta in mano). Canna verso DESTRA; il grip
  // (per il perno di rotazione) e' a sinistra-basso. Stile coerente col serbatoio del PG.
  function sprayer(scene, key) {
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0x14161f, 1); g.fillRect(1, 2, 17, 8);       // contorno scuro (blocco)
    g.fillStyle(0x8a909c, 1); g.fillRect(2, 3, 10, 5);        // corpo
    g.fillStyle(0xc0c6d0, 1); g.fillRect(2, 3, 10, 2);        // luce alta
    g.fillStyle(0x6a4a2a, 1); g.fillRect(4, 7, 3, 4);         // impugnatura
    g.fillStyle(0xc0c6d0, 1); g.fillRect(11, 4, 6, 3);        // canna
    g.fillStyle(0x9fd8e6, 1); g.fillRect(16, 4, 2, 3);        // ugello azzurro
    g.fillStyle(0x6fc3d6, 1); g.fillRect(3, 4, 2, 2);         // dettaglio serbatoio
    g.generateTexture(key, 19, 12);
    g.destroy();
  }

  return { fromGrid, solid, block, swab, hammer, sprayer };
})();
