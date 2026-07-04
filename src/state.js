// Earwax War — stato globale di gioco e costanti condivise.
// Niente moduli ES: usiamo variabili globali (window.*) così tutto gira da file://.

window.CONFIG = {
  WIDTH: 960,
  HEIGHT: 540,
  GRAVITY: 1100,
  GROUND_H: 180,        // altezza del "pavimento" del condotto (alto: tiene l'azione
                        // sopra le dita sui comandi touch e riempie il canale)
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
    slime: 0xcf9a34,
    slimeGloss: 0xfbe38b,
    outline: 0x14161f,
    hpGood: 0x4caf50,
    hpBad: 0xe74c3c,
  },
};

// Potenziamenti PERMANENTI del negozio (roguelike meta-progression).
// 'per' = bonus per ogni livello acquistato; base/step = costo (in cerume) del
// prossimo acquisto = base + step * livelloAttuale; max = quante volte si compra.
window.UNLOCKS = {
  hp:    { per: 20, base: 15, step: 12, max: 10, name: 'Cuore Extra',   effect: '+20 HP a inizio run' },
  dmg:   { per: 4,  base: 20, step: 16, max: 10, name: 'Lama Affilata', effect: '+4 danno a inizio run' },
  speed: { per: 15, base: 14, step: 11, max: 8,  name: 'Stivali Molla', effect: '+15 velocita a inizio run' },
  djump: { per: 1,  base: 70, step: 0,  max: 1,  name: 'Doppio Salto Innato', effect: 'Inizi ogni run col doppio salto' },
};

// Stato di progressione DELLA RUN corrente (azzerato a ogni nuova run).
window.GameState = {
  level: 1,
  wax: 0,
  player: null,
  ownedAbilities: [],   // es. 'doublejump', 'dash', 'hammer'

  newPlayer() {
    // Applica i potenziamenti permanenti acquistati al negozio.
    const u = window.Meta ? window.Meta.get().unlocks : {};
    const lv = (id) => u[id] || 0;
    const U = window.UNLOCKS;
    const maxHp = 100 + lv('hp') * U.hp.per;
    return {
      maxHp: maxHp,
      hp: maxHp,
      damage: 26 + lv('dmg') * U.dmg.per,
      moveSpeed: 220 + lv('speed') * U.speed.per,
      jumpVelocity: 560,
      attackCooldown: 360,  // ms (coton fioc, corpo a corpo automatico)
      attackRange: 1,        // moltiplicatore portata corpo a corpo
      // Arma a distanza: getto di acqua e sapone (pulisce il cerume e colpisce i nemici)
      jetDamage: 16 + lv('dmg') * U.dmg.per * 0.5,  // un po' sotto al corpo a corpo
      shotCooldown: 340,     // ms tra uno spruzzo e l'altro (getto base "lento": non spam)
      doubleJump: lv('djump') > 0,
      dash: false,
      weapon: 'swab',        // 'swab' | 'hammer' (corpo a corpo)
      // Abilità di run (scelte all'UpgradeScene) che cambiano lo stile di gioco:
      jetSpread: false,      // getto a ventaglio (3 palline)
      jetPierce: false,      // palline perforanti
      lifesteal: false,      // curi vita uccidendo
      shield: false,         // para un colpo ogni tot
    };
  },

  reset() {
    this.level = 1;
    this.wax = 0;
    this.ownedAbilities = [];
    this.player = this.newPlayer();
  },
};
