// Earwax War — stato globale di gioco e costanti condivise.
// Niente moduli ES: usiamo variabili globali (window.*) così tutto gira da file://.

window.CONFIG = {
  WIDTH: 960,
  HEIGHT: 540,
  GRAVITY: 1100,
  GROUND_H: 46,         // altezza del "pavimento" del condotto
  BLOCK: 32,            // lato di un blocco del muro (px display)
  PIXEL_SCALE_PLAYER: 3,
  PIXEL_SCALE_ENEMY: 3,

  // Palette a tema "orecchio / cerume / sporco"
  COLORS: {
    bgTop: 0xe9b89a,
    bgBottom: 0xc6876a,
    canalShade: 0x9c5f48,
    eardrum: 0xd98a86,
    ground: 0xb87a5c,
    groundDark: 0x8f5a40,
    waxSoft: 0xdca842,
    waxSoftLight: 0xf2c861,
    waxSoftDark: 0xa9781f,
    waxHard: 0xb98322,
    waxHardLight: 0xd6a23c,
    waxHardDark: 0x7d5512,
    dirt: 0x7a5a3a,
    dirtLight: 0x9a7650,
    dirtDark: 0x4f3a24,
    outline: 0x14161f,
    hpGood: 0x4caf50,
    hpBad: 0xe74c3c,
  },
};

// Stato di progressione del giocatore (persiste tra i livelli, non tra i refresh).
window.GameState = {
  level: 1,
  wax: 0,
  player: null,
  ownedAbilities: [],   // es. 'doublejump', 'dash', 'hammer'

  newPlayer() {
    return {
      maxHp: 100,
      hp: 100,
      damage: 26,
      moveSpeed: 220,
      jumpVelocity: 560,
      attackCooldown: 360,  // ms
      attackRange: 1,        // moltiplicatore portata
      doubleJump: false,
      dash: false,
      weapon: 'swab',        // 'swab' | 'hammer'
    };
  },

  reset() {
    this.level = 1;
    this.wax = 0;
    this.ownedAbilities = [];
    this.player = this.newPlayer();
  },
};
