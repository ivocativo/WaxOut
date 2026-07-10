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
  hp:    { per: 20, base: 45, step: 35, max: 10, name: 'Cuore Extra',   effect: '+20 HP a inizio run' },
  dmg:   { per: 4,  base: 55, step: 45, max: 10, name: 'Lama Affilata', effect: '+4 danno a inizio run' },
  speed: { per: 15, base: 40, step: 30, max: 8,  name: 'Stivali Molla', effect: '+15 velocita a inizio run' },
  djump: { per: 1,  base: 200, step: 0, max: 1,  name: 'Doppio Salto Innato', effect: 'Inizi ogni run col doppio salto' },
};

// PROGETTI (blueprint): sblocchi PERMANENTI una-tantum che aggiungono ABILITA' NUOVE al
// mazzo delle run (compaiono come carte all'UpgradeScene solo dopo essere state sbloccate
// qui, col cerume in banca). A differenza di UNLOCKS non danno bonus di statistica: danno
// CONTENUTO nuovo. 'ability' = id dell'abilità (deve combaciare con UpgradeScene.ALL).
window.BLUEPRINTS = {
  magnet:    { cost: 120, ability: 'magnet'    },
  blast:     { cost: 220, ability: 'blast'     },
  splash:    { cost: 320, ability: 'splash'    },
  companion: { cost: 500, ability: 'companion' },
};

// EVOLUZIONI (stile Vampire Survivors): se possiedi ENTRAMBE le abilità di `needs`, tra le
// carte di fine livello può comparire l'EVOLUZIONE (`id`), che fonde le due in una versione
// potenziata. `id` funge anche da chiave i18n (up_<id>_name/_desc, ability_<id>) e da voce
// in ownedAbilities (una volta presa non ricompare). Meccaniche agganciate in GameScene.
window.EVOLUTIONS = [
  { id: 'evo_blade',  needs: ['pierce', 'spread'],       apply: (s) => { s.evoPierceAll = true; s.jetDamage += 6; } },
  { id: 'evo_toxic',  needs: ['splash', 'corrosive'],    apply: (s) => { s.evoToxic = true; } },
  { id: 'evo_magnet', needs: ['magnet', 'greed'],        apply: (s) => { s.evoMagnet = true; s.waxMult += 0.5; } },
  { id: 'evo_swarm',  needs: ['companion', 'homing'],    apply: (s) => { s.evoSwarm = true; } },
];

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
      jetPellets: 1,         // n. palline sparate dal getto (Ventaglio: +1 a ogni pesca)
      jetPierce: false,      // palline perforanti
      lifesteal: false,      // curi vita uccidendo
      shield: false,         // para un colpo ogni tot
      homing: false,         // Mira Guidata: le palline curvano verso il nemico piu' vicino
      secondLife: false,     // Seconda Vita: sopravvivi a un colpo mortale (si ricarica a vita piena)
      waxMult: 1,            // Cerume Extra: moltiplicatore del cerume raccolto (+0.5 a ogni pesca)
      dashStrike: false,     // Scatto Offensivo: lo scatto danneggia i nemici e pulisce il cerume
      corrosive: false,      // Sapone Corrosivo: le palline avvelenano il nemico (danno nel tempo)
      bounce: 0,             // Rimbalzo: le palline rimbalzano N volte (+1 a ogni pesca)
      // EVOLUZIONI (due abilità collegate si fondono in una versione potenziata):
      evoPierceAll: false,   // Perforante + Ventaglio  -> Lama d'Acqua (perfora tutto + danno)
      evoToxic: false,       // Scoppio + Corrosivo     -> Nube Tossica (lo scoppio avvelena)
      evoMagnet: false,      // Calamita + Cerume Extra  -> Buco Nero (raggio enorme + più cerume)
      evoSwarm: false,       // Bolla + Mira Guidata     -> Sciame (le bolle sparano a ricerca)
      // Abilità sbloccabili dai PROGETTI del negozio (window.BLUEPRINTS):
      magnet: false,         // attira il cerume/pickup vicino
      meleeBlast: false,     // la bastonata colpisce anche i nemici in un raggio (area)
      jetSplash: false,      // le palline del getto scoppiano all'impatto (piccola area)
      companions: 0,         // n. bolle-aiutante (+1 a ogni pesca della carta)
    };
  },

  reset() {
    this.level = 1;
    this.wax = 0;
    this.ownedAbilities = [];
    this.player = this.newPlayer();
  },
};
