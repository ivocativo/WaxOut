// BootScene: genera tutte le texture pixel-art via codice, poi va al menu.
class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }

  create() {
    const C = window.CONFIG.COLORS;
    const PA = window.PixelArt;
    const sP = window.CONFIG.PIXEL_SCALE_PLAYER;
    const sE = window.CONFIG.PIXEL_SCALE_ENEMY;

    // --- Palette omino ---
    const pPal = {
      o: C.outline,
      H: 0x5a3825,   // capelli
      k: 0xf2c9a0,   // pelle
      s: 0x3f7fd6,   // maglia chiara
      S: 0x2c5ea8,   // maglia ombra
      p: 0x394a73,   // pantaloni
      b: 0x222a3a,   // stivali
    };

    // Omino — frame A (gambe unite)
    const playerA = [
      '....oooo....',
      '...oHHHHo...',
      '..oHkkkkHo..',
      '..oHkkkkHo..',
      '..okkokoko..',
      '..okkkkkko..',
      '...okkkko...',
      '..ssSSSSss..',
      '.ssSSSSSSss.',
      '.ksSSSSSSsk.',
      '..pppppppp..',
      '..pp....pp..',
      '..pp....pp..',
      '..bb....bb..',
    ];
    // Omino — frame B (passo, gambe divaricate)
    const playerB = [
      '....oooo....',
      '...oHHHHo...',
      '..oHkkkkHo..',
      '..oHkkkkHo..',
      '..okkokoko..',
      '..okkkkkko..',
      '...okkkko...',
      '..ssSSSSss..',
      '.ssSSSSSSss.',
      '.ksSSSSSSsk.',
      '..pppppppp..',
      '.pp......pp.',
      '.pp......pp.',
      '.bb......bb.',
    ];
    PA.fromGrid(this, 'player_a', playerA, pPal, sP);
    PA.fromGrid(this, 'player_b', playerB, pPal, sP);

    // --- Nemico "Cerumino" (blob di cerume) ---
    const ePal = {
      w: C.waxSoft,
      L: C.waxSoftLight,
      o: C.outline,
    };
    const cerumino = [
      '....wwww....',
      '..wwwwwwww..',
      '.wwwwwwwwww.',
      'wwwLwwwwLwww',
      'wwwwwwwwwwww',
      'wwwowwwwowww',
      'wwwwwwwwwwww',
      'wwwwoooowwww',
      '.wwwwwwwwww.',
      '..ww....ww..',
    ];
    PA.fromGrid(this, 'enemy_blob', cerumino, ePal, sE);

    // --- Nemico "Crosta" (sporco più resistente) ---
    const dPal = {
      d: C.dirt,
      L: C.dirtLight,
      o: C.outline,
    };
    const crosta = [
      '...dddddd...',
      '..dddddddd..',
      '.dLddddddLd.',
      'dddddddddddd',
      'ddoddddddodd',
      'dddddddddddd',
      'ddddoooodddd',
      '.dddddddddd.',
      '..dd....dd..',
    ];
    PA.fromGrid(this, 'enemy_crust', crosta, dPal, sE);

    // --- Blocchi del muro (3 durezze) ---
    PA.block(this, 'block_soft', C.waxSoft, C.waxSoftLight, C.waxSoftDark,
      [[6, 7], [18, 5], [11, 19], [22, 14], [5, 22]]);
    PA.block(this, 'block_hard', C.waxHard, C.waxHardLight, C.waxHardDark,
      [[8, 6], [20, 10], [6, 18], [16, 20], [24, 22]]);
    PA.block(this, 'block_dirt', C.dirt, C.dirtLight, C.dirtDark,
      [[5, 8], [14, 6], [22, 12], [9, 18], [18, 22]]);

    // --- Particelle ---
    PA.solid(this, 'bit_wax', C.waxSoftLight, 5, 5);
    PA.solid(this, 'bit_dirt', C.dirtLight, 5, 5);
    PA.solid(this, 'bit_hard', C.waxHardLight, 5, 5);

    // --- Armi ---
    PA.swab(this, 'swab');
    PA.hammer(this, 'hammer');

    this.scene.start('MenuScene');
  }
}
window.BootScene = BootScene;
