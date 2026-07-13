// BootScene: carica gli sprite PNG (grafica vera) e genera via codice le texture
// non ancora ridisegnate, poi va al menu.
class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }

  // Sprite PNG disegnati a mano. Sono INCORPORATI come data URI (src/sprites_data.js)
  // cosi' si caricano anche aprendo index.html da file:// (i browser bloccano i PNG
  // esterni in locale). Fallback al file su disco se i dati incorporati mancano.
  preload() {
    const D = window.SPRITE_DATA || {};
    const img = (key, name, file) => this.load.image(key, D[name] || ('assets/sprites/' + file));
    img('player_a', 'hero_idle', 'hero_idle.png');
    img('player_b', 'hero_idle', 'hero_idle.png');   // walk = idle finche' non c'e' il frame di corsa
    img('enemy_blob', 'cerumino', 'cerumino.png');
    img('enemy_crust', 'crosta', 'crosta.png');
    img('wax_glob', 'wax_glob', 'wax_glob.png');

    // Immagini "vere" (fondale, timpano, protuberanze): sono INCORPORATE come data URI
    // (src/assets_data.js) cosi' si caricano anche da file:// (i browser bloccano i
    // PNG/JPG esterni in locale). Ripiego al file su disco se il dato incorporato manca.
    // Per aggiornarle: sostituisci il PNG e rilancia tools/embed_assets.ps1.
    const A = window.ASSET_DATA || {};
    const aimg = (key, file) => this.load.image(key, A[key] || file);
    aimg('eardrum', 'assets/sprites/eardrum.png');
    // Fondale gia' pixelato+posterizzato (tools/bake_bg_pixel.ps1); niente elaborazione
    // canvas a runtime (che si romperebbe da file://).
    aimg('bg_flesh_px', 'assets/backgrounds/bg_flesh_01_px.png');
    // PROTUBERANZE (immagini AI vere, provvisorie ma in stile). Pavimento e soffitto.
    aimg('prot_coral_stalk', 'assets/protuberances/prot_coral_stalk.png');   // colonna (pavimento)
    aimg('prot_coral_branch', 'assets/protuberances/prot_coral_branch.png'); // rovi ramificati (pavimento)
    aimg('prot_drip', 'assets/protuberances/prot_drip.png');                 // colata che gocciola (soffitto)
    aimg('prot_web', 'assets/protuberances/prot_web.png');                   // fascia di muco (soffitto)
    // CERUME (sprite AI): pezzi/chunk per il muro + gocce/colate. Ricolorati per tipo in gioco.
    ['wax_a', 'wax_b', 'wax_c', 'wax_d', 'wax_drip_a', 'wax_drip_b']
      .forEach((k) => aimg(k, 'assets/wax/' + k + '.png'));

    // Sprite sheet ANIMATI del personaggio (generati con AutoSprite da UNA sola immagine AI).
    // TUTTI gli sprite sheet del gioco vivono in assets/spritesheets/<entita'>/ (cartella dedicata,
    // separata da assets/sprites/ che ha le immagini singole). Griglia 5x5 = 25 frame da 256x256.
    // Caricati da file (in preview via server); per far girare da file:// andranno incorporati
    // come gli altri (embed) piu' avanti. Versione PIXELLATA (bake: risoluzione ridotta + colori
    // ridotti + bordi netti) per combaciare con lo stile pixel-art dello sfondo. Frame 84x84 (sheet 420x420).
    const heroSheet = (key, file) => this.load.spritesheet(key, (A[key] || 'assets/spritesheets/hero/' + file), { frameWidth: 84, frameHeight: 84 });
    heroSheet('hero_walk', 'hero_walk_px.png');
    heroSheet('hero_run',  'hero_run_px.png');
    heroSheet('hero_idle', 'hero_idle_px.png');
    heroSheet('hero_jump', 'hero_jump_px.png');
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
    PA.sprayer(this, 'sprayer');   // arma a distanza tenuta in mano (layer arma)

    this.scene.start('MenuScene');
  }
}
window.BootScene = BootScene;
