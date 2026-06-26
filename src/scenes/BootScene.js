// BootScene: carica gli sprite PNG (grafica vera) e genera via codice le texture
// non ancora ridisegnate, poi va al menu.
class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }

  // Sprite PNG disegnati a mano (assets/sprites/). Quelli non ancora pronti
  // restano generati da codice in create().
  preload() {
    this.load.image('player_a', 'assets/sprites/hero_idle.png');
    this.load.image('player_b', 'assets/sprites/hero_idle.png');   // walk = idle finche' non c'e' il frame di corsa
    this.load.image('enemy_blob', 'assets/sprites/cerumino.png');
    this.load.image('enemy_crust', 'assets/sprites/crosta.png');
    this.load.image('wax_glob', 'assets/sprites/wax_glob.png');
  }

  create() {
    const C = window.CONFIG.COLORS;
    const PA = window.PixelArt;
    const sE = window.CONFIG.PIXEL_SCALE_ENEMY;

    // player_a/player_b, enemy_blob, enemy_crust e wax_glob ora arrivano da PNG
    // (vedi preload). Qui sotto restano le texture ancora generate da codice.

    // --- Nemico "Moscerino" (vola e insegue in aria) ---
    const fPal = {
      w: 0x7fae3a,   // corpo verde "germe"
      L: 0xd8e8f5,   // ali chiare
      o: C.outline,
    };
    const moscerino = [
      '....wwww....',
      '...wwwwww...',
      '..wwowwoww..',
      '.LwwwwwwwwL.',
      'LLwwwwwwwwLL',
      '.LwwwwwwwwL.',
      '..wwwwwwww..',
      '...woooow...',
      '....w..w....',
    ];
    PA.fromGrid(this, 'enemy_fly', moscerino, fPal, sE);

    // --- Nemico "Gorgogliante" (sputa cerume a distanza) ---
    const gPal = {
      w: 0x3fae9c,   // corpo turchese "infetto"
      L: 0x86d9cb,   // riflesso chiaro
      o: C.outline,
    };
    const gorgogliante = [
      '...wwwwww...',
      '..wwwwwwww..',
      '.wwLwwwwLww.',
      'wwwwwwwwwwww',
      'wwoowwwwooww',
      'wwwwwwwwwwww',
      '.woooooooow.',
      '.wwwwwwwwww.',
      '..ww....ww..',
    ];
    PA.fromGrid(this, 'enemy_spit', gorgogliante, gPal, sE);

    // --- BOSS "Tappo di Cerume" (grande, due volte la scala) ---
    const bPal = {
      w: C.waxHard,
      L: C.waxHardLight,
      o: C.outline,
    };
    const tappo = [
      '..oooooooooo..',
      '.owwwwwwwwwwo.',
      'owwLLwwwwLLwwo',
      'owwwwwwwwwwwwo',
      'owwoowwwwoowwo',
      'owwoowwwwoowwo',
      'owwwwwwwwwwwwo',
      'owwoooooooowwo',
      'owwwwwwwwwwwwo',
      '.owwwwwwwwwwo.',
      '..owwwwwwwwo..',
      '...oooooooo...',
    ];
    PA.fromGrid(this, 'enemy_boss', tappo, bPal, sE * 2);

    // wax_glob (proiettile) ora arriva da PNG (vedi preload).

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
