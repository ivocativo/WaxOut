// Effetto "METABALL" per il cerume: preso il livello dei globi, ne sfoca l'alpha su un
// intorno e applica una SOGLIA netta (smoothstep) -> i globi vicini si fondono in una
// massa liquida con bordo pulito, e i contorni interni si ammorbidiscono. La rgb viene
// mediata sull'intorno (cosi' i "buchi" tra i globi prendono il colore vicino). Soglia e
// raggio regolabili al volo via window.__WAX_THRESH / window.__WAX_SPREAD.
const WAX_METABALL_FRAG = [
  'precision mediump float;',
  'uniform sampler2D uMainSampler;',
  'uniform vec2 uSize;',
  'uniform float uThresh;',
  'uniform float uSpread;',
  'uniform float uPix;',
  'varying vec2 outTexCoord;',
  'void main(){',
  '  vec2 grid = max(uPix, 1.0) / uSize;',
  '  vec2 uv = (floor(outTexCoord / grid) + 0.5) * grid;',   // centro "pixelato"
  '  vec2 px = uSpread / uSize;',
  '  float a = 0.0; vec3 col = vec3(0.0); float cw = 0.0;',
  '  for(int y=-2;y<=2;y++){',
  '    for(int x=-2;x<=2;x++){',
  '      vec2 o = vec2(float(x), float(y)) * px;',
  '      vec4 t = texture2D(uMainSampler, uv + o);',
  '      a += t.a; col += t.rgb * t.a; cw += t.a;',
  '    }',
  '  }',
  '  a /= 25.0;',
  '  vec3 c = cw > 0.001 ? col / cw : vec3(0.85, 0.6, 0.15);',
  '  float edge = smoothstep(uThresh - 0.09, uThresh + 0.09, a);',
  '  gl_FragColor = vec4(c * edge, edge);',   // alpha PREMOLTIPLICATO (Phaser): trasparente = rgb 0
  '}',
].join('\n');

const WaxMetaballFX = (Phaser.Renderer && Phaser.Renderer.WebGL) ? class extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  constructor(game) { super({ game: game, name: 'WaxMeta', fragShader: WAX_METABALL_FRAG }); }
  onPreRender() {
    this.set2f('uSize', this.renderer.width, this.renderer.height);
    this.set1f('uThresh', window.__WAX_THRESH || 0.42);
    this.set1f('uSpread', window.__WAX_SPREAD || 1.6);   // meno sfocatura (raggio fusione ridotto)
    this.set1f('uPix', window.__WAX_PIX || 3.0);          // più pixellosità
  }
} : null;

// GameScene: gameplay principale di un livello.
class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }

  create() {
    const W = window.CONFIG.WIDTH;
    const H = window.CONFIG.HEIGHT;
    const C = window.CONFIG.COLORS;

    // Stato del livello
    this.locked = false;
    this.facing = 1;
    this.lastAttack = 0;
    this.lastShot = 0;
    this.invulnUntil = 0;
    this.dashReady = 0;
    this.dashUntil = 0;
    this.jumpsLeft = 1;
    // "Game feel" del salto: buffer (salto premuto poco prima di atterrare), coyote
    // (salto ancora valido un attimo dopo esser usciti da un bordo) e taglio (rilascio
    // presto = salto piu' basso). Vedi update().
    this.jumpBufferedAt = -9999;
    this.lastGroundAt = -9999;
    this.canCutJump = false;
    this.cleanGoal = 0.8;   // frazione di cerume da pulire per poter completare il livello

    // Ogni livello si parte a vita piena
    window.GameState.player.hp = window.GameState.player.maxHp;

    // Tipo di questo livello: boss ogni 5, sciame ogni 5 (sfasato), altrimenti normale
    const levelNum = window.GameState.level;
    this.levelKind =
      (levelNum % 5 === 0) ? 'boss' :
      (levelNum % 5 === 3) ? 'swarm' : 'normal';

    // Mondo LARGO da attraversare (cresce un po' col livello): la telecamera segue
    // il giocatore mentre cammina verso il timpano (a destra). W/H restano la
    // dimensione della "finestra" visibile; il mondo fisico e' molto piu' ampio.
    this.worldW = Phaser.Math.Clamp(2400 + levelNum * 220, 2400, 5200);
    if (this.levelKind === 'swarm') this.worldW += 300;
    // Il "fondo" del mondo fisico coincide con la SUPERFICIE del pavimento (H-gh):
    // rete di sicurezza: chi ha collideWorldBounds (giocatore e nemici) non puo' mai
    // cadere sotto il pavimento, qualunque cosa accada al suo corpo fisico.
    this.physics.world.setBounds(0, 0, this.worldW, H - window.CONFIG.GROUND_H);

    this.drawBackground();

    // Pavimento del condotto (lungo tutto il mondo). Disegnato con GRAPHICS (come lo
    // sfondo) e non con un grande Shape rettangolare: su alcune GPU i rettangoli Shape
    // molto larghi non venivano disegnati e il pavimento "spariva". Si estende sotto il
    // bordo del mondo cosi' il tremolio della camera non scopre mai un buco.
    const gh = window.CONFIG.GROUND_H;
    const groundGfx = this.add.graphics().setDepth(4);
    groundGfx.fillStyle(C.ground, 1);
    groundGfx.fillRect(0, H - gh, this.worldW, gh + 200);
    groundGfx.fillStyle(C.groundDark, 1);
    groundGfx.fillRect(0, H - gh, this.worldW, 5);          // linea di superficie
    // Corpo fisico del pavimento (invisibile): la superficie d'appoggio resta a H-gh.
    this.ground = this.add.rectangle(this.worldW / 2, H - gh / 2, this.worldW, gh).setVisible(false);
    this.physics.add.existing(this.ground, true);

    // Gruppi
    this.blocks = this.physics.add.staticGroup();
    this.platforms = this.physics.add.staticGroup();  // pedane sospese (verticalita')
    this.enemies = this.physics.add.group();
    this.projectiles = this.physics.add.group();  // palline sputate dai nemici

    this.buildLevel();

    // Giocatore (sprite PNG: scala per portarlo alla dimensione di gioco; hitbox invariato)
    this.player = this.physics.add.sprite(80, H - gh - 60, 'player_a').setDepth(10).setScale(1.5);
    this.player.body.setSize(18, 40, true);
    this.player.setCollideWorldBounds(true);
    this.physics.add.collider(this.player, this.ground);
    this.physics.add.collider(this.player, this.blocks);
    this.physics.add.collider(this.player, this.platforms);

    // La telecamera segue il giocatore dentro al mondo largo.
    this.cameras.main.setBounds(0, 0, this.worldW, H);
    this.cameras.main.setRoundPixels(true);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setDeadzone(160, 120);

    // I nemici a terra collidono col pavimento e col muro; i Moscerini volano sopra a tutto.
    // NB: con collider(gruppo, oggettoSingolo) Phaser INVERTE l'ordine degli argomenti
    // nella callback (passa l'oggetto singolo per primo), percio' individuiamo il nemico
    // controllando quale dei due appartiene al gruppo enemies.
    const notFlyer = (a, b) => (this.enemies.contains(a) ? a : b).kind !== 'fly';
    this.physics.add.collider(this.enemies, this.ground, null, notFlyer);
    this.physics.add.collider(this.enemies, this.blocks, null, notFlyer);
    this.physics.add.collider(this.enemies, this.platforms, null, notFlyer);

    // Bonus di cerume raccoglibili sulle pedane.
    this.physics.add.overlap(this.player, this.pickups, (pl, pk) => this.grabPickup(pk));

    // Ostacoli mobili: fanno danno da contatto (stessa hurtPlayer di un nemico), non si uccidono.
    this.physics.add.overlap(this.player, this.movers, (pl, mv) => this.hurtPlayer(12 + Math.floor(window.GameState.level / 2), mv.x));

    // Guardiani fermi a presidiare le membrane piene.
    this.spawnGuardians();

    // Le palline sputate feriscono il giocatore e si spappolano contro muro/pavimento.
    this.physics.add.overlap(this.player, this.projectiles, (pl, proj) => {
      this.hurtPlayer(proj.dmg, proj.x);
      this.popProjectile(proj);
    });
    // Quando una pallina tocca muro/pedana/pavimento si spappola. ATTENZIONE: con
    // collider(gruppo, oggettoSingolo) Phaser inverte gli argomenti, percio' col
    // pavimento la callback riceveva (pavimento, proiettile) e il codice DISTRUGGEVA
    // IL PAVIMENTO invece del proiettile (il pavimento "spariva" quando una pallina
    // a parabola lunga cadeva a terra). Individuiamo sempre il proiettile dal gruppo.
    const popProj = (a, b) => this.popProjectile(this.projectiles.contains(a) ? a : b);
    this.physics.add.collider(this.projectiles, this.blocks, popProj);
    this.physics.add.collider(this.projectiles, this.platforms, popProj);
    this.physics.add.collider(this.projectiles, this.ground, popProj);

    // Getto di acqua e sapone del giocatore: pulisce il cerume e colpisce i nemici a
    // distanza. (Con overlap(gruppo, oggetto) Phaser puo' invertire gli argomenti:
    // individuiamo sempre il proiettile-getto dal gruppo this.shots.)
    this.makeSoapTexture();
    this.shots = this.physics.add.group({ allowGravity: false });
    // Abilità PERFORANTE: la pallina non si spappola al primo colpo ma ne attraversa
    // alcuni (pierceLeft). pierceGrace evita di ri-colpire lo stesso bersaglio mentre esce.
    const consumeShot = (sh) => {
      sh.pierceLeft = (sh.pierceLeft || 1) - 1;
      if (sh.pierceLeft <= 0) this.popShot(sh);
      else sh.pierceGrace = this.time.now + 80;
    };
    const hitWax = (a, b) => {
      const sh = this.shots.contains(a) ? a : b, bl = (sh === a) ? b : a;
      if (this.time.now < (sh.pierceGrace || 0)) return;
      this.damageBlock(bl, sh.dmg); consumeShot(sh);
    };
    const hitFoe = (a, b) => {
      const sh = this.shots.contains(a) ? a : b, en = (sh === a) ? b : a;
      if (en.spawning || this.time.now < (sh.pierceGrace || 0)) return;
      this.damageEnemy(en, sh.dmg); consumeShot(sh);
    };
    const hitSolid = (a, b) => this.popShot(this.shots.contains(a) ? a : b);   // i muri fermano sempre
    this.physics.add.overlap(this.shots, this.blocks, hitWax);
    this.physics.add.overlap(this.shots, this.enemies, hitFoe);
    this.physics.add.overlap(this.shots, this.platforms, hitSolid);
    this.physics.add.overlap(this.shots, this.ground, hitSolid);

    if (!this.anims.exists('walk')) {
      this.anims.create({
        key: 'walk',
        frames: [{ key: 'player_a' }, { key: 'player_b' }],
        frameRate: 8, repeat: -1,
      });
    }

    // Input
    this.keys = this.input.keyboard.addKeys('W,A,S,D,J,SPACE,SHIFT,R,UP,DOWN,LEFT,RIGHT');

    // Comandi a schermo per telefono/tablet (vuoti su PC).
    this.touch = window.TouchControls.attach(this);

    // Tempi di ricarica di getto (a distanza) e coton fioc (corpo a corpo).
    this.lastShot = 0;
    this.pcFiring = false;

    // Su PC (mouse, niente touch): tieni premuto il clic per spruzzare il getto.
    // Su mobile si usa il pulsante "Spruzza" dedicato.
    if (!this.touch.enabled) {
      this.input.on('pointerdown', () => { window.Sfx.unlock(); this.pcFiring = true; });
      this.input.on('pointerup', () => { this.pcFiring = false; });
    }

    // Nemici iniziali + spawner periodico (variano col tipo di livello)
    const lvl = window.GameState.level;
    let spawnDelay;
    if (this.levelKind === 'boss') {
      this.maxEnemies = Math.min(2 + Math.floor(lvl / 3), 3);  // il boss + pochi sgherri
      spawnDelay = Math.max(2000, 3200 - lvl * 120);
      this.spawnEnemy('boss');
      this.spawnEnemy();
      this.showBanner(window.I18n.t('game_boss_in'), '#ffb04a');
    } else if (this.levelKind === 'swarm') {
      this.maxEnemies = Math.min(4 + lvl, 9);
      spawnDelay = Math.max(800, 1700 - lvl * 110);
      for (let i = 0; i < Math.min(4, this.maxEnemies); i++) this.spawnEnemy();
      this.showBanner(window.I18n.t('game_swarm_in'), '#9be870');
    } else {
      this.maxEnemies = Math.min(2 + lvl, 6);
      spawnDelay = Math.max(1500, 2800 - lvl * 150);
      for (let i = 0; i < Math.min(2, this.maxEnemies); i++) this.spawnEnemy();
      this.showBanner(window.I18n.t('game_goal'), '#ffd9a0');
    }
    this.spawnTimer = this.time.addEvent({
      delay: spawnDelay, loop: true,
      callback: () => { if (!this.locked && this.enemies.countActive(true) < this.maxEnemies) this.spawnEnemy(); },
    });

    this.buildHud();

    // Pausa: tasti ESC/P + pulsante a schermo (in alto a destra)
    this.input.keyboard.on('keydown-ESC', () => this.pauseGame());
    this.input.keyboard.on('keydown-P', () => this.pauseGame());
    this.buildPauseButton();

    // Suggerimento abilita di questo livello
    if (window.GameState.ownedAbilities.length > 0) {
      const names = window.GameState.ownedAbilities.map((id) => window.I18n.t('ability_' + id));
      const txt = window.I18n.t('hud_abilities', { list: names.join(', ') });
      const t = this.add.text(W / 2, H - gh - 8, txt, {
        fontFamily: 'monospace', fontSize: '13px', color: '#fff7e8',
        stroke: '#14161f', strokeThickness: 3,
      }).setOrigin(0.5, 1).setDepth(40).setScrollFactor(0);
      this.tweens.add({ targets: t, alpha: 0, delay: 2500, duration: 800, onComplete: () => t.destroy() });
    }
  }

  // ---------- Costruzione livello ----------

  // Costruisce il livello "da attraversare": piu' membrane di cerume (muri da
  // sfondare) lungo il corridoio, qualche pedana per saltare, e il timpano in fondo.
  buildLevel() {
    const H = window.CONFIG.HEIGHT;
    const gh = window.CONFIG.GROUND_H;
    const lvl = window.GameState.level;
    this.groundTop = H - gh;

    // Riempimento continuo (base scura) DIETRO agli sprite di cerume: chiude i vuoti tra un
    // pezzo e l'altro così la massa sembra unica. Gli sprite-chunk (depth 6) ci vanno sopra.
    this.waxGfx = this.add.graphics().setDepth(5);   // base scura DIETRO (fuori dal livello metaball)
    // Livello dei globi di cerume + effetto METABALL (fonde i globi in una massa liquida con
    // bordi netti). Regolabile al volo: window.__WAX_THRESH (soglia) / window.__WAX_SPREAD (raggio).
    this.waxLayer = this.add.layer().setDepth(6);
    if (WaxMetaballFX && this.renderer.pipelines) {
      if (!this.game.__waxPipe) { this.renderer.pipelines.addPostPipeline('WaxMeta', WaxMetaballFX); this.game.__waxPipe = true; }
      this.waxLayer.setPostPipeline('WaxMeta');
    }

    // Quante membrane lungo il corridoio: cresce col livello.
    let count = Phaser.Math.Clamp(2 + Math.floor(lvl / 2), 2, 6);
    if (this.levelKind === 'swarm') count = Math.max(2, count - 1);

    const firstX = 620;
    const lastX = this.worldW - 520;              // ultima membrana prima del timpano
    const span = Math.max(1, lastX - firstX);

    this.membranes = [];                          // metadati (x, tipo) per pedane/guardiani
    this.membraneXs = [];
    this.pickups = this.physics.add.group({ allowGravity: false });
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0 : i / (count - 1);
      const mx = Math.round(firstX + span * t);
      // Varieta': la prima e' sempre "piena" (insegna a sfondare); poi si alternano
      // membrane PIENE (alte, da sfondare) e BASSE (scavalcabili con un salto).
      const type = (i % 2 === 1) ? 'short' : 'full';
      const info = this.buildMembrane(mx, lvl, i, type);
      this.membranes.push(info);
      this.membraneXs.push(mx);
    }
    this.buildMounds();          // cumuli di cerume su pavimento e soffitto
    this.buildPlatforms();
    this.buildHazards();         // pozze scivolose + ostacoli mobili (dal lvl 2/3)
    this.buildGoal();
    window.GameGfx.drawProtuberances(this);   // scenografia organica (pavimento + soffitto)

    this.totalBlocks = this.blocks.countActive(true);
    this.blocksLeft = this.totalBlocks;
    // Cerume totale del livello (per la percentuale "pulito" — vedi HUD).
    this.totalWax = 0;
    this.blocks.getChildren().forEach((b) => { if (b.active) this.totalWax += b.waxValue; });
    this.cleanedWax = 0;
    this.buildWaxSprites();
  }

  // Una membrana di cerume: una colonna di blocchi dal pavimento verso l'alto che
  // sbarra il corridoio. Tipo 'full' = alta, da sfondare (varco in basso); tipo
  // 'short' = bassa, scavalcabile con un salto (o sfondabile, ha pochi HP).
  buildMembrane(mx, lvl, idx, type) {
    const B = window.CONFIG.BLOCK;
    const groundTop = this.groundTop;
    const baseCol = Math.round(mx / B);

    // Crea un blocco di cerume a (col, row) con tipo/HP giusti.
    const mk = (col, row) => {
      const x = col * B + B / 2, y = groundTop - row * B - B / 2;
      let bt = 'soft';
      if (row === 0) bt = 'dirt';
      else if (type === 'full' && lvl >= 2 && (row + col) % 4 === 0) bt = 'hard';
      let key, hp, bitKey, wax;
      if (bt === 'hard') { key = 'block_hard'; hp = 60 + lvl * 10; bitKey = 'bit_hard'; wax = 6; }
      else if (bt === 'dirt') { key = 'block_dirt'; hp = 40 + lvl * 7; bitKey = 'bit_dirt'; wax = 4; }
      else { key = 'block_soft'; hp = 26 + lvl * 5; bitKey = 'bit_wax'; wax = 3; }
      const b = this.blocks.create(x, y, key).setDepth(5).setVisible(false);
      b.hp = hp; b.maxHp = hp; b.bitKey = bitKey; b.waxValue = wax;
      b.col = col; b.row = row; b.waxType = bt;
      b.dripLen = Math.random() < 0.55 ? Phaser.Math.Between(8, 20) : 0;
      b.refreshBody();
    };

    let rows;
    if (type === 'short') {
      // Cumuletto basso scavalcabile: 1-2 colonne di 2-3 blocchi, con un pizzico di irregolarità.
      rows = Phaser.Math.Between(2, 3);
      for (let r = 0; r < rows; r++) mk(baseCol, r);
      if (Math.random() < 0.7) for (let r = 0; r < rows - (Math.random() < 0.5 ? 1 : 0); r++) mk(baseCol + 1, r);
    } else {
      // PROFILO ORGANICO: colonna centrale piena (barriera) + contrafforti laterali più
      // bassi -> base larga che si assottiglia verso l'alto (accumulo di cerume, non stecco).
      const fullRows = Math.floor((groundTop - 16) / B);
      const topGap = Math.random() < 0.4 ? Phaser.Math.Between(1, 2) : 0;
      rows = Math.max(3, fullRows - topGap);
      const profile = {};
      profile[0] = rows;                                                    // guglia centrale (piena)
      profile[-1] = Math.round(rows * Phaser.Math.FloatBetween(0.35, 0.62));
      profile[1] = Math.round(rows * Phaser.Math.FloatBetween(0.35, 0.62));
      profile[-2] = Phaser.Math.Between(1, 2);                              // base che si allarga
      profile[2] = Phaser.Math.Between(1, 2);
      Object.keys(profile).forEach((off) => {
        const h = profile[off], col = baseCol + parseInt(off, 10);
        for (let r = 0; r < h; r++) mk(col, r);
      });
    }
    return { x: mx, type: type, rows: rows };
  }

  // Crea un singolo blocco di cerume alla colonna/riga date (riga 0 = pavimento, su = verso il soffitto).
  addWaxBlock(col, row, lvl, type) {
    const B = window.CONFIG.BLOCK;
    const x = col * B + B / 2;
    const y = this.groundTop - row * B - B / 2;
    let key, hp, bitKey, wax;
    if (type === 'hard') { key = 'block_hard'; hp = 60 + lvl * 10; bitKey = 'bit_hard'; wax = 6; }
    else if (type === 'dirt') { key = 'block_dirt'; hp = 40 + lvl * 7; bitKey = 'bit_dirt'; wax = 4; }
    else { key = 'block_soft'; hp = 26 + lvl * 5; bitKey = 'bit_wax'; wax = 3; }
    const b = this.blocks.create(x, y, key).setDepth(5).setVisible(false);
    b.hp = hp; b.maxHp = hp; b.bitKey = bitKey; b.waxValue = wax;
    b.col = col; b.row = row; b.waxType = type;
    b.dripLen = Math.random() < 0.55 ? Phaser.Math.Between(8, 20) : 0;
    b.refreshBody();
    return b;
  }

  // Sparge cumuli di cerume lungo il condotto: pilette sul pavimento (da scavalcare o
  // pulire) e stalattiti appese al soffitto (si puliscono mirando il getto in alto).
  // La quantita' cresce col livello: piu' avanti = piu' sporco.
  buildMounds() {
    const lvl = window.GameState.level;
    const floorCount = Phaser.Math.Clamp(3 + lvl, 3, 14);
    const ceilCount = Phaser.Math.Clamp(2 + Math.floor(lvl * 0.8), 2, 12);
    const minX = 320, maxX = this.worldW - 360;
    for (let i = 0; i < floorCount; i++) this.buildFloorMound(Phaser.Math.Between(minX, maxX), lvl);
    for (let i = 0; i < ceilCount; i++) this.buildCeilingMound(Phaser.Math.Between(minX, maxX), lvl);
  }

  // Piletta sul pavimento: base larga che si restringe verso l'alto (scavalcabile).
  buildFloorMound(mx, lvl) {
    const B = window.CONFIG.BLOCK;
    const baseCol = Math.round(mx / B);
    const w = Phaser.Math.Between(2, 3);
    const h = Phaser.Math.Between(1, 2);
    for (let r = 0; r < h; r++) {
      const span = Math.max(1, w - r);
      for (let c = 0; c < span; c++) {
        const type = (r === 0) ? 'dirt' : (lvl >= 4 && Math.random() < 0.2 ? 'hard' : 'soft');
        this.addWaxBlock(baseCol + c, r, lvl, type);
      }
    }
  }

  // Stalattite appesa al soffitto: larga in alto, a punta verso il basso.
  buildCeilingMound(mx, lvl) {
    const B = window.CONFIG.BLOCK;
    const topRow = Math.floor((window.CONFIG.HEIGHT - window.CONFIG.GROUND_H) / B) - 1;
    const baseCol = Math.round(mx / B);
    const w = Phaser.Math.Between(2, 3);
    const depth = Phaser.Math.Between(1, 2 + Math.floor(lvl / 3));
    for (let d = 0; d < depth; d++) {
      const span = w - d;
      if (span <= 0) break;
      // ceiling = true: questi blocchi sono "appesi al soffitto" -> NON cadono con la gravità.
      for (let c = 0; c < span; c++) { const b = this.addWaxBlock(baseCol + c, topRow - d, lvl, 'soft'); b.ceiling = true; }
    }
  }

  // Pedane sospese: una "rampa" davanti a ogni membrana bassa (per scavalcarla con un
  // salto) + piu' pedane (basse E alte) tra le membrane, quasi sempre con un bonus di
  // cerume sopra. Una volta a livello, sopra una pedana alta si nasconde uno SCRIGNO
  // segreto (un'altra pedana ancora piu' su, raggiungibile con un salto extra).
  buildPlatforms() {
    this.membranes.forEach((m) => {
      if (m.type !== 'short') return;
      const px = Math.max(200, m.x - 110);
      const py = this.groundTop - Phaser.Math.Between(72, 96);
      this.addPlatform(px, py, 110);
    });

    const xs = this.membraneXs;
    let secretPlaced = false;
    for (let i = 0; i < xs.length - 1; i++) {
      const gapW = xs[i + 1] - xs[i];
      // Pedana bassa: quasi sempre presente se il varco e' abbastanza largo.
      if (gapW > 260 && Math.random() < 0.7) {
        const lowX = Math.round(xs[i] + gapW * Phaser.Math.FloatBetween(0.25, 0.4));
        const py = this.groundTop - Phaser.Math.Between(90, 130);
        this.addPlatform(lowX, py, Phaser.Math.Between(90, 120));
        if (Math.random() < 0.7) this.addWaxPickup(lowX, py - 26);
      }
      // Pedana alta: premia chi sale a cercarla.
      if (Math.random() < 0.55) {
        const midX = Math.round(xs[i] + gapW * Phaser.Math.FloatBetween(0.5, 0.75));
        const py = this.groundTop - Phaser.Math.Between(150, 220);
        this.addPlatform(midX, py, Phaser.Math.Between(90, 130));
        if (Math.random() < 0.7) this.addWaxPickup(midX, py - 26);
        // SEGRETO (non segnalato): a volte, sopra questa pedana, uno scrigno ancora piu'
        // in alto — un salto in piu' rispetto al percorso ovvio. Una sola volta a livello.
        if (!secretPlaced && Math.random() < 0.35) {
          secretPlaced = true;
          const sx = midX + Phaser.Math.Between(-20, 20);
          const sy = py - Phaser.Math.Between(110, 130);
          this.addPlatform(sx, sy, 70);
          for (let k = -1; k <= 1; k++) this.addWaxPickup(sx + k * 20, sy - 28, k === 0);
        }
      }
    }
    // Rampa d'avvio prima della prima membrana.
    this.addPlatform(Math.max(200, xs[0] - 240), this.groundTop - Phaser.Math.Between(110, 150), 120);
  }

  // Terreno accidentato: pozze di cerume scivoloso (rallentano se ci cammini sopra, dal
  // lvl 2) e ostacoli mobili che vanno avanti e indietro e feriscono al contatto (dal
  // lvl 3). Entrambi crescono di numero (e i mobili di velocita') col livello.
  buildHazards() {
    const lvl = window.GameState.level;
    this.slimeZones = [];
    const slimeCount = lvl >= 2 ? Phaser.Math.Clamp(1 + Math.floor(lvl / 3), 1, 4) : 0;
    for (let i = 0; i < slimeCount; i++) this.addSlimeZone();

    this.movers = this.physics.add.group({ allowGravity: false });
    const moverCount = lvl >= 3 ? Phaser.Math.Clamp(Math.floor(lvl / 3), 1, 3) : 0;
    for (let i = 0; i < moverCount; i++) this.addMovingHazard();
  }

  // Trova una fascia orizzontale libera (lontana da membrane e da altre pozze/ostacoli
  // gia' piazzati) per un nuovo elemento largo `w`. Ritorna null se non trova posto.
  pickHazardX(w, margin) {
    margin = margin || 0;
    for (let tries = 0; tries < 20; tries++) {
      const x = Phaser.Math.Between(280, this.worldW - 320 - w);
      const cx = x + w / 2;
      const nearMembrane = this.membraneXs.some((mx) => Math.abs(mx - cx) < 150 + margin);
      const nearZone = (this.slimeZones || []).some((z) => x < z.x2 + 60 && x + w > z.x1 - 60);
      if (!nearMembrane && !nearZone) return x;
    }
    return null;
  }

  // Pozza di cerume scivoloso sul pavimento: solo visiva + una fascia x memorizzata in
  // this.slimeZones, letta in update() per rallentare il giocatore mentre e' a terra.
  addSlimeZone() {
    const w = Phaser.Math.Between(90, 170);
    const x = this.pickHazardX(w);
    if (x == null) return;
    const C = window.CONFIG.COLORS;
    const cx = x + w / 2, y = this.groundTop;
    const g = this.add.rectangle(cx, y - 4, w, 9, C.slime, 0.88).setDepth(4.5);
    g.setStrokeStyle(1, C.slimeGloss, 0.5);
    this.tweens.add({ targets: g, scaleY: 1.3, yoyo: true, repeat: -1, duration: 900, ease: 'Sine.inOut' });
    this.slimeZones.push({ x1: x, x2: x + w });
  }

  // Ostacolo mobile: una pallina di cerume indurito che va avanti e indietro tra due punti
  // (a terra o sospesa in aria) e ferisce al contatto come un nemico (va schivato/scavalcato,
  // non si puo' uccidere). Ruota su se stessa per leggibilita'.
  addMovingHazard() {
    const lvl = window.GameState.level;
    const w = Phaser.Math.Between(220, 340);
    const x = this.pickHazardX(w, 40);
    if (x == null) return;
    const floating = Math.random() < 0.5;
    const y = floating ? this.groundTop - Phaser.Math.Between(110, 190) : this.groundTop - 22;
    const m = this.movers.create(x + w / 2, y, 'wax_glob').setDepth(8).setScale(1.8).setTint(0xd6432f);
    m.body.setAllowGravity(false);
    m.body.setSize(14, 14, true);
    m.range = { x1: x, x2: x + w };
    m.dir = Math.random() < 0.5 ? 1 : -1;
    m.speed = 65 + lvl * 4;
  }

  // Pallina di cerume da raccogliere (premia chi sale sulle pedane). Ondeggia leggera.
  // heal=true: pallina rosata che invece di cerume cura un po' di vita (rara, negli scrigni).
  addWaxPickup(x, y, heal) {
    const p = this.pickups.create(x, y, 'wax_glob').setDepth(7);
    p.body.setAllowGravity(false);
    p.body.setSize(14, 14, true);
    if (heal) { p.isHeal = true; p.setTint(0xff8fae); p.waxValue = 2; p.healValue = 14; }
    else p.waxValue = 5;
    this.tweens.add({ targets: p, y: y - 6, yoyo: true, repeat: -1, duration: 750, ease: 'Sine.inOut' });
  }

  grabPickup(pk) {
    if (!pk || !pk.active) return;
    window.GameState.wax += pk.waxValue;
    if (pk.isHeal) {
      const pl = window.GameState.player;
      pl.hp = Math.min(pl.maxHp, pl.hp + pk.healValue);
      this.healFx(pk.x, pk.y);
    }
    window.Sfx.crack();
    this.burst('bit_wax', pk.x, pk.y, 6);
    pk.destroy();
  }

  addPlatform(x, y, w) {
    const C = window.CONFIG.COLORS;
    const h = 16;
    const r = this.add.rectangle(x, y, w, h, C.ground).setDepth(4);
    r.setStrokeStyle(2, C.groundDark, 0.85);
    this.physics.add.existing(r, true);
    this.platforms.add(r);
  }

  // Il timpano in fondo a destra: traguardo del livello. Raggiungerlo = vittoria.
  buildGoal() {
    const H = window.CONFIG.HEIGHT;
    const gh = window.CONFIG.GROUND_H;
    this.goalX = this.worldW - 150;
    const cx = this.goalX + 40;
    const cy = (H - gh) * 0.5;
    const ah = (H - gh) * 0.92;

    // Timpano: sprite pixel-art (membrana), ingrandito ad altezza condotto, che "respira".
    const ed = this.add.image(cx, cy, 'eardrum').setDepth(3);
    const es = (ah * 0.95) / ed.height;
    ed.setScale(es);
    this.tweens.add({ targets: ed, scaleX: es * 1.05, scaleY: es * 1.03, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

    // Indizio "vai a destra" che fluttua davanti al timpano.
    const arrow = this.add.text(this.goalX - 70, cy, '>>', {
      fontFamily: 'monospace', fontSize: '40px', color: '#fff7e8', stroke: '#14161f', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(7).setAlpha(0.85);
    this.tweens.add({ targets: arrow, x: this.goalX - 36, alpha: 0.3, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  }

  // Colore del cerume per TIPO (ricolora lo sprite ambra) e scurito col danno (k = vita 0..1).
  _waxTint(type, k) {
    const base = { soft: 0xffffff, hard: 0xd59a2e, dirt: 0x9a7040 }[type] || 0xffffff;
    if (k >= 1) return base;
    const f = 0.5 + 0.5 * Phaser.Math.Clamp(k, 0, 1);   // fino a metà luminosità quando quasi distrutto
    const r = (base >> 16) & 255, g = (base >> 8) & 255, b = base & 255;
    return ((r * f | 0) << 16) | ((g * f | 0) << 8) | (b * f | 0);
  }

  // Costruisce il MURO DI CERUME coi pezzi/sprite AI: uno sprite-chunk per ogni blocco fisico
  // (variante deterministica, ricolorato per tipo, largo così si sovrappone ai vicini = massa
  // continua, non palline). Sotto le sporgenze (nessun blocco sotto) aggiunge una goccia/colata.
  // I blocchi restano la fisica/gameplay invisibile; questi sprite sono solo il "vestito".
  buildWaxSprites() {
    const B = window.CONFIG.BLOCK;
    const CH = ['wax_a', 'wax_b', 'wax_c', 'wax_d'];
    const DR = ['wax_drip_a', 'wax_drip_b'];
    const h = (n) => { const x = Math.abs(Math.sin(n) * 43758.5453); return x - Math.floor(x); };  // hash deterministico
    const blocks = this.blocks.getChildren().filter((b) => b.active);
    const occ = new Set(blocks.map((b) => b.col + ',' + b.row));
    blocks.forEach((b) => {
      if (b.waxImg) { b.waxImg.destroy(); b.waxImg = null; }
      if (b.waxDrip) { b.waxDrip.destroy(); b.waxDrip = null; }
      const seed = b.col * 13.1 + b.row * 7.7;
      const key = CH[Math.floor(h(seed) * CH.length) % CH.length];
      const src = this.textures.get(key).getSourceImage();
      // "Traballamento" organico: offset/scala/rotazione variabili -> cumulo irregolare, non colonna dritta.
      const ox = (h(seed + 1) - 0.5) * B * 0.55;
      const oy = (h(seed + 2) - 0.5) * B * 0.35;
      const img = this.add.image(b.x + ox, b.y + oy, key).setDepth(6);
      img.setScale((B * 2.2) / src.width * (0.82 + h(seed + 3) * 0.45));   // grandi + sovrapposti = fusi
      img.setAngle((h(seed + 4) - 0.5) * 26);
      if (h(seed + 5) < 0.5) img.setFlipX(true);
      img.setTint(this._waxTint(b.waxType, 1));
      if (this.waxLayer) this.waxLayer.add(img);   // nel livello sfocato -> globi fusi
      b.waxImg = img;
      b.waxOX = ox; b.waxOY = oy;
      // dati per l'animazione "fluida" (ondeggio) in animateWax()
      b.waxSeed = seed;
      b.waxBaseX = b.x + ox; b.waxBaseY = b.y + oy;
      b.waxBaseS = img.scaleX;
      // Goccia sotto lo sporto basso (niente blocco sotto): effetto colata.
      if (b.row > 0 && !occ.has(b.col + ',' + (b.row - 1))) {
        const dk = DR[Math.floor(h(seed + 6) * DR.length) % DR.length];
        const dsrc = this.textures.get(dk).getSourceImage();
        const d = this.add.image(b.x + ox, b.y + B * 0.3, dk).setOrigin(0.5, 0).setDepth(6);
        d.setScale((B * 1.2) / dsrc.width);
        d.setTint(this._waxTint(b.waxType, 1));
        if (this.waxLayer) this.waxLayer.add(d);
        b.waxDrip = d;
        b.waxDripBaseS = d.scaleY;
      }
    });
    this.drawWaxBase();
  }

  // Riempimento continuo (base scura) dietro agli sprite: chiude i vuoti tra un pezzo e l'altro
  // così la massa sembra UNICA. Ridisegnato quando un blocco viene distrutto (la massa si ritira).
  drawWaxBase() {
    const g = this.waxGfx;
    if (!g) return;
    const C = window.CONFIG.COLORS, B = window.CONFIG.BLOCK;
    g.clear();
    const blocks = this.blocks.getChildren().filter((b) => b.active);
    if (!blocks.length) return;
    const BASE = { soft: C.waxSoftDark, hard: C.waxHardDark, dirt: C.dirtDark };
    const byCol = {};
    blocks.forEach((b) => { (byCol[b.col] || (byCol[b.col] = [])).push(b); });
    Object.keys(byCol).forEach((col) => {
      const arr = byCol[col].sort((a, b) => a.row - b.row);
      let run = [arr[0]];
      const flush = () => {
        const top = run[run.length - 1], bot = run[0];
        const x = bot.x, w = B * 1.7, tY = top.y - B / 2, bY = bot.y + B / 2;
        g.fillStyle(BASE[top.waxType], 1);
        g.fillRect(x - w / 2, tY, w, bY - tY);
        g.fillEllipse(x, tY, w, w * 0.6);
      };
      for (let i = 1; i < arr.length; i++) { if (arr[i].row === arr[i - 1].row + 1) run.push(arr[i]); else { flush(); run = [arr[i]]; } }
      flush();
    });
  }

  // Animazione "fluida" del cerume: la superficie ONDEGGIA dolcemente (sinusoidi sfasate per
  // pezzo) e le gocce COLANO (si allungano/ritirano). Con la fusione del waxLayer la massa
  // sembra un liquido vivo invece di un blocco fermo. Chiamata da update().
  // Ondeggio del cerume SOLO QUANDO COLPITO: ogni pezzo colpito (e i vicini, vedi
  // wobbleWaxNear) riceve un impulso che oscilla e DECADE, poi torna fermo. Niente
  // movimento costante. Chiamata in update().
  animateWax(time) {
    if (!this.blocks) return;
    const now = time, DUR = 520;
    const kids = this.blocks.getChildren();
    for (let i = 0; i < kids.length; i++) {
      const b = kids[i];
      if (!b.active || !b.waxImg) continue;
      const img = b.waxImg;
      if (b.waxHitAt) {
        const e = now - b.waxHitAt;
        if (e < DUR) {
          const amp = 1 - e / DUR;                       // decade a zero
          const w = Math.sin(e * 0.045 + b.waxSeed) * amp;
          img.x = b.waxBaseX + w * 3.0;
          img.y = b.waxBaseY + Math.cos(e * 0.038 + b.waxSeed) * amp * 4.0;
          img.scaleX = b.waxBaseS * (1 + w * 0.07);
          img.scaleY = b.waxBaseS * (1 - w * 0.07);
          if (b.waxDrip) b.waxDrip.scaleY = b.waxDripBaseS * (1 + amp * 0.3);
          continue;
        }
        b.waxHitAt = 0;                                  // finito -> riposo
        img.x = b.waxBaseX; img.y = b.waxBaseY; img.scaleX = b.waxBaseS; img.scaleY = b.waxBaseS;
        if (b.waxDrip) b.waxDrip.scaleY = b.waxDripBaseS;
      }
    }
  }

  // Dà l'impulso di ondeggio ai pezzi di cerume vicini al punto colpito (onda d'urto locale).
  wobbleWaxNear(x, y) {
    if (!this.blocks) return;
    const now = this.time.now, R = 74;
    this.blocks.getChildren().forEach((o) => {
      if (!o.active || !o.waxImg) return;
      if (Math.abs(o.x - x) < R && Math.abs(o.y - y) < R) o.waxHitAt = now;
    });
  }

  // GRAVITÀ A CELLE: dopo aver pulito un blocco, i blocchi della colonna che stanno sopra
  // SCENDONO a riempire i vuoti (verso il pavimento), così una membrana pulita alla base
  // COLLASSA in un cumulo. I blocchi "da soffitto" (ceiling) NON cadono (restano appesi).
  settleWaxColumn(col) {
    const B = window.CONFIG.BLOCK;
    const inCol = this.blocks.getChildren()
      .filter((b) => b.active && b.col === col && !b.ceiling)
      .sort((a, b) => a.row - b.row);
    let target = 0, moved = false;
    inCol.forEach((b) => {
      if (b.row !== target) {                          // c'è un vuoto sotto: cade
        b.row = target;
        const newY = this.groundTop - target * B - B / 2;
        b.y = newY; b.refreshBody();                   // fisica (collider) subito alla nuova quota
        const newBaseY = newY + (b.waxOY || 0);
        b.waxBaseY = newBaseY;
        if (b.waxImg && !b.waxHitAt) this.tweens.add({ targets: b.waxImg, y: newBaseY, duration: 170, ease: 'Quad.in' });
        else if (b.waxImg) b.waxImg.y = newBaseY;
        if (b.waxDrip) this.tweens.add({ targets: b.waxDrip, y: newY + B * 0.3, duration: 170, ease: 'Quad.in' });
        moved = true;
      }
      target++;
    });
    if (moved) this.drawWaxBase();
  }

  // Disegno del muro di cerume (vecchio, a palle) e splat di feedback: vedi GameGfx in src/gfx.js.
  drawWax() { window.GameGfx.drawWax(this); }
  splat(x, y, type) { window.GameGfx.splat(this, x, y, type); }

  // Sceglie a caso un tipo di nemico tra quelli sbloccati al livello attuale.
  chooseEnemyKind() {
    const lvl = window.GameState.level;
    const pool = [['blob', 5]];
    if (lvl >= 2) pool.push(['crust', 3]);
    if (lvl >= 3) pool.push(['spit', 2]);
    if (lvl >= 4) pool.push(['fly', 2]);
    let total = 0;
    pool.forEach((p) => { total += p[1]; });
    let r = Math.random() * total;
    for (let i = 0; i < pool.length; i++) {
      r -= pool[i][1];
      if (r < 0) return pool[i][0];
    }
    return 'blob';
  }

  spawnEnemy(kind, opts) {
    opts = opts || {};
    const W = window.CONFIG.WIDTH;
    const H = window.CONFIG.HEIGHT;
    const gh = window.CONFIG.GROUND_H;
    const lvl = window.GameState.level;
    kind = kind || this.chooseEnemyKind();

    // Tabella dei tipi di nemico (statistiche scalate col livello).
    let cfg;
    if (kind === 'crust') {
      cfg = { tex: 'enemy_crust', hp: 60 + lvl * 6, speed: 46, dmg: 16 + lvl * 2, wax: 8, bit: 'bit_dirt', body: [26, 22], scale: 1.6 };
    } else if (kind === 'fly') {
      cfg = { tex: 'enemy_fly', hp: 24 + lvl * 3, speed: 88 + lvl * 4, dmg: 10 + lvl * 2, wax: 7, bit: 'bit_wax', body: [24, 18], fly: true };
    } else if (kind === 'spit') {
      cfg = { tex: 'enemy_spit', hp: 45 + lvl * 5, speed: 28, dmg: 12 + lvl, wax: 9, bit: 'bit_dirt', body: [26, 24], spit: true, projDmg: 9 + lvl * 2, spitEvery: 2200 };
    } else if (kind === 'boss') {
      cfg = { tex: 'enemy_boss', hp: 420 + lvl * 40, speed: 34, dmg: 20 + lvl * 2, wax: 60 + lvl * 6, bit: 'bit_hard', body: [60, 54], spit: true, projDmg: 12 + lvl * 2, spitEvery: 1500, boss: true };
    } else {
      cfg = { tex: 'enemy_blob', hp: 30 + lvl * 4, speed: 72 + lvl * 3, dmg: 11 + lvl * 2, wax: 5, bit: 'bit_wax', body: [26, 22], scale: 1.6 };
    }

    // Posizione di comparsa: i volanti calano dal soffitto, gli altri emergono dal
    // terreno in punti lontani dal giocatore (il boss esce verso destra).
    const groundTop = H - gh;
    const targetScale = cfg.scale || 1;
    // L'hitbox scala con lo sprite: la quota di riposo va calcolata con l'altezza
    // GIA' scalata, così il corpo appoggia esattamente sul pavimento (niente
    // sprofondamento sotto la linea del terreno).
    const restY = groundTop - (cfg.body[1] * targetScale) / 2;
    let x, y;
    if (cfg.fly) {
      // Cala dal soffitto a distanza onesta dal giocatore (mai addosso alla partenza),
      // di solito davanti a lui verso il timpano.
      const camW = this.cameras.main.width;
      const ahead = Math.random() < 0.7 ? 1 : -1;
      x = Phaser.Math.Clamp(this.player.x + ahead * Phaser.Math.Between(camW * 0.30, camW * 0.5), 60, this.worldW - 60);
      y = -24;                                   // parte sopra lo schermo
    } else if (cfg.boss) {
      x = Phaser.Math.Clamp(this.goalX - 260, 700, this.worldW - 200);  // fa la guardia al timpano in fondo
      y = restY;                                 // a livello del pavimento
    } else {
      // Posizione fissa (guardiano di una membrana) oppure scelta automatica.
      x = (opts.x !== undefined) ? Phaser.Math.Clamp(opts.x, 60, this.worldW - 60) : this.pickGroundX();
      y = restY;
    }

    const e = this.enemies.create(x, y, cfg.tex).setDepth(cfg.boss ? 9 : 8);
    e.kind = kind;
    if (opts.guard !== undefined) { e.guard = true; e.homeX = opts.guard; e.guardRange = 430; }
    e.spawning = true;                            // ancora in fase di comparsa: inerte
    e.setCollideWorldBounds(true);
    if (cfg.fly) e.body.setAllowGravity(false);
    else e.setBounce(0.1);
    e.body.setSize(cfg.body[0], cfg.body[1], true);
    e.hp = cfg.hp; e.maxHp = cfg.hp;
    e.speed = cfg.speed;
    e.contactDamage = cfg.dmg;
    e.waxValue = cfg.wax;
    e.bitKey = cfg.bit;
    e.knockUntil = 0;
    if (cfg.spit) {
      e.projDamage = cfg.projDmg;
      e.spitEvery = cfg.spitEvery;
      e.nextSpit = this.time.now + Phaser.Math.Between(700, cfg.spitEvery);
    }
    if (cfg.fly) {
      e.diveState = 'hover';                                    // stato IA volo (vedi flyAI)
      e.diveReadyAt = this.time.now + Phaser.Math.Between(1000, 1800);
      e.bobPhase = Phaser.Math.FloatBetween(0, Math.PI * 2);    // sfasa l'ondeggio tra i moscerini
    }

    // Comparsa animata (la scala finale dipende dal tipo: i PNG nativi vanno ingranditi).
    if (cfg.fly) this.dropFromCeiling(e, targetScale);
    else this.emergeFromGround(e, targetScale, y, x, groundTop, !!cfg.boss);
    return e;
  }

  // Mette un nemico di guardia davanti ad alcune membrane piene: resta a presidiare
  // la membrana finche' il giocatore non si avvicina (vedi la logica "guard" in update).
  spawnGuardians() {
    const lvl = window.GameState.level;
    const ground = ['blob'];
    if (lvl >= 2) ground.push('crust');
    if (lvl >= 3) ground.push('spit');
    (this.membranes || []).forEach((m) => {
      if (m.type !== 'full') return;
      if (Math.random() < 0.25) return;            // non tutte ne hanno una
      const gx = m.x - 70;                         // appena prima della membrana
      const kind = Phaser.Utils.Array.GetRandom(ground);
      this.spawnEnemy(kind, { x: gx, guard: gx });
    });
  }

  // Sceglie un punto di spawn a terra DENTRO la "sezione" attuale del giocatore: cioe'
  // tra la membrana subito dietro e quella subito davanti. Cosi' i nemici possono
  // davvero raggiungerlo (non restano bloccati e ammucchiati contro una membrana) e
  // non compaiono mai addosso al giocatore.
  pickGroundX() {
    const px = this.player.x;
    let left = 40, right = this.worldW - 40;
    (this.membraneXs || []).forEach((mx) => {
      if (mx <= px) { if (mx + 80 > left) left = mx + 80; }     // appena dopo la membrana dietro
      else { if (mx - 80 < right) right = mx - 80; }            // appena prima della membrana davanti
    });
    if (right <= left) return Math.round(Phaser.Math.Clamp(px, 40, this.worldW - 40));

    const gap = 200;                                            // distanza minima dal giocatore
    const aLo = Math.min(px + gap, right), aHi = right;         // davanti
    const bLo = left, bHi = Math.max(px - gap, left);           // dietro
    const aOk = aHi - aLo > 20, bOk = bHi - bLo > 20;
    let x;
    if (aOk && (Math.random() < 0.7 || !bOk)) x = Phaser.Math.Between(aLo, aHi);
    else if (bOk) x = Phaser.Math.Between(bLo, bHi);
    else x = Phaser.Math.Clamp(px + gap, left, right);          // sezione stretta: il meglio possibile
    return Math.round(x);
  }

  // Il nemico sbuca dal pavimento: parte schiacciato a terra e "cresce" in altezza.
  // La gravità resta ATTIVA: il collider tiene il corpo appoggiato al pavimento mentre
  // lo sprite si allunga verso l'alto (così non sprofonda mai sotto la linea del terreno).
  emergeFromGround(e, targetScale, restY, x, groundTop, big) {
    e.setScale(targetScale, targetScale * 0.12);  // appiattito a terra
    e.setAlpha(0.9);
    this.groundPuff(x, groundTop, big);
    if (big) this.cameras.main.shake(220, 0.009);
    window.Sfx.emerge(big);
    this.tweens.add({
      targets: e, scaleY: targetScale, alpha: 1,
      duration: big ? 600 : 380, ease: 'Back.out',
      onComplete: () => {
        e.spawning = false;
        // assestamento gommoso
        this.tweens.add({ targets: e, scaleX: targetScale * 1.1, scaleY: targetScale * 0.9, yoyo: true, duration: 90 });
      },
    });
  }

  // Il volante cala dal soffitto con un piccolo rimbalzo elastico.
  dropFromCeiling(e, targetScale) {
    const restY = Phaser.Math.Between(90, 170);
    e.setScale(targetScale * 0.5);
    e.setVelocity(0, 0);
    this.ceilingDrip(e.x, restY);
    window.Sfx.emerge(false);
    this.tweens.add({ targets: e, scaleX: targetScale, scaleY: targetScale, duration: 420, ease: 'Quad.out' });
    this.tweens.add({
      targets: e, y: restY, duration: 560, ease: 'Bounce.out',
      onComplete: () => { e.spawning = false; },
    });
  }

  // Sbuffo dal pavimento e filo di cerume dal soffitto: vedi GameGfx in src/gfx.js.
  groundPuff(x, groundTop, big) { window.GameGfx.groundPuff(this, x, groundTop, big); }
  ceilingDrip(x, restY) { window.GameGfx.ceilingDrip(this, x, restY); }

  // Una pallina di cerume sputata da un nemico: vola in PARABOLA (cade per gravità)
  // mirando alla posizione attuale del giocatore. Curva = più realistica e schivabile.
  spitAt(e, aimOff) {
    const g = window.CONFIG.GRAVITY;
    const dir = Math.sign(this.player.x - e.x) || 1;
    const sx = e.x + dir * 12, sy = e.y - 6;
    const dx = (this.player.x + (aimOff || 0)) - sx;
    const dy = (this.player.y - 8) - sy;
    const dist = Math.hypot(dx, dy);
    const T = Phaser.Math.Clamp(dist / 230, 0.65, 1.25);  // tempo di volo (piu' lungo = pallina piu' lenta)
    const vx = dx / T;
    const vy = (dy - 0.5 * g * T * T) / T;               // soluzione balistica
    const proj = this.projectiles.create(sx, sy, 'wax_glob').setDepth(9);
    proj.body.setAllowGravity(true);                     // cade in parabola
    proj.body.setSize(10, 10, true);
    proj.setVelocity(vx, vy);
    proj.setAngularVelocity(Phaser.Math.Between(-360, 360));  // rotea mentre vola
    proj.dmg = e.projDamage;
    window.Sfx.spit();
    this.time.delayedCall(3200, () => { if (proj.active) proj.destroy(); });
  }

  popProjectile(proj) {
    if (!proj || !proj.active) return;
    this.burst('bit_wax', proj.x, proj.y, 4);
    proj.destroy();
  }

  // Cartello a schermo per annunciare i livelli speciali: vedi GameGfx in src/gfx.js.
  showBanner(text, color) { window.GameGfx.showBanner(this, text, color); }

  // ---------- Combattimento ----------

  // Texture procedurale per la pallina del getto (acqua e sapone): nessun file.
  makeSoapTexture() {
    if (this.textures.exists('soap')) return;
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0x9fd8ff, 1); g.fillCircle(7, 7, 6);
    g.fillStyle(0xffffff, 0.85); g.fillCircle(5, 5, 2.4);
    g.generateTexture('soap', 14, 14);
    g.destroy();
  }

  // Spruzza un getto di acqua e sapone nella direzione di mira (8 direzioni):
  // pulisce il cerume e colpisce i nemici a distanza.
  fireJet(adx, ady) {
    const now = this.time.now;
    const p = window.GameState.player;
    if (now - this.lastShot < p.shotCooldown) return;
    this.lastShot = now;
    const d = Math.hypot(adx, ady) || 1;
    const nx = adx / d, ny = ady / d;
    const oy = this.crouching ? 14 : -6;   // accovacciato: il getto parte all'altezza dei piedi
    // Abilità VENTAGLIO: 3 palline a ±angolo; altrimenti una sola.
    if (p.jetSpread) {
      const a0 = Math.atan2(ny, nx);
      [-0.2, 0, 0.2].forEach((da) => this.spawnPellet(Math.cos(a0 + da), Math.sin(a0 + da), oy, p));
    } else {
      this.spawnPellet(nx, ny, oy, p);
    }
    window.Sfx.spray();
  }

  // Crea una singola pallina di getto (usata da fireJet, anche a ventaglio).
  spawnPellet(nx, ny, oy, p) {
    const sp = 580;
    const s = this.shots.create(this.player.x + nx * 18, this.player.y + oy + ny * 14, 'soap').setDepth(9);
    s.body.setAllowGravity(false);
    s.body.setSize(10, 10, true);
    s.setVelocity(nx * sp, ny * sp);
    s.dmg = p.jetDamage;
    s.pierceLeft = p.jetPierce ? 3 : 1;    // abilità PERFORANTE
    s.splash = p.jetSplash;                // abilità SCOPPIO DI SAPONE (area all'impatto)
    const flash = this.add.circle(this.player.x + nx * 20, this.player.y + oy + ny * 20, 7, 0xdff3ff, 0.9).setDepth(11);
    this.tweens.add({ targets: flash, scale: 0.2, alpha: 0, duration: 120, ease: 'Quad.out', onComplete: () => flash.destroy() });
    this.time.delayedCall(850, () => { if (s.active) s.destroy(); });
  }

  popShot(s) {
    if (!s || !s.active) return;
    this.splat(s.x, s.y, 'soft');
    if (s.splash) this.soapSplash(s.x, s.y);   // abilità: scoppio ad area all'impatto
    s.destroy();
  }

  // Scoppio di sapone (abilità SPLASH): quando una pallina finisce, fa un piccolo scoppio
  // che pulisce il cerume e danneggia i nemici in un raggio ridotto. Danno = frazione del getto.
  soapSplash(x, y) {
    const R = 48;
    const dmg = Math.max(4, Math.round(window.GameState.player.jetDamage * 0.6));
    const ring = this.add.circle(x, y, R, 0xdff3ff, 0.35).setDepth(11).setScale(0.25);
    this.tweens.add({ targets: ring, scale: 1, alpha: 0, duration: 220, ease: 'Quad.out', onComplete: () => ring.destroy() });
    window.Sfx.spray();
    this.enemies.getChildren().forEach((e) => {
      if (e.active && !e.spawning && Math.hypot(e.x - x, e.y - y) < R) this.damageEnemy(e, dmg);
    });
    this.blocks.getChildren().forEach((b) => {
      if (b.active && Math.hypot(b.x - x, b.y - y) < R) this.damageBlock(b, dmg);
    });
  }

  // Cerca un nemico a distanza da bastonata (per l'attacco "intelligente": se c'e' un
  // nemico vicino il tasto attacco fa la mazzata invece del getto). Ritorna il nemico o null.
  meleeTargetNear() {
    const px = this.player.x, py = this.player.y;
    let target = null;
    this.enemies.getChildren().forEach((e) => {
      if (!e.active || e.spawning) return;
      if (Math.abs(e.x - px) < 58 && Math.abs(e.y - py) < 56) target = e;
    });
    return target;
  }

  // Cerca un BLOCCO di cerume a portata di mazza (per bastonarlo e ripulirlo più in fretta
  // che col getto quando gli sei addosso). Ritorna il blocco più vicino davanti a te, o null.
  meleeWaxNear() {
    const px = this.player.x, py = this.player.y;
    let best = null, bd = 1e9;
    this.blocks.getChildren().forEach((b) => {
      if (!b.active) return;
      const dx = Math.abs(b.x - px), dy = Math.abs(b.y - py);
      if (dx < 46 && dy < 44) { const d = dx + dy; if (d < bd) { bd = d; best = b; } }
    });
    return best;
  }

  // Bastonata verso il bersaglio vicino (nemico O blocco di cerume). Rispetta la cadenza.
  doMelee(now, target) {
    const p = window.GameState.player;
    if (now - this.lastAttack < p.attackCooldown) return;
    this.lastAttack = now;
    this.facing = Math.sign(target.x - this.player.x) || this.facing;
    this.meleeSwing();
  }

  // Il colpo corpo a corpo vero e proprio (coton fioc, o martello se sbloccato).
  meleeSwing() {
    const p = window.GameState.player;
    window.Sfx.hit();
    const isHammer = p.weapon === 'hammer';
    const baseRange = isHammer ? 64 : 50;
    const range = baseRange * p.attackRange;
    const halfH = isHammer ? 46 : 30;
    const cy = this.crouching ? 16 : 0;   // accovacciato: colpo più in basso (nemici bassi)
    const ax = this.facing > 0 ? this.player.x + 4 : this.player.x - range - 4;
    const rect = new Phaser.Geom.Rectangle(ax, this.player.y - halfH + cy, range, halfH * 2);
    this.showWeaponSwing(this.facing, isHammer);
    let hitEnemy = false, hitAny = false;
    this.blocks.getChildren().forEach((b) => {
      if (b.active && Phaser.Geom.Intersects.RectangleToRectangle(rect, b.getBounds())) { this.damageBlock(b, p.damage); hitAny = true; }
    });
    const hitSet = new Set();
    this.enemies.getChildren().forEach((e) => {
      if (e.active && !e.spawning && Phaser.Geom.Intersects.RectangleToRectangle(rect, e.getBounds())) { this.damageEnemy(e, p.damage, true); hitEnemy = true; hitAny = true; hitSet.add(e); }
    });
    // Abilità ONDA D'URTO: la bastonata colpisce ANCHE i nemici in un raggio attorno a te
    // (danno ridotto), non solo quelli davanti. Ottima contro i gruppi.
    if (p.meleeBlast) {
      const R = 84, bd = Math.max(6, Math.round(p.damage * 0.55));
      let blasted = false;
      this.enemies.getChildren().forEach((e) => {
        if (e.active && !e.spawning && !hitSet.has(e) && Math.hypot(e.x - this.player.x, e.y - this.player.y) < R) {
          this.damageEnemy(e, bd, true); hitEnemy = true; hitAny = true; blasted = true;
        }
      });
      if (hitAny) this.blastFx(R);   // anello d'urto quando la mazzata connette
    }
    // IMPATTO: quando la mazzata CONNETTE, micro-pausa (hit-stop) + tremolio -> peso.
    // Piu' forte sui nemici e col martello; leggero sul solo cerume.
    if (hitAny) {
      this.cameras.main.shake(hitEnemy ? 130 : 60, hitEnemy ? 0.010 : 0.004);
      this.hitStop(isHammer ? 95 : (hitEnemy ? 78 : 40));
    }
  }

  // Anello dell'ONDA D'URTO: cerchio giallo che si espande attorno al giocatore.
  blastFx(R) {
    const ring = this.add.circle(this.player.x, this.player.y, R || 84, 0xffe08a, 0.18).setDepth(11).setScale(0.3);
    this.tweens.add({ targets: ring, scale: 1, alpha: 0, duration: 240, ease: 'Quad.out', onComplete: () => ring.destroy() });
  }

  // "Hit-stop": congela brevemente la fisica all'impatto per dare peso ai colpi. Non si
  // accumula (se gia' in pausa, ignora) e riprende sempre dopo ms.
  hitStop(ms) {
    if (this._hitStopUntil && this.time.now < this._hitStopUntil) return;
    this._hitStopUntil = this.time.now + ms;
    this.physics.world.pause();
    this.time.delayedCall(ms, () => this.physics.world.resume());
  }

  // Animazione dell'arma all'attacco: vedi GameGfx in src/gfx.js.
  showWeaponSwing(facing, isHammer) { window.GameGfx.showWeaponSwing(this, facing, isHammer); }

  damageBlock(b, dmg) {
    b.hp -= dmg;
    this.wobbleWaxNear(b.x, b.y);   // ondeggio locale al punto colpito
    if (b.hp <= 0) {
      window.Sfx.smash();
      this.burst(b.bitKey, b.x, b.y, 14);
      this.splat(b.x, b.y, b.waxType);
      window.GameState.wax += b.waxValue;
      this.cleanedWax = (this.cleanedWax || 0) + b.waxValue;   // per la % "pulito"
      const dcol = b.col;
      if (b.waxImg) b.waxImg.destroy();
      if (b.waxDrip) b.waxDrip.destroy();
      b.destroy();
      this.blocksLeft = this.blocks.countActive(true);
      this.settleWaxColumn(dcol);   // i pezzi sopra scendono (collasso a cumulo)
      this.drawWaxBase();           // la massa si ritira/ricompatta dove hai pulito
    } else {
      window.Sfx.crack();
      this.burst(b.bitKey, b.x, b.y, 3);
      // Il pezzo si scurisce man mano che lo consumi.
      if (b.waxImg) b.waxImg.setTint(this._waxTint(b.waxType, Phaser.Math.Clamp(b.hp / b.maxHp, 0, 1)));
    }
  }

  // heavy = colpo PESANTE (bastonata corpo a corpo): flash piu' lungo, "pop" di reazione
  // piu' marcato e rinculo maggiore. Senza heavy (es. pallina del getto) l'impatto c'e'
  // ma piu' contenuto, cosi' il corpo a corpo "pesa" piu' del getto.
  damageEnemy(e, dmg, heavy) {
    // CROSTA = corazzata anti-getto: il GETTO (non heavy) la scalfisce appena e rimbalza
    // con un "clang"; solo il CORPO A CORPO (heavy) la abbatte come si deve.
    const armored = (e.kind === 'crust' && !heavy);
    if (armored) dmg = Math.max(2, Math.round(dmg * 0.3));   // il getto la scalfisce: poco ma visibile
    e.hp -= dmg;

    e.setTintFill(armored ? 0xbfe0ff : 0xffffff);
    this.time.delayedCall(armored ? 55 : (heavy ? 95 : 75), () => { if (e.active) e.clearTint(); });

    if (armored) {
      // Guscio che respinge: scintilla + "clang", niente pop nè rinculo (sembra invulnerabile davanti).
      window.Sfx.crack();
      this.splat(e.x + (this.player.x < e.x ? -12 : 12), e.y - 4, 'hard');
    } else {
      // Pop di reazione: il nemico "sussulta" quando viene colpito (impatto visibile).
      if (e.kind !== 'boss') {
        const bs = e._baseScale || (e._baseScale = e.scaleX);
        e.setScale(bs * (heavy ? 1.22 : 1.13));
        this.time.delayedCall(85, () => { if (e.active && e._baseScale) e.setScale(e._baseScale); });
      }
      const dir = Math.sign(e.x - this.player.x) || 1;
      // Il Boss è massiccio: subisce molta meno spinta. La bastonata (heavy) spinge di piu' del getto.
      const boss = e.kind === 'boss';
      const kbX = boss ? (heavy ? 100 : 70) : (heavy ? 300 : 215);
      const kbY = boss ? (heavy ? -70 : -60) : (heavy ? -205 : -150);
      e.setVelocity(dir * kbX, kbY);
      e.knockUntil = this.time.now + (heavy ? 260 : 190);
      // Un colpo INTERROMPE l'attacco in carica/affondo del nemico (ricompensa il colpire per primo).
      if (e.atkState && e.atkState !== 'idle') { e.atkState = 'idle'; e.atkReadyAt = this.time.now + 500; if (e._baseScale) e.setScale(e._baseScale); }
      // Idem per il moscerino: un colpo lo butta fuori dalla carica/picchiata.
      if (e.kind === 'fly' && e.diveState && e.diveState !== 'hover') { e.diveState = 'recover'; e.diveReadyAt = this.time.now + 900; e.clearTint(); }
    }
    if (e.hp <= 0) {
      window.Sfx.enemyDie();
      window.GameState.wax += e.waxValue;
      // Abilità VITA RUBATA: uccidere cura un po' (piu' col boss).
      const pl = window.GameState.player;
      if (pl.lifesteal) {
        const heal = e.kind === 'boss' ? 25 : 3;
        pl.hp = Math.min(pl.maxHp, pl.hp + heal);
        this.healFx(this.player.x, this.player.y);
      }
      if (e.kind === 'boss') {
        this.cameras.main.shake(260, 0.014);
        this.burst(e.bitKey, e.x, e.y, 28);
        this.showBanner(window.I18n.t('game_boss_dead', { wax: e.waxValue }), '#ffd166');
      } else {
        this.cameras.main.shake(110, 0.009);
        this.hitStop(85);
        this.burst(e.bitKey, e.x, e.y, 18);
      }
      e.destroy();
    }
  }

  // IA dei nemici a terra "melee" (cerumino, crosta): oltre a camminare verso il
  // giocatore, quando gli e' vicino esegue un AFFONDO TELEGRAFATO:
  //   idle (cammina) -> windup (si accovaccia + lampeggia ~0,42s = telegrafo) ->
  //   lunge (balzo verso il giocatore ~0,32s) -> recupero prima del prossimo affondo.
  // Cosi' lo scontro diventa "leggi e reagisci": puoi schivare (salto/scatto) o
  // colpirlo durante la carica per interromperlo (vedi damageEnemy).
  groundEnemyAI(e, now) {
    const dx = this.player.x - e.x;
    const dir = Math.sign(dx) || (e.lungeDir || 1);

    if (e.atkState === 'windup') {
      e.setVelocityX(0);
      e.setTint((Math.floor(now / 90) % 2) ? 0xffe066 : 0xffffff);  // lampeggia = "sta per saltare"
      if (now >= e.windupUntil) {                       // fine carica -> parte l'affondo
        e.atkState = 'lunge';
        e.lungeUntil = now + 320;
        e.clearTint();
        if (e._baseScale) e.setScale(e._baseScale);
        e.setVelocity(e.lungeDir * (e.speed * 3.0 + 120), -190);
      }
      return;
    }
    if (e.atkState === 'lunge') {
      e.setFlipX(e.lungeDir < 0);
      if (now >= e.lungeUntil) {                         // atterrato/finito -> recupero
        e.atkState = 'idle';
        e.atkReadyAt = now + 750;
        e.setVelocityX(0);
      }
      return;                                            // durante il balzo mantiene lo slancio
    }

    // idle: se il giocatore e' vicino ed e' pronto, inizia la carica; altrimenti cammina.
    const near = Math.abs(dx) < 155 && Math.abs(this.player.y - e.y) < 72;
    if (near && now >= (e.atkReadyAt || 0) && (e.body.blocked.down || e.body.touching.down)) {
      e.atkState = 'windup';
      e.windupUntil = now + 420;
      e.lungeDir = dir;
      e.setVelocityX(0);
      e.setTint(0xffe066);                               // telegrafo: lampeggia caldo
      const bs = e._baseScale || (e._baseScale = e.scaleX);
      e.setScale(bs * 1.22, bs * 0.8);                   // si accovaccia (carica il balzo)
      e.setFlipX(dir < 0);
      return;
    }
    e.setVelocityX(dir * e.speed);
    e.setFlipX(dir < 0);
  }

  // IA del BOSS (Tappo di Cerume): avanza lento e SPUTA con telegrafo (breve carica
  // lampeggiante prima del lancio). A META' VITA si INFURIA: sputo piu' frequente e a
  // VENTAGLIO (3 vie) ed evoca ogni tanto un cerumino. Chiamato dal loop nemici.
  bossAI(e, now) {
    const dir = Math.sign(this.player.x - e.x) || 1;
    e.setVelocityX(dir * e.speed);
    e.setFlipX(dir < 0);

    const enraged = e.hp <= e.maxHp * 0.5;
    if (enraged && !e._enraged) {                 // passaggio di fase
      e._enraged = true;
      this.cameras.main.shake(200, 0.01);
      this.showBanner(window.I18n.t('game_boss_enrage'), '#ff7043');
      e.spitEvery = Math.max(700, Math.round(e.spitEvery * 0.6));
      e._summonAt = now + 2500;
    }

    // Sputo con TELEGRAFO: quando è ora di sputare, lampeggia ~0,32s poi lancia.
    if (now >= (e.nextSpit || 0)) {
      if (!e.spitWindupAt) e.spitWindupAt = now;
      e.setTint((Math.floor(now / 80) % 2) ? 0xffe066 : 0xffffff);
      if (now - e.spitWindupAt >= 320) {
        e.clearTint(); e.spitWindupAt = 0;
        if (enraged) { this.spitAt(e, -150); this.spitAt(e, 0); this.spitAt(e, 150); }  // ventaglio 3 vie
        else this.spitAt(e, 0);
        e.nextSpit = now + e.spitEvery;
      }
    }

    // In furia: evoca uno sgherro ogni tanto (se non ce ne sono già troppi).
    if (enraged && now >= (e._summonAt || Number.MAX_SAFE_INTEGER)) {
      if (this.enemies.countActive(true) < 4) this.spawnEnemy('blob');
      e._summonAt = now + 5000;
    }
  }

  // IA del GORGOGLIANTE (nemico azzurrino a distanza): avanza lento verso il giocatore;
  // quando è pronto e il giocatore è NELL'INQUADRATURA, si CARICA (si comprime + lampeggia
  // ~0,3s) e poi ESPELLE la pallina. Fuori campo NON spara (range d'attacco limitato).
  spitEnemyAI(e, now, onScreen) {
    const dir = Math.sign(this.player.x - e.x) || 1;
    e.setFlipX(dir < 0);

    // Carica in corso: fermo, si comprime, poi lancia.
    if (e.spitWindupAt) {
      e.setVelocityX(0);
      const bs = e._baseScale || (e._baseScale = e.scaleX);
      const t = Phaser.Math.Clamp((now - e.spitWindupAt) / 300, 0, 1);
      e.setScale(bs * (1 + 0.18 * t), bs * (1 - 0.16 * t));           // si comprime (carica)
      e.setTint((Math.floor(now / 70) % 2) ? 0x9fe0ff : 0xffffff);
      if (now - e.spitWindupAt >= 300) {
        e.setScale(bs); e.clearTint(); e.spitWindupAt = 0;
        this.spitAt(e);                                              // espelle
        e.nextSpit = now + e.spitEvery;
      }
      return;
    }
    // Pronto e giocatore in vista: inizia la carica.
    if (onScreen && now >= (e.nextSpit || 0)) {
      e.spitWindupAt = now;
      e.setVelocityX(0);
      return;
    }
    // Altrimenti avanza lento verso il giocatore.
    e.setVelocityX(dir * e.speed);
  }

  // IA del MOSCERINO (volante): si LIBRA sopra il giocatore ondeggiando e avvicinandosi in
  // orizzontale; quando è pronto e più o meno sopra di te, si CARICA (fermo a mezz'aria,
  // lampeggia ~0,35s) e poi PICCHIA verso la tua posizione (schivabile), infine RISALE alla
  // quota di volo e ricomincia. Stati in e.diveState: hover|wind|dive|recover.
  flyAI(e, now) {
    const px = this.player.x, py = this.player.y;
    const hoverY = Phaser.Math.Clamp(py - 150, 46, this.groundTop - 110);

    // CARICA: fermo a mezz'aria, lampeggia; poi parte la picchiata verso il bersaglio bloccato.
    if (e.diveState === 'wind') {
      e.setVelocity(0, -8);
      e.setTint((Math.floor(now / 60) % 2) ? 0xffe066 : 0xffffff);
      if (now >= e.diveTimer) {
        e.clearTint();
        const dx = e.diveTX - e.x, dy = e.diveTY - e.y, d = Math.hypot(dx, dy) || 1;
        const sp = Math.max(360, e.speed * 3.2);   // picchiata scattante (schivabile grazie al telegrafo)
        e.setVelocity((dx / d) * sp, (dy / d) * sp);
        e.setFlipX(dx < 0);
        e.diveState = 'dive';
        e.diveTimer = now + 800;   // durata massima della picchiata
      }
      return;
    }

    // PICCHIATA: prosegue dritta finché non arriva al bersaglio / tocca il basso / scade.
    if (e.diveState === 'dive') {
      if (now >= e.diveTimer || e.y >= this.groundTop - 24 ||
          (Math.abs(e.x - e.diveTX) < 18 && Math.abs(e.y - e.diveTY) < 18)) {
        e.diveState = 'recover';
      }
      return;
    }

    // RISALITA: torna su alla quota di volo, poi si rimette a librarsi (con attesa).
    if (e.diveState === 'recover') {
      e.setVelocity((px - e.x) * 0.6, -e.speed * 0.95);
      e.setFlipX((px - e.x) < 0);
      if (e.y <= hoverY + 16) { e.diveState = 'hover'; e.diveReadyAt = now + Phaser.Math.Between(1400, 2200); }
      return;
    }

    // HOVER (default): si libra sopra di te ondeggiando e avvicinandosi in orizzontale.
    const targetY = hoverY + Math.sin(now * 0.006 + (e.bobPhase || 0)) * 12;
    e.setVelocity(
      Phaser.Math.Clamp(px - e.x, -e.speed, e.speed) * 0.9,
      Phaser.Math.Clamp((targetY - e.y) * 4, -e.speed, e.speed)
    );
    e.setFlipX((px - e.x) < 0);
    // Pronto e più o meno sopra il giocatore → carica la picchiata (mira dove sei ORA).
    if (now >= (e.diveReadyAt || 0) && Math.abs(px - e.x) < 130) {
      e.diveState = 'wind';
      e.diveTimer = now + 350;
      e.diveTX = px; e.diveTY = py + 6;
      e.setVelocity(0, 0);
    }
  }

  hurtPlayer(dmg, sourceX) {
    const now = this.time.now;
    if (now < this.invulnUntil || this.locked) return;
    // Abilità SCUDO: para il colpo se è "carico" (ricarica ogni 6s). Niente danno.
    const pl = window.GameState.player;
    if (pl.shield && now >= (this.shieldReadyAt || 0)) {
      this.shieldReadyAt = now + 6000;
      this.invulnUntil = now + 500;
      window.Sfx.hit();
      this.shieldFx();
      return;
    }
    this.invulnUntil = now + 900;
    window.GameState.player.hp -= dmg;
    window.Sfx.hurt();
    this.cameras.main.shake(120, 0.01);
    const dir = Math.sign(this.player.x - sourceX) || 1;
    this.player.setVelocity(dir * 240, -260);
    this.tweens.add({ targets: this.player, alpha: 0.3, duration: 90, yoyo: true, repeat: 4 });
    if (window.GameState.player.hp <= 0) {
      window.GameState.player.hp = 0;
      this.gameOver();
    }
  }

  // Effetto "vita rubata": un lampo verde che sale dal giocatore.
  healFx(x, y) {
    const c = this.add.circle(x, y - 10, 7, 0x6bd66b, 0.9).setDepth(21);
    this.tweens.add({ targets: c, y: y - 40, alpha: 0, scale: 1.6, duration: 420, ease: 'Quad.out', onComplete: () => c.destroy() });
  }

  // Effetto "scudo": un anello azzurro che si espande attorno al giocatore.
  shieldFx() {
    const ring = this.add.circle(this.player.x, this.player.y, 16, 0x8fd0ff, 0).setStrokeStyle(3, 0x8fd0ff, 0.9).setDepth(21);
    this.tweens.add({ targets: ring, scale: 2.4, alpha: 0, duration: 320, ease: 'Quad.out', onComplete: () => ring.destroy() });
  }

  // Esplosione di particelle (briciole): vedi GameGfx in src/gfx.js.
  burst(key, x, y, n) { window.GameGfx.burst(this, key, x, y, n); }

  // ---------- Esiti del livello ----------

  // Sei arrivato al timpano ma non hai pulito abbastanza: avviso (non piu' di una
  // volta ogni 4s) che dice quanta percentuale serve.
  cleanHint(now) {
    if (this._cleanHintAt && now - this._cleanHintAt < 4000) return;
    this._cleanHintAt = now;
    this.showBanner(window.I18n.t('game_clean_more', { pct: Math.round(this.cleanGoal * 100) }), '#9be870');
  }

  levelComplete() {
    if (this.locked) return;
    this.locked = true;
    window.Sfx.win();
    if (this.spawnTimer) this.spawnTimer.remove();
    this.player.setVelocity(0, 0);
    this.enemies.getChildren().forEach((e) => { if (e.active) e.setVelocity(0, 0); });

    const W = window.CONFIG.WIDTH, H = window.CONFIG.HEIGHT;
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.45).setDepth(50).setScrollFactor(0);
    this.add.text(W / 2, H / 2 - 20, window.I18n.t('done_title', { n: window.GameState.level }), {
      fontFamily: 'monospace', fontSize: '34px', color: '#ffd166',
      stroke: '#14161f', strokeThickness: 6, align: 'center',
    }).setOrigin(0.5).setDepth(51).setScrollFactor(0);
    this.add.text(W / 2, H / 2 + 26, window.I18n.t('done_sub'), {
      fontFamily: 'monospace', fontSize: '18px', color: '#fff7e8',
      stroke: '#14161f', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(51).setScrollFactor(0);

    this.time.delayedCall(1300, () => this.scene.start('UpgradeScene'));
  }

  gameOver() {
    if (this.locked) return;
    this.locked = true;
    window.Sfx.lose();
    if (this.spawnTimer) this.spawnTimer.remove();

    // Fine della run: incassa il cerume raccolto nella banca permanente.
    const lvl = window.GameState.level;
    const earned = window.GameState.wax;
    const meta = window.Meta.bankRun(earned, lvl);

    const W = window.CONFIG.WIDTH, H = window.CONFIG.HEIGHT;
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.6).setDepth(50).setScrollFactor(0);
    this.add.text(W / 2, H / 2 - 56, window.I18n.t('over_title'), {
      fontFamily: 'monospace', fontSize: '30px', color: '#e74c3c',
      stroke: '#14161f', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(51).setScrollFactor(0);
    this.add.text(W / 2, H / 2 - 14, window.I18n.t('over_level', { n: lvl }), {
      fontFamily: 'monospace', fontSize: '18px', color: '#fff7e8',
      stroke: '#14161f', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(51).setScrollFactor(0);
    this.add.text(W / 2, H / 2 + 16, window.I18n.t('over_banked', { earned: earned, bank: meta.bank }), {
      fontFamily: 'monospace', fontSize: '16px', color: '#ffd166',
      stroke: '#14161f', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(51).setScrollFactor(0);

    // Pulsanti toccabili (indispensabili su telefono/tablet)
    const mkButton = (x, label, onTap) => {
      const t = this.add.text(x, H / 2 + 80, label, {
        fontFamily: 'monospace', fontSize: '18px', color: '#14161f',
        backgroundColor: '#ffd166', padding: { x: 16, y: 10 }, align: 'center',
      }).setOrigin(0.5).setDepth(52).setScrollFactor(0)
        .setInteractive({ useHandCursor: true });
      t.on('pointerover', () => t.setStyle({ backgroundColor: '#ffe199' }));
      t.on('pointerout', () => t.setStyle({ backgroundColor: '#ffd166' }));
      t.on('pointerdown', onTap);
      return t;
    };
    mkButton(W / 2 - 175, window.I18n.t('over_newrun'), () => { window.GameState.reset(); this.scene.start('GameScene'); });
    mkButton(W / 2, window.I18n.t('over_shop'), () => { window.GameState.reset(); this.scene.start('ShopScene'); });
    mkButton(W / 2 + 175, window.I18n.t('over_menu'), () => { window.GameState.reset(); this.scene.start('MenuScene'); });

    this.input.keyboard.once('keydown-R', () => { window.GameState.reset(); this.scene.start('GameScene'); });
  }

  // ---------- HUD ----------

  buildHud() {
    this.hudG = this.add.graphics().setDepth(100).setScrollFactor(0);
    const style = { fontFamily: 'monospace', fontSize: '16px', color: '#fff7e8', stroke: '#14161f', strokeThickness: 3 };
    this.hpText = this.add.text(18, 16, '', style).setDepth(101).setScrollFactor(0);
    this.levelText = this.add.text(window.CONFIG.WIDTH / 2, 16, '', style).setOrigin(0.5, 0).setDepth(101).setScrollFactor(0);
    this.blockText = this.add.text(window.CONFIG.WIDTH / 2, 38, '', style).setOrigin(0.5, 0).setDepth(101).setScrollFactor(0);
    this.waxText = this.add.text(window.CONFIG.WIDTH - 18, 44, '', style).setOrigin(1, 0).setDepth(101).setScrollFactor(0);
    this.updateHud();
  }

  updateHud() {
    const p = window.GameState.player;
    const W = window.CONFIG.WIDTH;
    const x = 18, y = 40, w = 200, h = 18;
    this.hudG.clear();
    this.hudG.fillStyle(0x000000, 0.5); this.hudG.fillRect(x - 2, y - 2, w + 4, h + 4);
    this.hudG.fillStyle(0x3a2a1a, 1); this.hudG.fillRect(x, y, w, h);
    const ratio = Phaser.Math.Clamp(p.hp / p.maxHp, 0, 1);
    const col = ratio > 0.5 ? 0x4caf50 : (ratio > 0.25 ? 0xe0a020 : 0xe74c3c);
    this.hudG.fillStyle(col, 1); this.hudG.fillRect(x, y, w * ratio, h);

    // Barra HP del BOSS (solo se un Tappo di Cerume è in campo): larga, centrata in alto.
    const boss = this.enemies && this.enemies.getChildren().find((b) => b.active && b.kind === 'boss');
    if (boss) {
      const bw = 380, bx = (W - bw) / 2, by = 64, bh = 14;
      const br = Phaser.Math.Clamp(boss.hp / boss.maxHp, 0, 1);
      this.hudG.fillStyle(0x000000, 0.55); this.hudG.fillRect(bx - 2, by - 2, bw + 4, bh + 4);
      this.hudG.fillStyle(0x3a1414, 1); this.hudG.fillRect(bx, by, bw, bh);
      this.hudG.fillStyle(br > 0.5 ? 0xd23a3a : 0xff7043, 1); this.hudG.fillRect(bx, by, bw * br, bh);   // arancione = infuriato
    }

    const T = window.I18n;
    this.hpText.setText(T.t('hud_hp', { hp: Math.ceil(p.hp), max: p.maxHp }));
    this.levelText.setText(T.t('hud_level', { n: window.GameState.level }));
    const pct = this.totalWax ? Phaser.Math.Clamp(Math.round((this.cleanedWax / this.totalWax) * 100), 0, 100) : 100;
    this.blockText.setText(T.t('hud_clean', { pct: pct }));
    this.waxText.setText(T.t('hud_wax', { n: window.GameState.wax }));
  }

  // ---------- Pausa ----------

  buildPauseButton() {
    const W = window.CONFIG.WIDTH;
    const btn = this.add.circle(W - 30, 26, 17, 0x000000, 0.35)
      .setScrollFactor(0).setDepth(110).setInteractive({ useHandCursor: true });
    btn.setStrokeStyle(2, 0xfff7e8, 0.6);
    const g = this.add.graphics().setScrollFactor(0).setDepth(111);
    g.fillStyle(0xfff7e8, 0.9);
    g.fillRect(W - 35, 19, 4, 14);   // due barrette = simbolo "pausa"
    g.fillRect(W - 28, 19, 4, 14);
    btn.on('pointerdown', (pointer, x, y, event) => {
      if (event) event.stopPropagation();   // non far partire l'attacco col clic
      this.pauseGame();
    });
  }

  pauseGame() {
    if (this.locked || this.scene.isPaused()) return;
    window.Sfx.unlock();
    // azzera gli stati "tenuti" del touch, così non si resta a muoversi in pausa
    this.touch.left = false;
    this.touch.right = false;
    this.scene.launch('PauseScene', { from: 'GameScene' });
    this.scene.pause();
  }

  // ---------- Sfondo ----------

  // Sfondo "condotto uditivo": vedi GameGfx in src/gfx.js.
  drawBackground() { window.GameGfx.drawBackground(this); }

  // ---------- Loop ----------

  update(time) {
    window.GameGfx.updateBackground(this);   // parallax: scorre gli strati di sfondo
    this.animateWax(time);                    // cerume "fluido": ondeggia e cola
    if (this.locked) { this.player.setVelocityX(0); return; }
    const p = window.GameState.player;
    const k = this.keys;
    const now = time;

    // Traguardo: bisogna PULIRE almeno la soglia di cerume E raggiungere il timpano.
    // Nei livelli boss il timpano resta "sbarrato" finche' il Tappo di Cerume e' vivo.
    if (this.player.x >= this.goalX) {
      const cleanPct = this.totalWax ? (this.cleanedWax / this.totalWax) : 1;
      const bossBlocking = this.levelKind === 'boss' &&
        this.enemies.getChildren().some((e) => e.active && e.kind === 'boss');
      if (cleanPct < this.cleanGoal) {
        this.cleanHint(now);                       // sei al timpano ma manca cerume da pulire
      } else if (bossBlocking) {
        if (!this._bossHintShown) { this._bossHintShown = true; this.showBanner(window.I18n.t('game_boss_guard'), '#ffb04a'); }
      } else {
        this.levelComplete(); return;
      }
    }

    const onGround = this.player.body.blocked.down || this.player.body.touching.down;
    if (onGround) { this.jumpsLeft = p.doubleJump ? 2 : 1; this.lastGroundAt = now; }

    // Ostacoli mobili: vanno avanti e indietro tra i due estremi memorizzati, ruotando su
    // se stessi (leggibilita'). Il danno al contatto e' gestito dall'overlap in create().
    if (this.movers) {
      this.movers.getChildren().forEach((m) => {
        if (!m.active) return;
        if (m.x <= m.range.x1) m.dir = 1;
        else if (m.x >= m.range.x2) m.dir = -1;
        m.setVelocityX(m.dir * m.speed);
        m.angle += 3.5 * m.dir;
      });
    }
    // Pozze di cerume scivoloso: rallentano il movimento mentre ci si cammina sopra a terra.
    const onSlime = onGround && this.slimeZones && this.slimeZones.some(
      (z) => this.player.x > z.x1 && this.player.x < z.x2);

    // Abilità CALAMITA: i bonus di cerume vicini volano verso il giocatore (raccolta a distanza).
    if (p.magnet && this.pickups) {
      const R = 170;
      this.pickups.getChildren().forEach((pk) => {
        if (!pk.active) return;
        const dx = this.player.x - pk.x, dy = this.player.y - pk.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d < R) {
          if (!pk._magnet) { pk._magnet = true; this.tweens.killTweensOf(pk); }   // stacca l'ondeggio
          const pull = Phaser.Math.Clamp(140 + 340 * (1 - d / R), 140, 460);
          pk.body.setVelocity((dx / d) * pull, (dy / d) * pull);
        }
      });
    }

    // ACCOVACCIAMENTO (stile Metal Slug): tieni GIU' a terra -> ti abbassi, così getto e
    // mazza escono all'altezza dei piedi e colpisci i nemici bassi (es. Gorgogliante). In
    // aria GIU' resta la mira verso il basso del getto (gestita più sotto).
    const downHeld = k.DOWN.isDown || k.S.isDown || this.touch.aimDown;
    // L'accovacciamento resta valido per un attimo dopo aver perso il contatto col suolo
    // (dossi/bordi mentre ci si muove), COSI' il getto non passa a "mira in giù" sparando
    // nel pavimento. NON vale durante un vero salto (velocità decisa verso l'alto).
    this.crouching = downHeld && (onGround ||
      ((now - this.lastGroundAt) < 140 && this.player.body.velocity.y > -50));

    // Movimento (tastiera o pad a schermo); accovacciato ci si muove piano.
    const left = k.A.isDown || k.LEFT.isDown || this.touch.left;
    const right = k.D.isDown || k.RIGHT.isDown || this.touch.right;
    let vx = 0;
    if (left) { vx = -p.moveSpeed; this.facing = -1; }
    else if (right) { vx = p.moveSpeed; this.facing = 1; }
    if (this.crouching) vx *= 0.45;
    if (onSlime) vx *= 0.5;
    if (now < this.dashUntil) vx = this.facing * p.moveSpeed * 2.4;
    this.player.setVelocityX(vx);
    // Posa accovacciata: sprite schiacciato (segnaposto in attesa di un frame dedicato).
    this.player.setScale(1.5, this.crouching ? 1.02 : 1.5);

    // --- Salto con "game feel": buffer + altezza variabile ---
    // Tasto DEDICATO: Spazio o pulsante a schermo. (Su/W NON saltano: mirano il getto.)
    const BUFFER = 130;
    const jumpEdge = Phaser.Input.Keyboard.JustDown(k.SPACE) || this.touch.jumpQueued;
    this.touch.jumpQueued = false;
    if (jumpEdge) this.jumpBufferedAt = now;                 // "ricorda" il salto premuto
    const jumpHeld = k.SPACE.isDown || this.touch.jumpHeld;
    const wantJump = (now - this.jumpBufferedAt) <= BUFFER;  // salto in coda (anche premuto un attimo prima di atterrare)
    if (wantJump && this.jumpsLeft > 0) {
      this.player.setVelocityY(-p.jumpVelocity);
      this.jumpsLeft--;
      this.jumpBufferedAt = -9999;   // consuma il buffer (niente doppio salto involontario)
      this.canCutJump = true;        // da qui in poi il rilascio puo' accorciare il salto
      window.Sfx.jump();
    }
    // Altezza variabile: se rilasci mentre stai ancora salendo, tronca la salita (saltino).
    if (this.canCutJump && !jumpHeld && this.player.body.velocity.y < 0) {
      this.player.setVelocityY(this.player.body.velocity.y * 0.45);
      this.canCutJump = false;
    }
    if (this.player.body.velocity.y >= 0) this.canCutJump = false;

    // Scatto
    const dashPressed = Phaser.Input.Keyboard.JustDown(k.SHIFT) || this.touch.dashQueued;
    this.touch.dashQueued = false;
    if (p.dash && dashPressed && now > this.dashReady) {
      this.dashUntil = now + 160;
      this.dashReady = now + 700;
      this.invulnUntil = Math.max(this.invulnUntil, now + 160);
      window.Sfx.dash();
    }

    // Mira del getto (8 direzioni): orizzontale = verso dove guardi; su/giu coi tasti
    // (frecce su/giu o W/S, oppure pad a schermo). Da fermo si mira dritto su/giu.
    const aimUp = k.UP.isDown || k.W.isDown || this.touch.aimUp;
    const aimDown = k.DOWN.isDown || k.S.isDown || this.touch.aimDown;
    let adx = this.facing, ady = 0;
    if (aimUp) ady = -1; else if (aimDown) ady = 1;
    if (ady !== 0 && !left && !right) adx = 0;
    // Accovacciato: si spara ORIZZONTALE (basso), non verso il pavimento.
    if (this.crouching) { ady = 0; adx = this.facing; }

    // Attacco UNICO e "intelligente" (tieni premuto: J / pulsante Spruzza / clic).
    // Se un nemico e' a distanza ravvicinata parte la BASTONATA (coton fioc) al posto
    // del getto; altrimenti spara il getto (pulisce il cerume e colpisce da lontano).
    const attackHeld = k.J.isDown || this.touch.sprayHeld || this.pcFiring;
    if (attackHeld) {
      window.Sfx.unlock();
      // Priorità: nemico vicino -> bastonata; altrimenti cerume a portata -> bastonata
      // (pulizia ravvicinata più veloce del getto); altrimenti getto a distanza.
      const foe = this.meleeTargetNear();
      const wax = foe ? null : this.meleeWaxNear();
      if (foe) this.doMelee(now, foe);
      else if (wax) this.doMelee(now, wax);
      else this.fireJet(adx, ady);
    }

    // Animazione
    this.player.setFlipX(this.facing < 0);
    if (!onGround) { this.player.anims.stop(); this.player.setTexture('player_a'); }
    else if (Math.abs(vx) > 10) { this.player.anims.play('walk', true); }
    else { this.player.anims.stop(); this.player.setTexture('player_a'); }

    // IA nemici + danno da contatto
    const pb = this.player.getBounds();
    this.enemies.getChildren().forEach((e) => {
      if (!e.active) return;
      if (e.spawning) return;   // mentre emerge/cala è inerte: niente IA, sputi o danno

      // Nemico rimasto troppo indietro (oltre una membrana gia' superata): non potra'
      // piu' raggiungere il giocatore, lo rimuoviamo cosi' lo spawner ne crea di nuovi
      // nella sezione attuale. Boss e guardiani sono esenti.
      if (!e.guard && e.kind !== 'boss' && (this.player.x - e.x) > this.cameras.main.width * 1.3) {
        e.destroy();
        return;
      }

      if (now >= e.knockUntil) {
        if (e.kind === 'boss') {
          this.bossAI(e, now);
        } else if (e.kind === 'spit') {
          // Gorgogliante: spara SOLO se è nell'inquadratura (range d'attacco limitato).
          const cam = this.cameras.main;
          const onScreen = e.x > cam.scrollX - 60 && e.x < cam.scrollX + cam.width + 60;
          this.spitEnemyAI(e, now, onScreen);
        } else if (e.kind === 'fly') {
          this.flyAI(e, now);   // moscerino: si libra sopra di te e PICCHIA (telegrafato)
        } else if (e.guard && Math.abs(this.player.x - e.homeX) > e.guardRange) {
          // Guardiano in attesa: il giocatore e' lontano, resta a presidiare la membrana.
          if (Math.abs(e.homeX - e.x) > 8) e.setVelocityX(Math.sign(e.homeX - e.x) * e.speed * 0.5);
          else e.setVelocityX(0);
          e.setFlipX(this.player.x < e.x);
        } else if (e.kind === 'crust') {
          // Crosta (corazzata lenta): avanza camminando verso il giocatore. Niente
          // affondo (è una parete inesorabile), va abbattuta col corpo a corpo.
          const dir = Math.sign(this.player.x - e.x);
          e.setVelocityX(dir * e.speed);
          e.setFlipX(dir < 0);
        } else {
          // Cerumino (blob): cammina + AFFONDO telegrafato.
          this.groundEnemyAI(e, now);
        }
      }

      if (Phaser.Geom.Intersects.RectangleToRectangle(e.getBounds(), pb)) {
        this.hurtPlayer(e.contactDamage, e.x);
      }
    });

    this.updateHud();
  }
}
window.GameScene = GameScene;
