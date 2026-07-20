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
    this.companions = [];   // bolle-aiutante (create sotto, una per punto di companions)
    this.shieldAura = null; // alone dello scudo (creato al volo se l'abilità è posseduta)
    // Seconda Vita: stato su window.GameState.player (secondLifeUsed), NON qui — this.* si
    // azzererebbe ad ogni livello (create() gira ad ogni scene.start), mentre deve valere una
    // sola volta per l'intera RUN (si azzera solo su GameState.reset()).
    this.speechCooldownUntil = 0;  // CARATTERE COMICO: azzerato ad ogni livello (vedi maybeSpeech)
    this.cleanGoal = 0.8;   // frazione di cerume da pulire per poter completare il livello

    // La vita NON si ricarica a ogni livello: si porta dietro tra un livello e l'altro (a
    // inizio RUN è piena, la imposta newPlayer). Ci si cura raccogliendo i pickup-cura.
    window.GameState.player.hp = Phaser.Math.Clamp(window.GameState.player.hp, 1, window.GameState.player.maxHp);

    // Tipo di questo livello: boss ogni 5, sciame ogni 5 (sfasato). Gli altri di solito sono
    // "normali", ma dal lvl 2 spesso diventano un TIPO SPECIALE con obiettivo/regole diverse
    // (pulizia profonda / corsa / assedio) per rompere la monotonia.
    const levelNum = window.GameState.level;
    let kind = (levelNum % 5 === 0) ? 'boss' : (levelNum % 5 === 3) ? 'swarm' : 'normal';
    if (kind === 'normal' && levelNum >= 2) {
      const r = Math.random();
      if (r < 0.28) kind = 'rush';
      else if (r < 0.56) kind = 'siege';
    }
    this.levelKind = kind;
    // Soglia di pulizia per completare: default 0.8; la CORSA non chiede pulizia (basta
    // arrivare al timpano). L'ASSEDIO non usa il timpano (vince a tempo).
    if (this.levelKind === 'rush') this.cleanGoal = 0;
    this.siegeEndAt = 0;   // istante (ms) in cui l'assedio e' superato (0 = non assedio)
    this.rushEndAt = 0;    // istante (ms) in cui scade la corsa a tempo (0 = non corsa)
    this.bigTimerText = null;

    // Mondo LARGO da attraversare (cresce un po' col livello): la telecamera segue
    // il giocatore mentre cammina verso il timpano (a destra). W/H restano la
    // dimensione della "finestra" visibile; il mondo fisico e' molto piu' ampio.
    this.worldW = Phaser.Math.Clamp(2400 + levelNum * 220, 2400, 5200);
    if (this.levelKind === 'swarm') this.worldW += 300;
    const gh = window.CONFIG.GROUND_H;
    // Soffitto TANGIBILE (round 2, B.1): fascia piu' SOTTILE di quella del round 1 (28% del
    // pavimento, era 45%) e stavolta il bordo ALTO del mondo fisico coincide col suo fondo
    // (CEIL_Y), non piu' y=0 — cosi' il giocatore/nemici (collideWorldBounds) sbattono la
    // testa invece di sparire nel vuoto sopra. `CEIL_Y` e' salvato sulla scena: lo riusa anche
    // `buildPlatforms` (B.2) per non far salire le pedane oltre lo spazio per testa+salto.
    this.CEIL_Y = Math.round(gh * 0.28);
    // Il "fondo" del mondo fisico coincide con la SUPERFICIE del pavimento (H-gh):
    // rete di sicurezza: chi ha collideWorldBounds (giocatore e nemici) non puo' mai
    // cadere sotto il pavimento, qualunque cosa accada al suo corpo fisico.
    // Bordo alto del mondo a 0: il soffitto (ondulato) lo fanno i collider a scaletta di
    // `buildCeilingColliders`, cosi' nelle zone AMPIE il giocatore puo' salire in alto davvero.
    this.physics.world.setBounds(0, 0, this.worldW, H - gh);

    // CONDOTTO A LARGHEZZA VARIABILE (round 4): il soffitto ondeggia e scende (pinch) in alcuni
    // tratti → passaggi stretti/ampi. Il profilo va calcolato PRIMA di disegnare il soffitto e di
    // costruire il livello (pedane/stalattiti/gocce si agganciano al soffitto locale via ceilingYAt).
    this.buildCeilingProfile();

    this.drawBackground();

    // Il PAVIMENTO (terreno) vero lo disegna `buildTerrain()` seguendo il profilo `terrainTopAt`
    // (colline + cunette). Qui creiamo solo il collider di SICUREZZA (backstop) ben SOTTO il
    // terreno: la superficie d'appoggio vera la fa la "mappa di altezze" nel player/enemy update.
    // (`groundGfx` serve sotto per disegnare il SOFFITTO.)
    const groundGfx = this.add.graphics().setDepth(4);
    this.ground = this.add.rectangle(this.worldW / 2, (H - gh + 48) + gh / 2, this.worldW, gh).setVisible(false);
    this.physics.add.existing(this.ground, true);

    // Soffitto VISIBILE ondulato (round 4): forma piena che segue il profilo `ceilingYAt(x)`,
    // stessa palette carnosa del pavimento. Nei pinch scende dentro il condotto (passaggi stretti).
    // Campionato ogni 16px. (Il collider vero dei pinch lo aggiunge il gruppo VC-B; il bordo alto
    // del mondo resta a `CEIL_Y`.)
    const CSTEP = 16;
    const ceilPts = [{ x: 0, y: -200 }];
    for (let x = 0; x <= this.worldW; x += CSTEP) ceilPts.push({ x, y: this.ceilingYAt(x) });
    ceilPts.push({ x: this.worldW, y: this.ceilingYAt(this.worldW) });
    ceilPts.push({ x: this.worldW, y: -200 });
    groundGfx.fillStyle(C.ground, 1);
    groundGfx.fillPoints(ceilPts, true);
    groundGfx.lineStyle(5, C.groundDark, 1);                  // "bordo" del soffitto lungo il profilo
    groundGfx.beginPath();
    for (let x = 0; x <= this.worldW; x += CSTEP) {
      const y = this.ceilingYAt(x);
      if (x === 0) groundGfx.moveTo(x, y); else groundGfx.lineTo(x, y);
    }
    groundGfx.strokePath();

    // Gruppi
    this.blocks = this.physics.add.staticGroup();
    this.platforms = this.physics.add.staticGroup();  // pedane sospese (verticalita')
    this.ceilBlocks = this.physics.add.staticGroup();  // collider a scaletta del soffitto ondulato
    this.terrainBumps = this.physics.add.staticGroup();  // rilievi del pavimento (gobbe da scavalcare)
    this.enemies = this.physics.add.group();
    this.projectiles = this.physics.add.group();  // palline sputate dai nemici
    this.collapseChunks = this.physics.add.group({ allowGravity: false });  // EVENTO frana

    this.buildCeilingColliders();   // il "soffitto solido" che segue il profilo (dopo i gruppi)

    this.chooseMutator();   // regola casuale di questo livello (prima di costruirlo: incide su cerume/nemici)
    this.chooseEvent();     // evento a tempo indipendente (puo' capitare insieme a un mutatore)
    this.buildLevel();

    // Giocatore (sprite PNG: scala per portarlo alla dimensione di gioco; hitbox invariato)
    this.player = this.physics.add.sprite(80, H - gh - 60, 'player_a').setDepth(10).setScale(1.5);
    this.player.body.setSize(18, 40, true);
    this.player.setCollideWorldBounds(true);
    // "Juice" procedurale (schiacciamento/allungamento): jx/jy = moltiplicatori di scala che
    // decadono verso 1 ogni frame (vedi update()). _wasOnGround/_prevVelY per rilevare
    // l'atterraggio; _lastFacing per rilevare l'inversione di corsa.
    this.jx = 1; this.jy = 1;
    this._wasOnGround = true; this._prevVelY = 0; this._lastFacing = 1;
    // Abilità SCHIANTO: this.slamming = caduta veloce in corso (l'onda scatta all'atterraggio,
    // vedi 'landed' in update()); _slamPrevDown per rilevare la pressione FRESCA di giu' (non
    // tenuta) mentre sei in aria.
    this.slamming = false; this._slamPrevDown = false;

    // ---- Personaggio ANIMATO (sprite sheet AutoSprite) ----
    // La FISICA resta su this.player, reso INVISIBILE: hitbox/collisioni/scala-juice invariati.
    // Il "vestito" animato e' un secondo sprite (this.heroVisual) che ogni frame SEGUE il player
    // e ha scala PROPRIA (indipendente dal corpo fisico), cosi' non altera le collisioni.
    this.player.setVisible(false);
    this.HERO_SCALE = 1.0;        // dimensione a schermo del vestito (frame 84; si tara guardando)
    this.HERO_ORIGIN_Y = 0.86;    // altezza dei piedi nel fotogramma (si tara)
    this.heroVisual = this.add.sprite(this.player.x, this.player.body.bottom, 'hero_walk', 0)
      .setDepth(10).setOrigin(0.5, this.HERO_ORIGIN_Y);
    if (!this.anims.exists('hero_walk_a')) this.anims.create({ key: 'hero_walk_a', frames: this.anims.generateFrameNumbers('hero_walk', { start: 0, end: 24 }), frameRate: 18, repeat: -1 });
    if (!this.anims.exists('hero_run_a'))  this.anims.create({ key: 'hero_run_a',  frames: this.anims.generateFrameNumbers('hero_run',  { start: 0, end: 24 }), frameRate: 22, repeat: -1 });
    if (!this.anims.exists('hero_idle_a')) this.anims.create({ key: 'hero_idle_a', frames: this.anims.generateFrameNumbers('hero_idle', { start: 0, end: 24 }), frameRate: 10, repeat: -1 });
    if (!this.anims.exists('hero_jump_a')) this.anims.create({ key: 'hero_jump_a', frames: this.anims.generateFrameNumbers('hero_jump', { start: 0, end: 24 }), frameRate: 18, repeat: -1 });

    // ---- ARMA IN MANO (layer separato, INTERCAMBIABILE) ----
    // L'arma e' un "adesivo" distinto sopra il personaggio: a distanza RUOTA verso la mira,
    // nel corpo a corpo ROTEA col colpo. Cambiare arma = cambiare voce nella tabella WEAPONS
    // (nessuna ri-generazione del personaggio). Compare durante l'attacco (poi si nasconde).
    // hand = offset [x,y] della mano dal centro fisico (x va specchiato col facing); origin =
    // perno di rotazione dentro la texture (grip). Tutti valori da tarare a occhio.
    this.WEAPONS = {
      sprayer: { tex: 'sprayer', origin: [0.18, 0.6], scale: 1.0, hand: [8, -2] },
      swab:    { tex: 'swab',    origin: [0.10, 0.5], scale: 1.0, hand: [6, -2] },
      hammer:  { tex: 'hammer',  origin: [0.22, 0.5], scale: 0.9, hand: [6, -6] },
    };
    this.heroWeapon = this.add.sprite(this.player.x, this.player.y, 'sprayer').setDepth(11).setVisible(false);
    this._weaponHideAt = 0;   // istante fino a cui l'arma resta visibile dopo un attacco
    this._weaponMode = null;  // 'ranged' | 'melee'
    this._weaponAim = 0;      // angolo di mira corrente (per il posizionamento in update)

    this.physics.add.collider(this.player, this.ground);
    this.physics.add.collider(this.player, this.blocks);
    this.physics.add.collider(this.player, this.platforms);
    this.physics.add.collider(this.player, this.ceilBlocks);   // soffitto ondulato solido
    this.physics.add.collider(this.player, this.terrainBumps); // rilievi da scavalcare (solo il PG)

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
    this.physics.add.collider(this.enemies, this.ground, null, notFlyer);   // i volanti non toccano terra (corretto)
    // Il cerume invece NESSUN nemico dovrebbe poterlo attraversare (era un bug: i moscerini
    // ci passavano attraverso, esattamente come le pedane prima del fix in 00ec955). L'UNICA
    // eccezione voluta e' il Fuggitivo Dorato (evento "acchiappalo"): resta un blob a terra
    // (non diventa volante, che dopo QUESTO fix si incastrerebbe comunque nel cerume), ma
    // attraversa la massa per non restarci bloccato durante la fuga a tempo.
    const notFugitive = (a, b) => (this.enemies.contains(a) ? a : b).fugitive !== true;
    this.physics.add.collider(this.enemies, this.blocks, null, notFugitive);
    // Le PEDANE sono solide anche per i moscerini (cosi' la loro picchiata non le attraversa).
    this.physics.add.collider(this.enemies, this.platforms);
    this.physics.add.collider(this.enemies, this.ceilBlocks);   // niente nemici sopra il soffitto locale

    // Bonus di cerume raccoglibili sulle pedane.
    this.physics.add.overlap(this.player, this.pickups, (pl, pk) => this.grabPickup(pk));

    // Gocce dal soffitto: fanno danno da contatto col giocatore (come un nemico).
    this.physics.add.overlap(this.player, this.movers, (pl, mv) => this.hurtPlayer(12 + Math.floor(window.GameState.level / 2), mv.x));
    // e SCHIZZANO quando incontrano il cerume O una pedana nella caduta (niente attraversamenti).
    const dripSplash = (mv) => { if (mv && mv.active) { this.splat(mv.x, mv.y, 'soft'); mv.destroy(); } };
    this.physics.add.overlap(this.movers, this.blocks, dripSplash);
    this.physics.add.overlap(this.movers, this.platforms, dripSplash);

    // EVENTO Frana di cerume: i blocchi caduti fanno danno da contatto E aprono un piccolo
    // varco nel cerume vicino a dove atterrano (a differenza delle gocce, che schizzano e basta).
    this.physics.add.overlap(this.player, this.collapseChunks, (pl, c) => {
      this.hurtPlayer(14 + Math.floor(window.GameState.level / 2), c.x);
      this.collapseImpact(c);
    });
    this.physics.add.overlap(this.collapseChunks, this.blocks, (c) => this.collapseImpact(c));
    this.physics.add.overlap(this.collapseChunks, this.platforms, (c) => this.collapseImpact(c));

    // Guardiani fermi a presidiare le membrane piene.
    this.spawnGuardians();

    // Aiutante (abilità COMPANION, impilabile): N bolle che ti orbitano e sparano da sole.
    const nc = window.GameState.player.companions | 0;
    for (let i = 0; i < nc; i++) this.spawnCompanion(i, nc);

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
    this.physics.add.collider(this.projectiles, this.ceilBlocks, popProj);
    this.physics.add.collider(this.projectiles, this.terrainBumps, popProj);

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
      this.damageEnemy(en, sh.dmg);
      if (sh.corrosive) this.applyCorrosion(en);   // abilità SAPONE CORROSIVO: danno nel tempo
      if (sh.stun) this.applyStun(en);             // abilità GETTO STORDENTE
      consumeShot(sh);
    };
    const hitSolid = (a, b) => {
      const sh = this.shots.contains(a) ? a : b, solid = (sh === a) ? b : a;
      if (sh.bounceLeft > 0) this.bounceShot(sh, solid);   // abilità RIMBALZO
      else this.popShot(sh);                               // altrimenti i muri fermano
    };
    this.physics.add.overlap(this.shots, this.blocks, hitWax);
    this.physics.add.overlap(this.shots, this.enemies, hitFoe);
    this.physics.add.overlap(this.shots, this.platforms, hitSolid);
    this.physics.add.overlap(this.shots, this.ground, hitSolid);
    this.physics.add.overlap(this.shots, this.ceilBlocks, hitSolid);
    this.physics.add.overlap(this.shots, this.terrainBumps, hitSolid);

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
    } else if (this.levelKind === 'siege') {
      // ASSEDIO: non serve raggiungere il timpano, bisogna SOPRAVVIVERE a tempo mentre i
      // nemici arrivano fitti. Vince allo scadere del cronometro (vedi update).
      this.maxEnemies = Math.min(4 + lvl, 9);
      spawnDelay = Math.max(700, 1500 - lvl * 100);
      this.siegeEndAt = this.time.now + 30000 + lvl * 2000;
      for (let i = 0; i < Math.min(3, this.maxEnemies); i++) this.spawnEnemy();
      this.showBanner(window.I18n.t('game_siege_in'), '#ff8f5a');
    } else {
      // normal / rush: attraversa fino al timpano (la corsa non chiede pulizia).
      this.maxEnemies = Math.min(2 + lvl, 6);
      spawnDelay = Math.max(1500, 2800 - lvl * 150);
      if (this.levelKind === 'rush') {
        this.maxEnemies = Math.min(this.maxEnemies + 2, 8); spawnDelay = Math.round(spawnDelay * 0.7);
        // CORSA A TEMPO (round 2, F.1): prima non c'era nessun cronometro, solo "arriva al
        // timpano quando vuoi". Tempo commisurato alla lunghezza del livello: ritmo medio
        // atteso ~130px/s (piu' lento della camminata base: si suppone rallentato dai
        // combattimenti) + un margine fisso di reazione. Da TARARE col playtest.
        this.rushEndAt = this.time.now + Math.round(this.worldW / 130) * 1000 + 8000;
      }
      for (let i = 0; i < Math.min(2, this.maxEnemies); i++) this.spawnEnemy();
      const bkey = this.levelKind === 'rush' ? 'game_rush_in' : 'game_goal';
      const bcol = this.levelKind === 'rush' ? '#ffd166' : '#ffd9a0';
      this.showBanner(window.I18n.t(bkey), bcol);
    }
    this.maxEnemies = Phaser.Math.Clamp(this.maxEnemies + (this.mutMaxEnemies || 0), 1, 12);   // MODIFICATORE "orda"

    // PROTEZIONE ALLO SPAWN: breve invulnerabilita' a inizio livello, cosi' se un nemico
    // nasce vicino al punto di partenza (sezioni strette) non uccide il giocatore prima che
    // possa reagire. Il god-mode dei test nascondeva proprio questo caso — scoperto 2026-07-18
    // (l'utente moriva all'istante cliccando "Start Run"). Vedi anche pickGroundX (spawn piu' lontani).
    this.invulnUntil = Math.max(this.invulnUntil, this.time.now + 1400);

    this.spawnTimer = this.time.addEvent({
      delay: spawnDelay, loop: true,
      callback: () => { if (!this.locked && this.enemies.countActive(true) < this.maxEnemies) this.spawnEnemy(); },
    });

    // Annuncio del MODIFICATORE di livello (piu' in basso del banner del tipo, cosi' si vedono
    // entrambi senza sovrapporsi).
    if (this.mutator) {
      this.time.delayedCall(700, () => { if (!this.locked) this.showBanner(window.I18n.t('mut_' + this.mutator.id), this.mutator.color, 210); });
    }

    // CARATTERE COMICO: battuta di inizio livello (boss a parte: taunt dedicato). Ritardata
    // per non accavallarsi coi banner di tipo/mutatore appena mostrati. `force`: deve comparire
    // SEMPRE, anche se nel frattempo un'uccisione/colpo precoce ha gia' consumato il cooldown.
    this.time.delayedCall(1400, () => {
      if (this.locked) return;
      this.maybeSpeech(this.levelKind === 'boss' ? 'boss' : 'start', undefined, true);
    });

    this.buildHud();

    // Timer grande e centrato (round 2, F.1/F.2a): condiviso da Assedio (sopravvivi) e Corsa
    // (tempo per arrivare) — prima l'assedio aveva un testo minuscolo (`siegeText`, 20px) e la
    // corsa non aveva nessun timer. Vedi `buildBigTimer`/`updateBigTimer`.
    if (this.levelKind === 'siege' || this.levelKind === 'rush') this.buildBigTimer();

    // Atmosfera musicale in base al tipo di livello (round 3 audio): boss/assedio = teso,
    // gli altri = ritmo "missione di pulizia". Cambia con una dissolvenza rispetto al menu.
    const musicKind = (this.levelKind === 'boss' || this.levelKind === 'siege') ? 'boss' : 'level';
    window.Sfx.setMusic(musicKind);

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
    this.buildTerrain();         // PROTOTIPO round 4: colline a gradini camminabili sul pavimento
    this.buildMounds();          // cumuli di cerume su pavimento e soffitto
    this.buildPlatforms();
    this.ensureHealPickups();    // garantisce un minimo di cure (la vita non si ricarica piu' a fine livello)
    this.buildHazards();         // pozze scivolose + gocce dal soffitto
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
    hp = Math.max(1, Math.round(hp * (this.mutWaxHp || 1)));   // MODIFICATORE "cerume ostinato"
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
    // Appeso al soffitto LOCALE (round 4: ondulato): la riga piu' alta del cumulo corrisponde al
    // bordo basso del soffitto in mx, cosi' il cerume pende da li' e non resta incastrato/sospeso.
    const topRow = Math.max(1, Math.round((this.groundTop - this.ceilingYAt(mx)) / B) - 1);
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

  // ---- CONDOTTO A LARGHEZZA VARIABILE (round 4) ----
  // Profili IRREGOLARI (frastagliati, non ondulati lisci) di soffitto e pavimento: punti di
  // controllo a distanza variabile con y casuale, interpolati a spezzata. Il look organico vero
  // arrivera' dopo con l'arte; qui e' la FORMA. Regola di sicurezza: il soffitto non scende mai
  // oltre `maxY` (apertura minima al pavimento) e resta alto vicino a partenza/goal.
  // Generatore condiviso di profilo irregolare (STESSO ritmo per soffitto e pavimento, cosi'
  // sopra e sotto sono "coerenti"): punti di controllo alla stessa distanza, y = base con una
  // variazione casuale entro [-upAmp, +downAmp]. Alta densita' + ampiezze contenute = irregolare
  // ma delicato (niente becchi profondi). base tenuto piatto vicino a spawn/goal.
  _makeProfile(baseY, upAmp, downAmp, opts) {
    opts = opts || {};
    const spMin = opts.spMin || 70, spMax = opts.spMax || 140;
    const clearStart = opts.clearStart || 0, clearEnd = opts.clearEnd || 0;
    const clampMaxY = opts.clampMaxY != null ? opts.clampMaxY : Infinity;
    const pts = [];
    let x = 0;
    while (x <= this.worldW) {
      let y = baseY + Phaser.Math.Between(-upAmp, downAmp);
      if (x < clearStart || x > this.worldW - clearEnd) y = baseY;   // spawn/goal piatti
      pts.push({ x, y: Math.min(y, clampMaxY) });
      x += Phaser.Math.Between(spMin, spMax);
    }
    pts.push({ x: this.worldW, y: baseY });
    return pts;
  }

  buildCeilingProfile() {
    const floorY = window.CONFIG.HEIGHT - window.CONFIG.GROUND_H;   // 360
    this.MIN_OPEN = 96;                                             // apertura minima garantita
    const maxY = floorY - this.MIN_OPEN;                            // il soffitto non scende oltre
    this.CEIL_MIN = 8;                                              // punto piu' ALTO (quasi bordo schermo)
    // Componente LENTA (punti radi): crea ZONE ampie e strette sostenute, non jitter. Puo' salire
    // quasi al bordo alto (stanze ampie) o scendere a un restringimento delicato.
    const slow = [];
    let sx = 0;
    while (sx <= this.worldW) { slow.push({ x: sx, y: Phaser.Math.Between(this.CEIL_MIN, 150) }); sx += Phaser.Math.Between(520, 900); }
    slow.push({ x: this.worldW, y: 60 });
    // Profilo fine = zona lenta + rugosita' piccola (stesso ritmo/carattere del pavimento).
    const pts = [];
    let x = 0;
    while (x <= this.worldW) {
      const base = this._sampleProfile(slow, x, 60);
      let y = base + Phaser.Math.Between(-14, 14);
      if (x < 640 || x > this.worldW - 460) y = Math.min(base, this.CEIL_Y);   // spawn/goal: mai piu' stretti del default
      pts.push({ x, y: Phaser.Math.Clamp(y, this.CEIL_MIN, maxY) });
      x += Phaser.Math.Between(70, 140);
    }
    pts.push({ x: this.worldW, y: 60 });
    this._ceilPts = pts;
  }
  ceilingYAt(x) { return this._sampleProfile(this._ceilPts, x, this.CEIL_Y); }

  // Pavimento: bordo irregolare SOLO VISIVO (la camminata resta piatta = sicuro). Stesso ritmo del
  // soffitto ma ampiezza piccola (su poco, giu' un po' di piu') cosi' il PG non sembra sorvolare gobbe.
  buildFloorProfile() {
    const floorY = window.CONFIG.HEIGHT - window.CONFIG.GROUND_H;
    this._floorPts = this._makeProfile(floorY, 8, 16, { spMin: 70, spMax: 140 });
  }
  floorEdgeYAt(x) { return this._sampleProfile(this._floorPts, x, window.CONFIG.HEIGHT - window.CONFIG.GROUND_H); }

  // "Soffitto solido" = scaletta di rettangoli statici (uno ogni SEG px) che scendono dall'alto
  // fino al bordo basso locale `ceilingYAt`. Cosi' i corpi sbattono la testa al soffitto locale
  // (nei tratti bassi) e possono salire in alto nelle zone ampie. Pochi corpi statici = leggero.
  buildCeilingColliders() {
    const SEG = 60, TOP = -140;
    for (let x = 0; x < this.worldW; x += SEG) {
      const cx = Math.min(x + SEG / 2, this.worldW);
      const bottom = this.ceilingYAt(cx);
      const h = bottom - TOP;
      if (h <= 2) continue;
      const r = this.add.rectangle(cx, TOP + h / 2, SEG + 2, h).setVisible(false);
      this.physics.add.existing(r, true);
      this.ceilBlocks.add(r);
    }
  }

  // PROTOTIPO TERRENO (round 4): COLLINE a GRADINI camminabili sul pavimento (montagnole,
  // saliscendi). Fatte di blocchi statici solidi → "a terra"/salto restano quelli di sempre; un
  // piccolo "auto-gradino" in update() le fa SALIRE camminando (senza saltare a ogni gradino).
  // NB: per ora le colline salgono SOPRA il pavimento; le cunette SOTTO il pavimento sono la
  // versione completa (richiede togliere il pavimento piatto).
  buildTerrain() {
    this.TERR_STEP = 18;                        // altezza di un gradino
    this.TERR_MAXH = 132;                       // collina piu' alta (SOPRA il pavimento)
    this.TERR_DIP = 36;                         // cunetta piu' profonda (SOTTO il pavimento)
    const C = window.CONFIG.COLORS;
    const H = window.CONFIG.HEIGHT;
    // Profilo di ALTEZZA a punti di controllo, dislivello limitato (±70) = pendenze DOLCI (niente
    // muri verticali che il PG "scalerebbe"). POSITIVO = collina (sopra il pavimento), NEGATIVO =
    // cunetta (sotto). Quantizzato a gradini. Piatto vicino a spawn/goal.
    const pts = [];
    let x = 0, h = 40;
    while (x <= this.worldW) {
      if (x > 560 && x < this.worldW - 480) h = Phaser.Math.Clamp(h + Phaser.Math.Between(-70, 70), -this.TERR_DIP, this.TERR_MAXH);
      else h = 0;
      pts.push({ x, y: h });
      x += Phaser.Math.Between(150, 240);
    }
    pts.push({ x: this.worldW, y: 0 });
    this._terrainPts = pts;
    // DISEGNO del terreno seguendo `terrainTopAt` (colline + cunette), riempimento a gradini +
    // linea di superficie. La COLLISIONE la fa la "mappa di altezze" (heightmap-snap) nel update,
    // non blocchi fisici → niente cuciture che incastrano. Nelle cunette il riempimento parte piu'
    // in basso, cosi' sopra si vede lo sfondo (avvallamento).
    const g = this.add.graphics().setDepth(4.3);
    const SS = 16;
    const poly = [{ x: 0, y: H + 200 }];
    for (let cx = 0; cx <= this.worldW; cx += SS) poly.push({ x: cx, y: this.terrainTopAt(cx) });
    poly.push({ x: this.worldW, y: this.terrainTopAt(this.worldW) });
    poly.push({ x: this.worldW, y: H + 200 });
    g.fillStyle(C.ground, 1);
    g.fillPoints(poly, true);
    g.lineStyle(5, C.groundDark, 1);
    g.beginPath();
    for (let cx = 0; cx <= this.worldW; cx += SS) { const y = this.terrainTopAt(cx); if (cx === 0) g.moveTo(cx, y); else g.lineTo(cx, y); }
    g.strokePath();
  }
  // Altezza del terreno in x (POSITIVO = collina sopra il pavimento, NEGATIVO = cunetta sotto),
  // quantizzata a gradini di TERR_STEP.
  terrainHeightAt(x) {
    const raw = this._sampleProfile(this._terrainPts, x, 0);
    return Phaser.Math.Clamp(Math.round(raw / this.TERR_STEP) * this.TERR_STEP, -this.TERR_DIP, this.TERR_MAXH);
  }
  // y della SUPERFICIE del terreno in x (piu' in alto sulle colline, piu' in basso nelle cunette).
  terrainTopAt(x) { return this.groundTop - this.terrainHeightAt(x); }

  // Interpolazione lineare del profilo (spezzata) al punto x.
  _sampleProfile(pts, x, fallback) {
    if (!pts || !pts.length) return fallback;
    if (x <= pts[0].x) return pts[0].y;
    for (let i = 1; i < pts.length; i++) {
      if (x <= pts[i].x) {
        const a = pts[i - 1], b = pts[i];
        const t = (x - a.x) / Math.max(1, b.x - a.x);
        return a.y + (b.y - a.y) * t;
      }
    }
    return pts[pts.length - 1].y;
  }

  // Pedane sospese: una "rampa" davanti a ogni membrana bassa (per scavalcarla con un
  // salto) + piu' pedane (basse E alte) tra le membrane, quasi sempre con un bonus di
  // cerume sopra. Una volta a livello, sopra una pedana alta si nasconde uno SCRIGNO
  // segreto (un'altra pedana ancora piu' su, raggiungibile con un salto extra).
  buildPlatforms() {
    // Arena boss (parte destra vicino al timpano): nessuna pedana-riparo, per non rendere
    // banale il fight. this.goalX non e' ancora impostato qui (lo fa buildGoal, DOPO in
    // buildLevel), percio' usiamo una soglia su this.worldW.
    const bossArenaX = this.levelKind === 'boss' ? this.worldW - 800 : Infinity;

    // Dislivello massimo raggiungibile con UN SOLO salto (il doppio salto e' uno sblocco, non
    // garantito: le pedane devono restare a portata anche senza). Apice teorico del salto =
    // v^2/(2g) con la gravita' DI BASE (non quella eventualmente ridotta da un mutatore
    // "poca gravita'": cosi' il livello resta raggiungibile anche nel caso peggiore, e con
    // gravita' ridotta e' semplicemente piu' facile). Margine di sicurezza 0.82 (non l'apice
    // esatto: a fine salita il controllo orizzontale e' ridotto).
    const p = window.GameState.player;
    const MAXUP = (p.jumpVelocity * p.jumpVelocity) / (2 * window.CONFIG.GRAVITY) * 0.82;
    // TETTO (round 2 B.2 + round 4): nessuna pedana puo' salire cosi' tanto da entrare nel
    // SOFFITTO LOCALE (round 4: ondulato) o da non lasciare spazio a testa+salto sotto di esso —
    // altrimenti e' irraggiungibile / in conflitto col soffitto. Usa `ceilingYAt(px)` al posto del
    // vecchio `CEIL_Y` fisso. Corpo del PG ~40px + margine 16px. `px` = x della pedana.
    const clampAbove = (refY, rawY, px) => Math.max(rawY, refY - MAXUP, (px != null ? this.ceilingYAt(px) : this.CEIL_Y) + 56);

    this.membranes.forEach((m) => {
      if (m.type !== 'short') return;
      const px = Math.max(200, m.x - 110);
      if (px >= bossArenaX) return;
      const py = clampAbove(this.groundTop, this.groundTop - Phaser.Math.Between(72, 96), px);
      this.addPlatform(px, py, 110);
    });

    const xs = this.membraneXs;
    let secretPlaced = false;
    for (let i = 0; i < xs.length - 1; i++) {
      const gapW = xs[i + 1] - xs[i];
      let lowY = this.groundTop;   // superficie da cui si raggiunge la pedana alta (suolo se non c'e' quella bassa)
      // Pedana bassa: quasi sempre presente se il varco e' abbastanza largo.
      if (gapW > 260 && Math.random() < 0.7) {
        const lowX = Math.round(xs[i] + gapW * Phaser.Math.FloatBetween(0.25, 0.4));
        if (lowX < bossArenaX) {
          const py = clampAbove(this.groundTop, this.groundTop - Phaser.Math.Between(90, 130), lowX);
          this.addPlatform(lowX, py, Phaser.Math.Between(90, 120));
          if (Math.random() < 0.7) this.addWaxPickup(lowX, py - 26, Math.random() < 0.35);   // a volte CURA
          lowY = py;
        }
      }
      // Pedana alta: premia chi sale a cercarla.
      if (Math.random() < 0.55) {
        const midX = Math.round(xs[i] + gapW * Phaser.Math.FloatBetween(0.5, 0.75));
        if (midX < bossArenaX) {
          const py = clampAbove(lowY, this.groundTop - Phaser.Math.Between(150, 220), midX);
          this.addPlatform(midX, py, Phaser.Math.Between(90, 130));
          if (Math.random() < 0.75) this.addWaxPickup(midX, py - 26, Math.random() < 0.45);   // pedana alta: piu' spesso CURA
          // SEGRETO (non segnalato): a volte, sopra questa pedana, uno scrigno ancora piu'
          // in alto — un salto in piu' rispetto al percorso ovvio. Una sola volta a livello.
          if (!secretPlaced && Math.random() < 0.35) {
            secretPlaced = true;
            const sx = midX + Phaser.Math.Between(-20, 20);
            const sy = clampAbove(py, py - Phaser.Math.Between(74, 96), sx);   // raggiungibile con un salto dalla pedana alta
            this.addPlatform(sx, sy, 70);
            for (let k = -1; k <= 1; k++) this.addWaxPickup(sx + k * 20, sy - 28, k === 0);
          }
        }
      }
    }
    // Rampa d'avvio prima della prima membrana (stesso bug delle pedane: anche questa deve
    // restare a portata di un salto solo dal suolo).
    const rampX = Math.max(200, xs[0] - 240);
    this.addPlatform(rampX, clampAbove(this.groundTop, this.groundTop - Phaser.Math.Between(110, 150), rampX), 120);
  }

  // Azzera i modificatori ai valori "neutri" (nessun effetto) + rimette la gravita' di default.
  resetMutators() {
    this.mutEnemySpeed = 1; this.mutEnemyHp = 1; this.mutEnemyWax = 1;
    this.mutMaxEnemies = 0; this.mutWaxMult = 1; this.mutWaxHp = 1; this.mutQuake = false;
    this.physics.world.gravity.y = window.CONFIG.GRAVITY;
    this.mutator = null;
  }

  // Sceglie (a volte) un MODIFICATORE per questo livello e lo applica. Niente mutatori nei
  // primissimi livelli e nei livelli boss (per non sovraccaricare). Il banner lo mostra create().
  chooseMutator() {
    this.resetMutators();
    if (window.GameState.level < 2 || this.levelKind === 'boss') return;
    if (Math.random() > 0.55) return;   // ~55% dei livelli ha un mutatore
    this.mutator = Phaser.Utils.Array.GetRandom(window.MUTATORS);
    this.mutator.apply(this);
  }

  // Sceglie (a volte) un EVENTO CASUALE per questo livello: indipendente dai mutatori (puo'
  // capitare insieme), niente numeri da regolare ma una MECCANICA a tempo (vedi i metodi
  // dedicati per ciascun evento, es. startGoldFugitiveEvent). Niente eventi nei primissimi
  // livelli, nei boss (gia' un evento a se') o nell'assedio (gia' abbastanza intenso).
  chooseEvent() {
    this.activeEvent = null;
    if (window.GameState.level < 2 || this.levelKind === 'boss' || this.levelKind === 'siege') return;
    if (Math.random() > 0.25) return;   // ~25% dei livelli ha un evento
    this.activeEvent = Phaser.Utils.Array.GetRandom(window.EVENTS);
    this.activeEvent.apply(this);
  }

  // EVENTO "Fuggitivo Dorato": dopo un breve ritardo (il giocatore si e' gia' orientato nel
  // livello) compare un nemico dorato che NON attacca ma scappa dritto verso il timpano.
  // Ucciderlo in tempo da' un bottino grosso; se scappa (raggiunge il fondo o scade il
  // tempo) sparisce senza ricompensa — l'imprevisto e' doverlo rincorrere SUBITO.
  startGoldFugitiveEvent() {
    const delay = Phaser.Math.Between(4000, 7000);
    this.time.delayedCall(delay, () => { if (!this.locked) this.spawnGoldFugitive(); });
  }

  spawnGoldFugitive() {
    const lvl = window.GameState.level;
    // pickGroundX() (non un offset fisso) tiene il punto DENTRO la sezione attuale (tra le
    // membrane), altrimenti il fuggitivo rischierebbe di comparire oltre una membrana ancora
    // intera e restare bloccato contro il muro per tutta la durata dell'evento.
    const e = this.spawnEnemy('blob', { x: this.pickGroundX(), fugitive: true });
    e.fugitive = true;
    e.contactDamage = 0;                          // e' preda, non minaccia: non fa danno da contatto
    e.speed = Math.round(e.speed * 1.7);
    e.waxValue = Math.round(45 + lvl * 4);
    e.setTint(0xffd700);                          // firma visiva: dorato
    this.fugitiveEscapeAt = this.time.now + 14000; // tempo limite per catturarlo
    this.showBanner(window.I18n.t('event_goldfugitive_in'), '#ffd700');
  }

  // IA del Fuggitivo Dorato: ignora del tutto il giocatore, corre sempre verso il timpano.
  // Scaduto il tempo o raggiunto il fondo, sparisce (nessuna ricompensa per averlo lasciato fuggire).
  fugitiveAI(e, now) {
    if (now >= (this.fugitiveEscapeAt || 0) || e.x >= this.goalX - 40) {
      this.showBanner(window.I18n.t('event_goldfugitive_escaped'), '#c9a0ff');
      e.destroy();
      return;
    }
    e.setVelocityX(e.speed);
    e.setFlipX(false);
  }

  // MUTATORE "Terremoto" (`this.mutQuake`), RIDISEGNATO nel round 2 (E.1): il cerume PENDE
  // GIA' dal soffitto tangibile (B.1) — scenografia inerte (`this.stalactites`) — e a ogni
  // SCOSSA periodica (shake della camera + rombo) qualcuna si stacca e cade, riusando
  // l'infrastruttura `collapseChunks` gia' esistente (gravita', danno da contatto, impatto sul
  // cerume). Prima (round 1) i chunk comparivano dal nulla con un telegrafo lampeggiante e una
  // pioggia continua — la scossa non si percepiva. Dura finche' dura il livello, si ferma da
  // solo quando la scena finisce/riparte (il guard `this.locked` interrompe la catena).
  startWaxCollapseEvent() {
    const delay = Phaser.Math.Between(2000, 4000);
    this.time.delayedCall(delay, () => {
      if (this.locked) return;
      this.placeStalactites();
      this.scheduleQuakePulse();
    });
  }

  // Fila di stalattiti di cerume duro appese al soffitto (sprite VERI, `wax_a/b/c/d` come il
  // muro, tinti come il cerume duro) in punti sparsi lungo il livello — quantita' scalata alla
  // larghezza. Restano inerti finche' `quakePulse` non ne stacca qualcuna.
  placeStalactites() {
    this.stalactites = [];
    const n = Phaser.Math.Clamp(Math.round(this.worldW / 480), 5, 12);
    for (let i = 0; i < n; i++) this.addStalactite();
  }

  addStalactite() {
    const x = this.pickHazardX(36, 20);
    if (x == null) return;
    const cx = x + 18;
    const key = Phaser.Utils.Array.GetRandom(['wax_a', 'wax_b', 'wax_c', 'wax_d']);
    const sprite = this.add.image(cx, this.ceilingYAt(cx), key).setOrigin(0.5, 0).setDepth(6);
    const src = this.textures.get(key).getSourceImage();
    sprite.setScale((window.CONFIG.BLOCK * 1.5) / src.width);
    sprite.setTint(this._waxTint('hard', 1));
    if (Math.random() < 0.5) sprite.setFlipX(true);
    this.stalactites.push({ x: cx, sprite });
  }

  // Si richiama da sola con un intervallo diverso ogni volta (2.5-3.5s): cosi' le scosse non
  // hanno un ritmo prevedibile/meccanico.
  scheduleQuakePulse() {
    this.quakeTimer = this.time.delayedCall(Phaser.Math.Between(2500, 3500), () => {
      if (this.locked) return;
      this.quakePulse();
      this.scheduleQuakePulse();
    });
  }

  // La SCOSSA vera e propria: si deve PERCEPIRE (shake deciso + rombo) — poi stacca 1-3
  // stalattiti, preferendo quelle piu' vicine al giocatore (piu' probabile che le veda cadere).
  // Se sono finite, ogni tanto ne ripiazza una nuova (si ripopolano piano, non restano vuote
  // per il resto del livello).
  quakePulse() {
    this.cameras.main.shake(400, 0.014);
    window.Sfx.smash();
    if (!this.stalactites.length) {
      if (Math.random() < 0.4) this.addStalactite();
      return;
    }
    const sorted = this.stalactites.slice().sort((a, b) =>
      Math.abs(a.x - this.player.x) - Math.abs(b.x - this.player.x));
    const n = Math.min(Phaser.Math.Between(1, 3), sorted.length);
    for (let i = 0; i < n; i++) this.detachStalactite(sorted[i]);
  }

  // Stacca UNA stalattite: distrugge lo sprite appeso e fa nascere al suo posto un chunk VERO
  // (stesso gruppo/sprite/tinta del round 1, solo velocita' iniziale leggermente maggiore —
  // parte gia' "smossa" dalla scossa, non da ferma) che cade con la fisica/danno gia' esistenti.
  detachStalactite(s) {
    const idx = this.stalactites.indexOf(s);
    if (idx === -1) return;
    this.stalactites.splice(idx, 1);
    const cx = s.x;
    const key = s.sprite.texture.key;
    s.sprite.destroy();
    const chunk = this.collapseChunks.create(cx, this.ceilingYAt(cx) + 4, key).setDepth(8);
    const src = this.textures.get(key).getSourceImage();
    chunk.setScale((window.CONFIG.BLOCK * 1.3) / src.width);
    chunk.setAngle(Phaser.Math.Between(-20, 20));
    if (Math.random() < 0.5) chunk.setFlipX(true);
    chunk.setTint(this._waxTint('hard', 1));
    chunk.body.setAllowGravity(true);
    chunk.body.setSize(24, 24, true);
    chunk.setVelocityY(60);
    this.time.delayedCall(5000, () => { if (chunk.active) chunk.destroy(); });   // rete di sicurezza
  }

  // Impatto della frana: danno ad area al cerume vicino (puo' aprire un varco), effetto
  // visivo, poi si distrugge. Guardia anti-doppio-impatto (piu' overlap nello stesso frame,
  // es. urta un blocco e una pedana insieme).
  collapseImpact(c) {
    if (!c.active) return;
    const R = 46;
    this.blocks.getChildren().forEach((b) => {
      if (b.active && Math.hypot(b.x - c.x, b.y - c.y) < R) this.damageBlock(b, 26);
    });
    this.splat(c.x, c.y, 'hard');
    this.burst('bit_hard', c.x, c.y, 10);
    window.Sfx.smash();
    c.destroy();
  }

  // I blocchi che non incontrano cerume/pedane nella caduta atterrano a terra (come le gocce).
  updateCollapseChunks() {
    this.collapseChunks.getChildren().forEach((c) => {
      if (c.active && c.y >= this.groundTop - 6) {
        this.splat(c.x, this.groundTop - 8, 'hard');
        this.burst('bit_hard', c.x, this.groundTop - 8, 6);
        c.destroy();
      }
    });
  }

  // EVENTO "Sciame Improvviso": invece del solito flusso regolare, un'ondata unica di nemici
  // deboli arriva tutta insieme da un lato — un picco di caos concentrato. Rispetto a
  // spawnSplitChildren i "figli" qui sono nemici normali (niente comparsa istantanea, emergono
  // dal suolo come sempre) solo con statistiche ridotte, e usano l'IA normale del blob.
  startSwarmRushEvent() {
    const delay = Phaser.Math.Between(3000, 6000);
    this.time.delayedCall(delay, () => { if (!this.locked) this.spawnSwarmRush(); });
  }

  spawnSwarmRush() {
    const lvl = window.GameState.level;
    const side = Math.random() < 0.5 ? 1 : -1;
    // Centro del gruppo scelto con pickGroundX(side): resta DENTRO la sezione raggiungibile
    // (tra le membrane), cosi' il gruppo non rischia di comparire oltre un muro intero e
    // restare bloccato (lo stesso problema gia' corretto per il Fuggitivo Dorato).
    const baseX = this.pickGroundX(side);
    const count = Phaser.Math.Between(5, Math.min(8, 5 + Math.floor(lvl / 3)));
    this.showBanner(window.I18n.t('event_swarmrush_in'), '#9be870');
    for (let i = 0; i < count; i++) {
      const x = Phaser.Math.Clamp(baseX + Phaser.Math.Between(-70, 70), 60, this.worldW - 60);
      const e = this.spawnEnemy('blob', { x, swarmling: true });
      e.swarmling = true;
      // Individualmente deboli (il picco di minaccia e' il NUMERO, non la singola unita').
      e.hp = e.maxHp = Math.max(1, Math.round(e.maxHp * 0.55));
      e.speed = Math.round(e.speed * 1.15);
      e.waxValue = Math.round(e.waxValue * 0.7);
    }
  }

  // Garantisce un minimo di pickup-CURA per livello (la vita non si ricarica piu' a fine
  // livello): se le pedane non ne hanno prodotti abbastanza a caso, ne aggiunge su pedane
  // libere. Cosi' ci si cura esplorando, ma senza restare mai a secco di cure.
  ensureHealPickups() {
    const want = 2 + Math.floor(window.GameState.level / 4);
    let have = this.pickups.getChildren().filter((p) => p.active && p.isHeal).length;
    const plats = this.platforms ? this.platforms.getChildren().filter((p) => p.active).slice() : [];
    Phaser.Utils.Array.Shuffle(plats);
    for (let i = 0; i < plats.length && have < want; i++) {
      this.addWaxPickup(plats[i].x, plats[i].y - 26, true);
      have++;
    }
  }

  // Terreno accidentato: pozze di cerume scivoloso (rallentano se ci cammini sopra, dal
  // lvl 2) e ostacoli mobili che vanno avanti e indietro e feriscono al contatto (dal
  // lvl 3). Entrambi crescono di numero (e i mobili di velocita') col livello.
  buildHazards() {
    const lvl = window.GameState.level;
    this.slimeZones = [];
    this.bumpZones = [];      // fasce occupate dai RILIEVI (per non sovrapporre altre insidie)
    this.pitZones = [];       // fasce delle BUCHE (lette in update per il danno)
    const slimeCount = lvl >= 2 ? Phaser.Math.Clamp(1 + Math.floor(lvl / 3), 1, 4) : 0;
    for (let i = 0; i < slimeCount; i++) this.addSlimeZone();

    // RILIEVI/BUCHE a rettangolo (round 4) DISABILITATI: sostituiti dal TERRENO a gradini
    // camminabile (`buildTerrain`, prototipo). Il codice resta finche' il nuovo look e' approvato.
    const bumpCount = 0;
    for (let i = 0; i < bumpCount; i++) this.addBump();
    const pitCount = 0;
    for (let i = 0; i < pitCount; i++) this.addPit();

    // Gocce dal soffitto (dal lvl 2): "movers" contiene le GOCCE che cadono (riusa l'overlap
    // col giocatore per il danno), "drips" sono gli emettitori fissi a soffitto.
    this.movers = this.physics.add.group({ allowGravity: false });
    this.drips = [];
    const dripCount = lvl >= 2 ? Phaser.Math.Clamp(Math.floor(lvl / 2), 1, 4) : 0;
    for (let i = 0; i < dripCount; i++) this.addDripHazard();
  }

  // Trova una fascia orizzontale libera (lontana da membrane e da altre pozze/ostacoli
  // gia' piazzati) per un nuovo elemento largo `w`. Ritorna null se non trova posto.
  pickHazardX(w, margin) {
    margin = margin || 0;
    for (let tries = 0; tries < 20; tries++) {
      const x = Phaser.Math.Between(280, this.worldW - 320 - w);
      const cx = x + w / 2;
      const nearMembrane = this.membraneXs.some((mx) => Math.abs(mx - cx) < 150 + margin);
      const bands = [].concat(this.slimeZones || [], this.bumpZones || [], this.pitZones || []);
      const nearZone = bands.some((z) => x < z.x2 + 60 && x + w > z.x1 - 60);
      if (!nearMembrane && !nearZone) return x;
    }
    return null;
  }

  // RILIEVO (round 4): gobba SOLIDA sul pavimento, alta al massimo un salto → si SCAVALCA.
  // Collide solo col GIOCATORE (i nemici gommosi la "sorpassano", cosi' non restano incastrati).
  addBump() {
    const w = Phaser.Math.Between(34, 62);
    const x = this.pickHazardX(w, 20);
    if (x == null) return;
    const C = window.CONFIG.COLORS;
    const h = Phaser.Math.Between(38, 82);          // saltabile (l'apice del salto e' ben piu' alto)
    const cx = x + w / 2;
    const r = this.add.rectangle(cx, this.groundTop - h / 2, w, h, C.ground).setDepth(4.6);
    r.setStrokeStyle(2, C.groundDark, 0.9);
    this.physics.add.existing(r, true);
    this.terrainBumps.add(r);
    this.bumpZones.push({ x1: x, x2: x + w });
  }

  // BUCA (round 4): pozza scura affossata; stando DENTRO a terra si prende danno (update) → si
  // supera SALTANDO. Solo estetica + fascia memorizzata (il pavimento fisico resta piatto = sicuro).
  addPit() {
    const w = Phaser.Math.Between(64, 120);
    const x = this.pickHazardX(w, 20);
    if (x == null) return;
    const cx = x + w / 2, top = this.groundTop;
    const hole = this.add.rectangle(cx, top + 24, w, 48, 0x2a1016, 0.98).setDepth(4.45);   // interno scuro
    hole.setStrokeStyle(2, 0x140709, 1);
    const surf = this.add.rectangle(cx, top + 2, w - 4, 6, 0x7a3340, 0.9).setDepth(4.55);   // "superficie" che ribolle
    this.tweens.add({ targets: surf, scaleY: 1.7, yoyo: true, repeat: -1, duration: 700, ease: 'Sine.inOut' });
    this.pitZones.push({ x1: x, x2: x + w });
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

  // Texture "goccia" a lacrima (punta in alto, pancia rotonda in basso). Segnaposto finche'
  // non avremo uno sprite dedicato per la goccia/l'emettitore.
  makeDripTexture() {
    if (this.textures.exists('drip')) return;
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xe8a32a, 1);
    g.fillCircle(7, 15, 6);                       // pancia rotonda (basso)
    g.fillTriangle(7, 1, 2.5, 14, 11.5, 14);      // punta (alto)
    g.fillStyle(0xffd98a, 0.85); g.fillCircle(5, 12, 1.8);   // riflesso
    g.generateTexture('drip', 14, 22);
    g.destroy();
  }

  // Emettitore di GOCCE ATTACCATO AL SOFFITTO: una "radice" di cerume incollata al bordo alto,
  // sotto cui una goccia (a lacrima) si GONFIA (telegrafo) e poi CADE. La caduta ferisce il
  // giocatore (overlap in this.movers). Verticale e leggibile: si schiva leggendo il ritmo.
  addDripHazard() {
    this.makeDripTexture();
    const x = this.pickHazardX(40, 20);
    if (x == null) return;
    const cx = x + 20, topY = Math.max(0, this.ceilingYAt(x + 20) - 6);   // attaccato al soffitto LOCALE
    // radice: macchia di cerume larga e piatta incollata al soffitto
    const root = this.add.ellipse(cx, topY + 5, 30, 16, 0xcf9524, 0.96).setDepth(8);
    root.setStrokeStyle(1.5, 0xffd98a, 0.6);
    // goccia che pende sotto la radice (cresce durante il gonfiore)
    const bead = this.add.image(cx, topY + 15, 'drip').setDepth(8).setScale(0.5);
    this.drips.push({ x: cx, topY, root, bead, state: 'idle', nextAt: this.time.now + Phaser.Math.Between(500, 2200), swellUntil: 0 });
  }

  // Rilascia una goccia (a lacrima) che cade con la gravita' del mondo. Entra in this.movers.
  releaseDrip(d) {
    const drop = this.movers.create(d.x, d.topY + 22, 'drip').setDepth(8).setScale(1.1);
    drop.body.setAllowGravity(true);
    drop.body.setSize(10, 16, true);
    drop.setVelocityY(30);
    this.time.delayedCall(4000, () => { if (drop.active) drop.destroy(); });
  }

  // Ciclo degli emettitori (attesa -> gonfiore/telegrafo -> rilascio) + splash delle gocce a terra.
  updateDrips(now) {
    if (this.drips) {
      this.drips.forEach((d) => {
        if (d.state === 'idle') {
          if (now >= d.nextAt) { d.state = 'swell'; d.swellUntil = now + 640; }
        } else {
          const t = Phaser.Math.Clamp(1 - (d.swellUntil - now) / 640, 0, 1);   // 0..1 gonfiore
          d.bead.setScale(0.5 + t * 0.7);           // la goccia pende e si gonfia (telegrafo)
          d.bead.y = d.topY + 15 + t * 8;           // si allunga verso il basso
          if (now >= d.swellUntil) {
            this.releaseDrip(d);
            d.bead.setScale(0.5); d.bead.y = d.topY + 15;
            d.state = 'idle';
            d.nextAt = now + Phaser.Math.Between(1500, 2800);
          }
        }
      });
    }
    if (this.movers) {
      this.movers.getChildren().forEach((m) => {
        if (m.active && m.y >= this.groundTop - 4) { this.splat(m.x, this.groundTop - 6, 'soft'); m.destroy(); }
      });
    }
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

  // Pallina di cerume lasciata da un nemico alla morte (F.1b): come addWaxPickup ma con
  // valore VARIABILE (quello del nemico, non il fisso 5 delle pedane) + un piccolo "pop" di
  // comparsa (parte piu' piccola e cresce), per segnalare che e' appena spuntata dal nemico.
  dropWaxPellet(x, y, value) {
    const p = this.pickups.create(x, y, 'wax_glob').setDepth(7).setScale(0.4);
    p.body.setAllowGravity(false);
    p.body.setSize(14, 14, true);
    p.waxValue = value;
    this.tweens.add({ targets: p, scale: 1, duration: 160, ease: 'Back.out' });
    this.tweens.add({ targets: p, y: y - 6, yoyo: true, repeat: -1, duration: 750, ease: 'Sine.inOut', delay: 160 });
  }

  grabPickup(pk) {
    if (!pk || !pk.active) return;
    window.GameState.wax += Math.round(pk.waxValue * (window.GameState.player.waxMult || 1) * (this.mutWaxMult || 1) * window.CONFIG.WAX_GAIN);   // Cerume Extra + mutatore + manopola globale
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
    if (lvl >= 2) pool.push(['flea', 3]);    // presto in partita: fastidiosa, poco minacciosa
    if (lvl >= 3) pool.push(['spit', 2]);
    if (lvl >= 3) pool.push(['hopper', 2]);  // dal lvl 3: minaccia seria, balzo enorme
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
    } else if (kind === 'flea') {
      // Pulce: piccola, debole, salta di CONTINUO verso il giocatore (non un singolo affondo
      // come il cerumino) - fastidiosa piu' che pericolosa, presto in partita per varieta'.
      cfg = { tex: 'enemy_flea', hp: 14 + lvl * 2, speed: 40, dmg: 6 + lvl, wax: 3, bit: 'bit_wax', body: [16, 14] };
    } else if (kind === 'hopper') {
      // Saltatore: un balzo enorme e telegrafato (molto piu' del cerumino), atterraggio ad
      // onda d'urto - minaccia seria, dal livello 3.
      cfg = { tex: 'enemy_hopper', hp: 55 + lvl * 6, speed: 30, dmg: 16 + lvl * 2, wax: 10, bit: 'bit_dirt', body: [30, 24], scale: 1.3 };
    } else {
      cfg = { tex: 'enemy_blob', hp: 30 + lvl * 4, speed: 72 + lvl * 3, dmg: 11 + lvl * 2, wax: 5, bit: 'bit_wax', body: [26, 22], scale: 1.6 };
    }

    // MODIFICATORE di livello: adatta le statistiche del nemico appena create.
    cfg.speed = Math.round(cfg.speed * (this.mutEnemySpeed || 1));
    cfg.hp = Math.max(1, Math.round(cfg.hp * (this.mutEnemyHp || 1)));
    cfg.wax = Math.round(cfg.wax * (this.mutEnemyWax || 1));

    // FIGLIO DELLO SPLIT: piu' piccolo, debole E MENO DANNOSO del genitore (due figli ~= un
    // genitore anche come minaccia: senza ridurre anche il danno, due figli farebbero insieme
    // il doppio del danno del genitore invece che l'equivalente).
    if (opts.splitChild) {
      cfg.hp = Math.max(1, Math.round(cfg.hp * 0.4));
      cfg.dmg = Math.max(1, Math.round(cfg.dmg * 0.4));
      if (cfg.projDmg) cfg.projDmg = Math.max(1, Math.round(cfg.projDmg * 0.4));
      cfg.wax = Math.max(1, Math.round(cfg.wax * 0.5));
      cfg.scale = (cfg.scale || 1) * 0.7;
    }

    // VARIANTE ELITE (dal lvl 3): a volte un nemico normale e' potenziato. Modifica cfg PRIMA
    // del calcolo scala/posizione; l'aura e i comportamenti di morte si agganciano dopo (sotto).
    // I volanti restano fuori dallo SPLIT (la comparsa "sul posto" dei figli non si presta al
    // calo dal soffitto).
    let elite = null;
    if (!cfg.boss && !opts.splitChild && !opts.fugitive && !opts.swarmling && lvl >= 3 &&
        Math.random() < Phaser.Math.Clamp(0.08 + lvl * 0.02, 0, 0.34)) {
      const pool = (kind === 'fly') ? ['tank', 'boom'] : ['tank', 'boom', 'split'];
      elite = Phaser.Utils.Array.GetRandom(pool);
      if (elite === 'tank') {          // CORAZZATO: grosso, tanta vita, lento, piu' cerume
        cfg.hp = Math.round(cfg.hp * 2.2);
        cfg.speed = Math.round(cfg.speed * 0.82);
        cfg.dmg = Math.round(cfg.dmg * 1.2);
        cfg.wax = Math.round(cfg.wax * 1.9);
        cfg.scale = (cfg.scale || 1) * 1.25;
      } else if (elite === 'boom') {   // ESPLOSIVO: scoppia morendo (vedi enemyExplode)
        cfg.hp = Math.round(cfg.hp * 1.25);
        cfg.wax = Math.round(cfg.wax * 1.5);
      } else {                         // SPLIT: leggero bonus, il premio vero e' sdoppiarsi alla morte
        cfg.hp = Math.round(cfg.hp * 1.15);
        cfg.wax = Math.round(cfg.wax * 1.3);
      }
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
    if (cfg.boss) {
      e.bossAtk = null;                                         // stato attacco balzo+schiacciata (vedi bossAI)
      e.slamReadyAt = this.time.now + Phaser.Math.Between(2500, 4000);   // niente slam nei primissimi istanti
      e.slamShadow = null;                                      // ombra a terra durante il balzo (round 2, D.1)
      e.once('destroy', () => { if (e.slamShadow) { e.slamShadow.destroy(); e.slamShadow = null; } });
    }

    // ELITE: aura colorata dietro il nemico (segnale visivo, niente tint per non confliggere
    // coi lampi dei colpi). L'aura viene sincronizzata in update() e distrutta con il nemico.
    if (elite) {
      e.elite = elite;
      const col = { tank: 0x8fd0ff, boom: 0xff6b3d, split: 0x9b7bff }[elite];
      const auraR = Math.max(cfg.body[0], cfg.body[1]) * (cfg.scale || 1) * 0.7;
      e.eliteAura = this.add.circle(e.x, e.y, auraR, col, 0.16).setDepth(7).setStrokeStyle(2.5, col, 0.85);
      e.once('destroy', () => { if (e.eliteAura) { e.eliteAura.destroy(); e.eliteAura = null; } });
    }

    // Comparsa animata (la scala finale dipende dal tipo: i PNG nativi vanno ingranditi).
    // I figli dello SPLIT compaiono con un "pop" istantaneo sul posto (il genitore e' appena
    // morto li': emergere da lontano non avrebbe senso).
    if (opts.splitChild) this.splitPop(e, targetScale);
    else if (cfg.fly) this.dropFromCeiling(e, targetScale);
    else this.emergeFromGround(e, targetScale, y, x, groundTop, !!cfg.boss);
    return e;
  }

  // Comparsa istantanea per i figli dello SPLIT: pop rapido sul posto, niente emersione dal
  // terreno. Resta "spawning" (inerte) per una manciata di ms, come le altre comparse.
  splitPop(e, targetScale) {
    e.setScale(targetScale * 0.3);
    e.setAlpha(0.85);
    this.tweens.add({
      targets: e, scaleX: targetScale, scaleY: targetScale, alpha: 1,
      duration: 150, ease: 'Back.out',
      onComplete: () => { e.spawning = false; },
    });
  }

  // ESPLOSIVO: alla morte, un breve telegrafo poi uno scoppio ad area nel punto del corpo
  // (chi ha ucciso il nemico da vicino deve scansarsi). Fa danno solo al giocatore.
  enemyExplode(x, y) {
    const warn = this.add.circle(x, y, 12, 0xff6b3d, 0.5).setDepth(11);
    this.tweens.add({ targets: warn, scale: 5.5, alpha: 0.12, duration: 280, ease: 'Quad.in' });
    this.time.delayedCall(280, () => {
      if (warn.active) warn.destroy();
      const R = 74;
      const dmg = 14 + Math.floor(window.GameState.level / 2);
      const ring = this.add.circle(x, y, R, 0xff8a4a, 0.35).setDepth(12).setScale(0.3);
      this.tweens.add({ targets: ring, scale: 1, alpha: 0, duration: 300, ease: 'Quad.out', onComplete: () => ring.destroy() });
      window.Sfx.smash();
      this.cameras.main.shake(180, 0.012);
      if (Math.hypot(this.player.x - x, this.player.y - y) < R) {
        this.hurtPlayer(dmg, x);
      }
      // Danno ad area anche a nemici e cerume vicini (prima colpiva SOLO il giocatore).
      // Se un altro Esplosivo muore nel raggio, scoppia a sua volta (reazione a catena voluta:
      // tema "esplosivo", niente da smorzare — il numero di nemici per livello e' comunque finito).
      this.enemies.getChildren().forEach((e) => {
        if (e.active && !e.spawning && Math.hypot(e.x - x, e.y - y) < R) this.damageEnemy(e, dmg);
      });
      this.blocks.getChildren().forEach((b) => {
        if (b.active && Math.hypot(b.x - x, b.y - y) < R) this.damageBlock(b, dmg);
      });
    });
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
  // preferSide: 1 = preferisci DAVANTI, -1 = preferisci DIETRO, omesso = peso normale 70/30
  // (usato dall'evento Sciame per far arrivare il gruppo "da un lato" restando comunque
  // dentro la sezione raggiungibile — vedi spawnSwarmRush).
  pickGroundX(preferSide) {
    const px = this.player.x;
    let left = 40, right = this.worldW - 40;
    (this.membraneXs || []).forEach((mx) => {
      if (mx <= px) { if (mx + 80 > left) left = mx + 80; }     // appena dopo la membrana dietro
      else { if (mx - 80 < right) right = mx - 80; }            // appena prima della membrana davanti
    });
    // Bordo raggiungibile PIU' LONTANO dal giocatore: il ripiego sicuro quando non c'e'
    // spazio per la distanza piena (mai piazzare un nemico ADDOSSO allo spawn).
    const farthestEdge = () => (Math.abs(left - px) >= Math.abs(right - px)) ? left : right;
    if (right <= left) return Math.round(Phaser.Math.Clamp(farthestEdge(), 40, this.worldW - 40));

    const gap = 200;                                            // distanza minima dal giocatore
    const aLo = Math.min(px + gap, right), aHi = right;         // davanti
    const bLo = left, bHi = Math.max(px - gap, left);           // dietro
    const aOk = aHi - aLo > 20, bOk = bHi - bLo > 20;
    const wantAhead = preferSide === 1 ? true : preferSide === -1 ? false : (Math.random() < 0.7);
    let x;
    if (aOk && (wantAhead || !bOk)) x = Phaser.Math.Between(aLo, aHi);
    else if (bOk) x = Phaser.Math.Between(bLo, bHi);
    else x = farthestEdge();                                    // sezione stretta: il punto piu' lontano, mai addosso
    // Rete di sicurezza: mai piu' vicino di 130px al giocatore, se la sezione lo consente
    // (prima il ripiego poteva far nascere un nemico sopra lo spawn → morte istantanea).
    if (Math.abs(x - px) < 130) x = farthestEdge();
    return Math.round(Phaser.Math.Clamp(x, left, right));
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
    // Gravita' REALE del mondo (non la costante CONFIG): il mutatore "poca gravita'" la cambia
    // a runtime, e la parabola deve tenerne conto o il proiettile sbaglia completamente mira.
    const g = this.physics.world.gravity.y;
    const dir = Math.sign(this.player.x - e.x) || 1;
    const sx = e.x + dir * 12, sy = e.y - 6;
    const dx = (this.player.x + (aimOff || 0)) - sx;
    const dy = (this.player.y - 8) - sy;
    const dist = Math.hypot(dx, dy);
    const T = Phaser.Math.Clamp(dist / 230, 0.65, 1.25);  // tempo di volo (piu' lungo = pallina piu' lenta)
    const vx = dx / T;
    const vy = (dy - 0.5 * g * T * T) / T;               // soluzione balistica
    const proj = this.projectiles.create(sx, sy, 'proj_poison').setDepth(9);
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
  showBanner(text, color, y) { window.GameGfx.showBanner(this, text, color, y); }

  showSpeech(text) { window.GameGfx.showSpeech(this, this.player.x, this.player.y - 46, text); }

  // CARATTERE COMICO: sceglie una battuta a caso dalla categoria e la mostra, rispettando un
  // cooldown GLOBALE (altrimenti spammerebbe, es. ad ogni uccisione) + una probabilita'
  // opzionale (`chance`) per le categorie che capitano spesso (uccisione, colpo subito) cosi'
  // non commenta OGNI singolo evento. `force` salta il cooldown (solo per inizio livello/boss:
  // altrimenti un'uccisione o un colpo nei primi istanti del livello gli "ruberebbe il turno"
  // prima che scatti, facendola sparire silenziosamente).
  maybeSpeech(category, chance, force) {
    const now = this.time.now;
    if (!force && now < (this.speechCooldownUntil || 0)) return;
    if (chance !== undefined && Math.random() > chance) return;
    const pool = window.SPEECH[category];
    if (!pool || !pool.length) return;
    this.speechCooldownUntil = now + 4500;
    this.showSpeech(window.I18n.t(Phaser.Utils.Array.GetRandom(pool)));
  }

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
    this.showRangedWeapon(nx, ny);          // arma in mano puntata verso la mira
    const oy = this.crouching ? 14 : -6;   // accovacciato: il getto parte all'altezza dei piedi
    // Abilità RABBIA: se armata, TUTTE le palline di questo colpo (anche il ventaglio) fanno
    // piu' danno — un solo colpo "vale" da attacco unico, si consuma qui una volta sola.
    const rageMult = this.consumeRage();
    // Abilità VENTAGLIO (impilabile): spara N palline a ventaglio (N = p.jetPellets).
    const n = Math.max(1, p.jetPellets | 0);
    const a0 = Math.atan2(ny, nx);
    const step = 0.16;   // apertura tra una pallina e l'altra
    for (let i = 0; i < n; i++) {
      const da = (i - (n - 1) / 2) * step;   // simmetrico attorno alla direzione di mira
      this.spawnPellet(Math.cos(a0 + da), Math.sin(a0 + da), oy, p, rageMult);
    }
    // Abilità DOPPIO GETTO: una seconda bocca spara ANCHE all'indietro, sempre 1 pallina sola
    // (non moltiplicata dal Ventaglio — e' una bocca in piu', non un altro ventaglio).
    if (p.backShot) this.spawnPellet(-nx, -ny, oy, p, rageMult);
    window.Sfx.spray();
  }

  // Crea una singola pallina di getto (usata da fireJet, anche a ventaglio/doppio getto).
  spawnPellet(nx, ny, oy, p, rageMult) {
    const sp = 580;
    const s = this.shots.create(this.player.x + nx * 18, this.player.y + oy + ny * 14, 'soap').setDepth(9);
    s.body.setAllowGravity(false);
    s.body.setSize(10, 10, true);
    s.setVelocity(nx * sp, ny * sp);
    s.dmg = Math.round(p.jetDamage * (rageMult || 1));
    // EVOLUZIONE "Lama d'Acqua": perfora TUTTO; altrimenti abilità PERFORANTE normale.
    s.pierceLeft = p.evoPierceAll ? 999 : (p.jetPierce ? 3 : 1);
    s.splash = p.jetSplash;                // abilità SCOPPIO DI SAPONE (area all'impatto)
    s.homing = p.homing;                   // abilità MIRA GUIDATA (curva verso il nemico)
    s.corrosive = p.corrosive;             // abilità SAPONE CORROSIVO (avvelena all'impatto)
    s.stun = p.stunShot;                   // abilità GETTO STORDENTE (stordisce all'impatto)
    s.bounceLeft = p.bounce | 0;           // abilità RIMBALZO (rimbalza N volte sui muri/suolo)
    s.bounceGrace = 0;
    if (p.corrosive) s.setTint(0x9be86b);  // pallina verde = corrosiva
    const flash = this.add.circle(this.player.x + nx * 20, this.player.y + oy + ny * 20, 7, 0xdff3ff, 0.9).setDepth(11);
    this.tweens.add({ targets: flash, scale: 0.2, alpha: 0, duration: 120, ease: 'Quad.out', onComplete: () => flash.destroy() });
    this.time.delayedCall(850 + (p.bounce | 0) * 300, () => { if (s.active) s.destroy(); });   // vive di più se rimbalza
  }

  popShot(s) {
    if (!s || !s.active) return;
    this.splat(s.x, s.y, 'soft');
    if (s.splash) this.soapSplash(s.x, s.y);   // abilità: scoppio ad area all'impatto
    s.destroy();
  }

  // Abilità RIMBALZO: la pallina rimbalza sulla superficie invece di spappolarsi. Deduce l'asse
  // dell'urto (orizzontale/verticale) confrontando la distanza dal centro della superficie
  // normalizzata sui semilati, poi inverte la velocità su quell'asse. Consuma un rimbalzo.
  bounceShot(sh, solid) {
    if (!sh || !sh.active) return;
    const now = this.time.now;
    if (now < (sh.bounceGrace || 0)) return;   // evita doppi rimbalzi nello stesso istante
    sh.bounceGrace = now + 60;
    const sb = solid.getBounds();
    const dx = sh.x - (sb.x + sb.width / 2);
    const dy = sh.y - (sb.y + sb.height / 2);
    const halfW = sb.width / 2 + 6, halfH = sb.height / 2 + 6;
    if (Math.abs(dx) / halfW > Math.abs(dy) / halfH) {
      sh.setVelocity(-sh.body.velocity.x, sh.body.velocity.y);   // urto laterale: inverti X
      sh.x += Math.sign(dx) * 5;
    } else {
      sh.setVelocity(sh.body.velocity.x, -sh.body.velocity.y);   // urto sopra/sotto: inverti Y
      sh.y += Math.sign(dy) * 5;
    }
    sh.bounceLeft -= 1;
    window.Sfx.crack();
    const f = this.add.circle(sh.x, sh.y, 5, 0xdff3ff, 0.85).setDepth(11);
    this.tweens.add({ targets: f, scale: 0.2, alpha: 0, duration: 140, ease: 'Quad.out', onComplete: () => f.destroy() });
  }

  // Scoppio di sapone (abilità SPLASH): quando una pallina finisce, fa un piccolo scoppio
  // che pulisce il cerume e danneggia i nemici in un raggio ridotto. Danno = frazione del getto.
  soapSplash(x, y) {
    const R = 48;
    const dmg = Math.max(4, Math.round(window.GameState.player.jetDamage * 0.6));
    const ring = this.add.circle(x, y, R, 0xdff3ff, 0.35).setDepth(11).setScale(0.25);
    this.tweens.add({ targets: ring, scale: 1, alpha: 0, duration: 220, ease: 'Quad.out', onComplete: () => ring.destroy() });
    window.Sfx.spray();
    const toxic = window.GameState.player.evoToxic;   // EVOLUZIONE Nube Tossica: lo scoppio avvelena
    this.enemies.getChildren().forEach((e) => {
      if (e.active && !e.spawning && Math.hypot(e.x - x, e.y - y) < R) { this.damageEnemy(e, dmg); if (toxic && e.active) this.applyCorrosion(e); }
    });
    this.blocks.getChildren().forEach((b) => {
      if (b.active && Math.hypot(b.x - x, b.y - y) < R) this.damageBlock(b, dmg);
    });
  }

  // ---------- Aiutante (abilità COMPANION) ----------

  // Texture della bolla-aiutante: una bolla di sapone azzurra con un occhietto.
  makeBuddyTexture() {
    if (this.textures.exists('buddy')) return;
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0x8fd0ff, 0.95); g.fillCircle(9, 9, 8);      // corpo bolla
    g.fillStyle(0xffffff, 0.9); g.fillCircle(6, 6, 2.6);     // riflesso
    g.lineStyle(1, 0xffffff, 0.6); g.strokeCircle(9, 9, 8);
    g.fillStyle(0x14161f, 1); g.fillCircle(11, 9, 1.8);      // occhietto
    g.generateTexture('buddy', 18, 18);
    g.destroy();
  }

  // Crea una bolla-aiutante (index-esima di `total`): segue il giocatore orbitando e spara
  // da sola. Le bolle sono sfasate sull'orbita (phase) così restano equidistanti.
  spawnCompanion(index, total) {
    this.makeBuddyTexture();
    const c = this.add.image(this.player.x, this.player.y - 30, 'buddy').setDepth(11);
    c._baseScale = 1.4;
    c.setScale(c._baseScale);
    c.phase = (index / Math.max(1, total)) * Math.PI * 2;   // posizione sull'anello
    c.nextFire = index * 250;                               // fuoco sfalsato tra le bolle
    this.companions.push(c);
  }

  // Ogni frame: tutte le bolle orbitano (equidistanti) e sparano al nemico più vicino.
  updateCompanions(now) {
    const R = 46 + Math.min(14, this.companions.length * 2);   // anello un filo più largo con più bolle
    this.companions.forEach((c) => {
      if (!c || !c.active) return;
      const ang = now * 0.004 + c.phase;
      const tx = this.player.x + Math.cos(ang) * R;
      const ty = this.player.y - 26 + Math.sin(ang) * (R * 0.45);   // orbita ellittica, sopra la spalla
      c.x += (tx - c.x) * 0.2;   // inseguimento morbido (lerp)
      c.y += (ty - c.y) * 0.2;
      if (now >= c.nextFire) {
        const target = this.nearestEnemyInRange(c.x, c.y, 320);
        if (target) { this.companionFire(c, target); c.nextFire = now + 750; }
        else c.nextFire = now + 200;   // niente bersagli: ricontrolla presto
      }
    });
  }

  // Abilità MIRA GUIDATA: le palline curvano dolcemente verso un nemico DAVANTI a loro. È un
  // aiuto di mira, non un cerca-bersagli: aggancia solo nemici entro un cono in avanti (~55°),
  // così sparando dalla parte opposta i colpi NON fanno inversioni a U per andare a segno.
  updateHomingShots(now) {
    const CONE = 0.95;   // ~55°: oltre questo scarto angolare il bersaglio è "fuori tiro"
    const TURN = 0.08;   // virata per frame (dolce: niente giri a U)
    const RANGE = 230;
    this.shots.getChildren().forEach((s) => {
      if (!s.active || !s.homing) return;
      const cur = Math.atan2(s.body.velocity.y, s.body.velocity.x);
      // nemico più vicino ENTRO il cono davanti alla pallina
      let best = null, bd = RANGE;
      this.enemies.getChildren().forEach((e) => {
        if (!e.active || e.spawning) return;
        const d = Math.hypot(e.x - s.x, e.y - s.y);
        if (d >= bd) return;
        const ang = Math.atan2(e.y - s.y, e.x - s.x);
        if (Math.abs(Phaser.Math.Angle.Wrap(ang - cur)) > CONE) return;   // dietro/di lato: ignora
        bd = d; best = e;
      });
      if (!best) return;
      const sp = Math.hypot(s.body.velocity.x, s.body.velocity.y) || 580;
      const want = Math.atan2(best.y - s.y, best.x - s.x);
      const na = cur + Phaser.Math.Angle.Wrap(want - cur) * TURN;
      s.setVelocity(Math.cos(na) * sp, Math.sin(na) * sp);
    });
  }

  // Abilità SAPONE CORROSIVO: marca il nemico perché perda vita nel tempo (~2s).
  applyCorrosion(e) {
    const now = this.time.now;
    e.corrodeUntil = now + 2200;
    e.corrodeNext = now + 350;
    e.corrodeDmg = Math.max(2, Math.round(window.GameState.player.jetDamage * 0.22));
  }

  // Abilità GETTO STORDENTE: il nemico colpito resta fermo un attimo (si somma all'eventuale
  // knockback, non lo sostituisce — vedi il gate in update()).
  applyStun(e) {
    if (!e.active) return;
    e.stunnedUntil = Math.max(e.stunnedUntil || 0, this.time.now + 500);
  }

  // Abilità RABBIA: dopo un colpo subito, il PROSSIMO attacco (corpo a corpo o a distanza) fa
  // danno maggiorato; si consuma con quel singolo attacco, o scade da solo se non attacchi in
  // tempo (armata da hurtPlayer). Ritorna il moltiplicatore da applicare a QUESTO attacco.
  consumeRage() {
    if (this.rageReadyUntil && this.time.now < this.rageReadyUntil) {
      this.rageReadyUntil = 0;
      return 1.6;
    }
    return 1;
  }

  // Scia dello scatto: copie "fantasma" dell'aspetto ATTUALE del personaggio (stessa texture/
  // frame/flip di this.heroVisual) che si dissolvono. DIFFERENZIATA forte tra i due scatti
  // (round 2, C.1): quello normale resta sobrio (azzurro, pochi fantasmi); quello OFFENSIVO e'
  // vistosamente piu' denso/luminoso (arancio, piu' fantasmi, scintille lungo il tragitto) cosi'
  // "questo scatto fa male" si legge a colpo d'occhio, non solo dal colore. Throttle piu' basso
  // (20ms, era 40ms) per lasciare piu' copie nella scia dei ~160ms di scatto.
  spawnDashGhost(damaging) {
    const now = this.time.now;
    if (this._lastDashGhostAt && now - this._lastDashGhostAt < 20) return;
    this._lastDashGhostAt = now;
    const hv = this.heroVisual;
    const ghost = this.add.sprite(hv.x, hv.y, hv.texture.key, hv.frame.name)
      .setOrigin(hv.originX, hv.originY).setScale(hv.scaleX, hv.scaleY)
      .setFlipX(hv.flipX).setDepth(hv.depth - 1).setAlpha(damaging ? 0.85 : 0.65)
      .setTintFill(damaging ? 0xff6b3d : 0x8fe0ff);
    this.tweens.add({
      targets: ghost, alpha: 0, scaleX: ghost.scaleX * 1.1, scaleY: ghost.scaleY * 1.1,
      duration: 220, ease: 'Quad.out', onComplete: () => ghost.destroy(),
    });
    // Scintille lungo il tragitto: SOLO nello scatto offensivo, throttle piu' largo del
    // fantasma (60ms) cosi' non affoga la scia in particelle.
    if (damaging && (!this._lastDashSparkAt || now - this._lastDashSparkAt >= 60)) {
      this._lastDashSparkAt = now;
      this.burst('bit_hard', hv.x, hv.y, 2);
    }
  }

  // Lampo UNA TANTUM all'inizio dello scatto offensivo (oltre alla scia arancio sopra): marca
  // bene il momento "questo scatto fa danno", lo scatto normale non ce l'ha.
  dashStrikeFx() {
    const ring = this.add.circle(this.player.x, this.player.y, 30, 0xff6b3d, 0.28).setDepth(11).setScale(0.4);
    this.tweens.add({ targets: ring, scale: 1.7, alpha: 0, duration: 220, ease: 'Quad.out', onComplete: () => ring.destroy() });
  }

  // Abilità SCATTO OFFENSIVO: durante lo scatto, i nemici e il cerume attraversati vengono
  // colpiti (il giocatore è già invulnerabile mentre scatta, quindi ci passa attraverso).
  updateDashStrike(now) {
    if (now >= (this.dashUntil || 0)) return;
    const p = window.GameState.player;
    // Mentre carichi attraverso i nemici resti invulnerabile con un MARGINE oltre la fine
    // dello scatto: cosi' non subisci il loro danno da contatto mentre ti stacchi da loro.
    this.invulnUntil = Math.max(this.invulnUntil, now + 240);
    const pb = this.player.getBounds();
    this.enemies.getChildren().forEach((e) => {
      if (!e.active || e.spawning) return;
      if (Phaser.Geom.Intersects.RectangleToRectangle(pb, e.getBounds())) {
        if (!e._dashHitAt || now - e._dashHitAt > 300) { e._dashHitAt = now; this.damageEnemy(e, Math.round(p.damage * 0.9), true); }
      }
    });
    this.blocks.getChildren().forEach((b) => {
      if (b.active && Phaser.Geom.Intersects.RectangleToRectangle(pb, b.getBounds())) {
        // Stesso cooldown per-bersaglio dei nemici sopra: senza, un blocco (o piu' in fila)
        // prendeva danno a OGNI frame per tutta la durata dello scatto e spariva di colpo,
        // saltando l'animazione di cedimento/caduta della massa di cerume.
        if (!b._dashHitAt || now - b._dashHitAt > 300) { b._dashHitAt = now; this.damageBlock(b, p.damage); }
      }
    });
  }

  // Nemico attivo più vicino a (x,y) entro `range`, o null.
  nearestEnemyInRange(x, y, range) {
    let best = null, bd = range;
    this.enemies.getChildren().forEach((e) => {
      if (!e.active || e.spawning) return;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < bd) { bd = d; best = e; }
    });
    return best;
  }

  // L'aiutante spara una pallina verso il bersaglio (riusa il gruppo this.shots: colpisce
  // nemici e pulisce il cerume come il getto, ma con danno ridotto e senza perfora/scoppio).
  companionFire(c, target) {
    const p = window.GameState.player;
    const dx = target.x - c.x, dy = target.y - c.y;
    const d = Math.hypot(dx, dy) || 1;
    const nx = dx / d, ny = dy / d;
    const sp = 520;
    const s = this.shots.create(c.x + nx * 10, c.y + ny * 10, 'soap').setDepth(9).setScale(0.85);
    s.body.setAllowGravity(false);
    s.body.setSize(9, 9, true);
    s.setVelocity(nx * sp, ny * sp);
    s.dmg = Math.max(5, Math.round(p.jetDamage * 0.5));
    s.pierceLeft = 1;
    s.splash = false;
    s.homing = p.evoSwarm || false;   // EVOLUZIONE Sciame: anche le bolle sparano a ricerca
    s.bounceLeft = 0;
    window.Sfx.spray();
    this.time.delayedCall(900, () => { if (s.active) s.destroy(); });
    // piccolo "scatto" del compagno quando spara
    this.tweens.add({ targets: c, scale: c._baseScale * 0.82, duration: 60, yoyo: true });
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
    this.showMeleeWeapon(isHammer);         // arma in mano che rotea col colpo
    const baseRange = isHammer ? 64 : 50;
    const range = baseRange * p.attackRange;
    const halfH = isHammer ? 46 : 30;
    const cy = this.crouching ? 16 : 0;   // accovacciato: colpo più in basso (nemici bassi)
    const ax = this.facing > 0 ? this.player.x + 4 : this.player.x - range - 4;
    const rect = new Phaser.Geom.Rectangle(ax, this.player.y - halfH + cy, range, halfH * 2);
    // Abilità RABBIA: se armata (colpo subito di recente), QUESTO colpo fa piu' danno.
    const dmg = Math.round(p.damage * this.consumeRage());
    let hitEnemy = false, hitAny = false;
    this.blocks.getChildren().forEach((b) => {
      if (b.active && Phaser.Geom.Intersects.RectangleToRectangle(rect, b.getBounds())) { this.damageBlock(b, dmg); hitAny = true; }
    });
    const hitSet = new Set();
    this.enemies.getChildren().forEach((e) => {
      if (e.active && !e.spawning && Phaser.Geom.Intersects.RectangleToRectangle(rect, e.getBounds())) { this.damageEnemy(e, dmg, true); hitEnemy = true; hitAny = true; hitSet.add(e); }
    });
    // Abilità ONDA D'URTO: la bastonata colpisce ANCHE i nemici in un raggio attorno a te
    // (danno ridotto), non solo quelli davanti. Ottima contro i gruppi.
    if (p.meleeBlast) {
      const R = 84, bd = Math.max(6, Math.round(dmg * 0.55));
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

  // ---- LAYER ARMA: arma in mano durante l'attacco (intercambiabile via this.WEAPONS) ----
  // A distanza: la punta verso la direzione di mira (nx,ny). Resta visibile un attimo dopo
  // lo sparo (rinnovato a ogni colpo mentre spari).
  showRangedWeapon(nx, ny) {
    const cfg = this.WEAPONS.sprayer;
    const w = this.heroWeapon;
    this.tweens.killTweensOf(w);
    w.setTexture(cfg.tex).setOrigin(cfg.origin[0], cfg.origin[1]).setScale(cfg.scale).setVisible(true);
    this._weaponMode = 'ranged'; this._weaponCfg = cfg;
    this._weaponAim = Math.atan2(ny, nx); this._weaponFlip = nx < 0;
    this._weaponHideAt = this.time.now + 220;
    this.positionWeapon();
  }

  // Corpo a corpo: arma in mano che ROTEA nell'arco del colpo (swab o hammer).
  showMeleeWeapon(isHammer) {
    const cfg = isHammer ? this.WEAPONS.hammer : this.WEAPONS.swab;
    const w = this.heroWeapon;
    this.tweens.killTweensOf(w);
    // Abilità BRACCIO LUNGO (round 2, G.1): prima la portata extra era invisibile (allungava
    // solo il rettangolo di danno, non l'arma disegnata) — ora l'arma stessa si ingrandisce con
    // `p.attackRange`, smorzato a meta' (altrimenti dopo tante pescate diventerebbe assurda:
    // e' una carta "comune" ripescabile all'infinito).
    const reachScale = 1 + (window.GameState.player.attackRange - 1) * 0.5;
    w.setTexture(cfg.tex).setOrigin(cfg.origin[0], cfg.origin[1]).setScale(cfg.scale * reachScale).setVisible(true);
    this._weaponMode = 'melee'; this._weaponCfg = cfg; this._weaponFlip = this.facing < 0;
    this._weaponHideAt = this.time.now + 240;
    this.positionWeapon();
    // FlipX (non FlipY, il bug originale) per l'orientamento dei pixel + rotazione "π - θ"
    // (NON la semplice negazione -θ, che sposta l'arco anche in verticale — verificato con
    // getBounds(): solo π-θ da' un mirror pulito, stessa Y, X specchiata attorno al giocatore).
    w.setFlipX(this._weaponFlip);
    w.setFlipY(false);
    const mirror = (theta) => this._weaponFlip ? (Math.PI - theta) : theta;
    w.rotation = mirror(-1.1);                                  // parte alto-indietro
    this.tweens.add({ targets: w, rotation: mirror(0.7), duration: 150, ease: 'Quad.out' });  // fino a basso-avanti
  }

  // Posiziona l'arma alla mano (la segue ogni frame finche' visibile). L'angolo lo impostano
  // showRangedWeapon (mira) o il tween di showMeleeWeapon (arco); qui solo la posizione + mira.
  positionWeapon() {
    const w = this.heroWeapon; if (!w || !w.visible) return;
    const cfg = this._weaponCfg || this.WEAPONS.sprayer;
    const hx = cfg.hand[0] * (this.facing < 0 ? -1 : 1);
    w.setPosition(this.player.x + hx, this.player.y + cfg.hand[1]);
    if (this._weaponMode === 'ranged') { w.setFlipY(this._weaponFlip); w.setRotation(this._weaponAim); }
  }

  damageBlock(b, dmg) {
    b.hp -= dmg;
    this.wobbleWaxNear(b.x, b.y);   // ondeggio locale al punto colpito
    if (b.hp <= 0) {
      window.Sfx.smash();
      this.burst(b.bitKey, b.x, b.y, 14);
      this.splat(b.x, b.y, b.waxType);
      window.GameState.wax += Math.round(b.waxValue * (window.GameState.player.waxMult || 1) * (this.mutWaxMult || 1) * window.CONFIG.WAX_GAIN);   // Cerume Extra + mutatore + manopola globale
      this.cleanedWax = (this.cleanedWax || 0) + b.waxValue;   // per la % "pulito" (valore GREZZO, il moltiplicatore non conta)
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
  damageEnemy(e, dmg, heavy, dot) {
    // Guardia: un nemico gia' morto in questo stesso istante (es. due palline del ventaglio
    // che lo colpiscono nello stesso frame) non va rielaborato — altrimenti cerume/scossa/SPLIT
    // scatterebbero due volte per una sola morte.
    if (!e.active) return;
    // CROSTA = corazzata anti-getto: il GETTO (non heavy) la scalfisce appena e rimbalza
    // con un "clang"; solo il CORPO A CORPO (heavy) la abbatte come si deve. Il CORROSIVO (dot)
    // ignora l'armatura (il sapone la mangia) e non fa rinculo/pop (e' un danno "silenzioso").
    const armored = (e.kind === 'crust' && !heavy && !dot);
    if (armored) dmg = Math.max(2, Math.round(dmg * 0.3));   // il getto la scalfisce: poco ma visibile
    e.hp -= dmg;

    // Il FUGGITIVO DORATO ha una tinta permanente (firma visiva): il lampo del colpo la
    // sovrascrive, va ripristinata quando il lampo finisce, altrimenti tornerebbe del
    // colore normale per il resto dell'inseguimento.
    const restoreTint = () => { if (e.active) { e.clearTint(); if (e.fugitive) e.setTint(0xffd700); } };
    if (dot) {
      e.setTintFill(0x9be86b);   // lampo verde = corrosione
      this.time.delayedCall(70, restoreTint);
    } else {
      e.setTintFill(armored ? 0xbfe0ff : 0xffffff);
      this.time.delayedCall(armored ? 55 : (heavy ? 95 : 75), restoreTint);

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
    }
    if (e.hp <= 0) {
      window.Sfx.enemyDie();
      const pl = window.GameState.player;
      // Il cerume dei nemici ora si RACCOGLIE (pallina, come le pedane) invece di accreditarsi
      // da solo — l'economia passa quasi tutta da qui (F.1b). ECCEZIONE Fuggitivo Dorato:
      // ricompensa EVENTO, accredito istantaneo come prima (niente pallina da rincorrere).
      if (e.fugitive) window.GameState.wax += Math.round(e.waxValue * (pl.waxMult || 1) * (this.mutWaxMult || 1));
      else this.dropWaxPellet(e.x, e.y - 8, e.waxValue);
      // Abilità VITA RUBATA: uccidere cura un po' (piu' col boss).
      if (pl.lifesteal) {
        const heal = e.kind === 'boss' ? 25 : 3;
        pl.hp = Math.min(pl.maxHp, pl.hp + heal);
        this.healFx(this.player.x, this.player.y);
      }
      if (e.kind === 'boss') {
        this.cameras.main.shake(260, 0.014);
        this.burst(e.bitKey, e.x, e.y, 28);
        this.showBanner(window.I18n.t('game_boss_dead'), '#ffd166');
        this.addWaxPickup(e.x - 22, e.y - 8, true);
        this.addWaxPickup(e.x + 22, e.y - 8, true);
      } else {
        this.cameras.main.shake(110, 0.009);
        this.hitStop(85);
        this.burst(e.bitKey, e.x, e.y, 18);
        this.maybeSpeech('kill', 0.18);   // CARATTERE COMICO: commento occasionale (non su OGNI uccisione)
      }
      if (e.elite === 'boom') this.enemyExplode(e.x, e.y);   // ESPLOSIVO: scoppio ritardato ad area
      if (e.elite === 'split') this.spawnSplitChildren(e);   // SPLIT: si sdoppia sul posto
      if (e.fugitive) this.showBanner(window.I18n.t('event_goldfugitive_caught', { wax: e.waxValue }), '#ffd700');
      e.destroy();
    }
  }

  // SPLIT: alla morte, genera fino a 2 nemici piu' piccoli sul posto (mai a loro volta elite:
  // vedi il filtro opts.splitChild in spawnEnemy, che li esclude anche dal ri-sdoppiarsi).
  // Rispetta il tetto di nemici del livello: il genitore e' ancora "active" in questo istante,
  // va tolto dal conteggio per capire quanto spazio si libera.
  spawnSplitChildren(e) {
    const activeAfterParent = this.enemies.countActive(true) - 1;
    const room = Math.max(0, this.maxEnemies - activeAfterParent);
    const count = Math.min(2, room);
    for (let i = 0; i < count; i++) {
      const ox = (i === 0 ? -1 : 1) * Phaser.Math.Between(16, 26);
      this.spawnEnemy(e.kind, { splitChild: true, x: e.x + ox });
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
    if (near && now >= (e.atkReadyAt || 0) && e._grounded) {
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

  // IA della PULCE: a differenza del cerumino (un affondo telegrafato solo quando sei vicino),
  // la Pulce saltella SEMPRE verso il giocatore, un balzo BASSO e frequente dopo l'altro -
  // nessun telegrafo, non e' un'imboscata: e' solo fastidiosa e imprevedibile da colpire mentre
  // e' in aria. Riparte da terra appena atterra e il cooldown e' scaduto.
  fleaAI(e, now) {
    const dir = Math.sign(this.player.x - e.x) || (e.hopDir || 1);
    const onGround = e._grounded;
    if (onGround && now >= (e.hopReadyAt || 0)) {
      e.hopDir = dir;
      e.setVelocity(dir * e.speed * 2.2, -480);   // balzo ancora piu' alto (era -380, prima -260)
      e.hopReadyAt = now + 950;                    // invariato: l'aria in volo (~870ms) resta sotto al cooldown
    }
    e.setFlipX(dir < 0);
  }

  // IA del SALTATORE: stesso schema a stati del cerumino (carica telegrafata -> balzo ->
  // recupero) ma ESAGERATO - carica piu' lunga (piu' tempo per reagire, il balzo e' pericoloso),
  // balzo molto piu' alto/lungo (puo' scavalcarti o atterrarti sopra), e all'atterraggio una
  // piccola onda d'urto (danno se sei troppo vicino, oltre al contatto diretto).
  hopperAI(e, now) {
    const dx = this.player.x - e.x;
    const dir = Math.sign(dx) || (e.lungeDir || 1);

    if (e.atkState === 'windup') {
      e.setVelocityX(0);
      e.setTint((Math.floor(now / 90) % 2) ? 0xffb066 : 0xffffff);
      if (now >= e.windupUntil) {
        e.atkState = 'lunge';
        e.lungeUntil = now + 520;
        e.clearTint();
        if (e._baseScale) e.setScale(e._baseScale);
        e.setVelocity(e.lungeDir * (e.speed * 2.4 + 160), -420);
      }
      return;
    }
    if (e.atkState === 'lunge') {
      e.setFlipX(e.lungeDir < 0);
      // Atterrato per davvero (non nel primo istante del balzo, dove il corpo tocca ancora
      // terra per un frame): stesso accorgimento gia' usato altrove per l'accovacciamento.
      const landed = e._grounded && now - e.lungeStartAt > 200;
      if (now >= e.lungeUntil || landed) {
        e.atkState = 'idle';
        e.atkReadyAt = now + 900;
        e.setVelocityX(0);
        this.hopperLandFx(e.x, e.y);
      }
      return;
    }

    const near = Math.abs(dx) < 260 && Math.abs(this.player.y - e.y) < 90;
    if (near && now >= (e.atkReadyAt || 0) && e._grounded) {
      e.atkState = 'windup';
      e.windupUntil = now + 550;   // carica piu' lunga del cerumino: il balzo e' molto piu' grosso
      e.lungeDir = dir;
      e.lungeStartAt = now;
      e.setVelocityX(0);
      e.setTint(0xffb066);
      const bs = e._baseScale || (e._baseScale = e.scaleX);
      e.setScale(bs * 1.28, bs * 0.75);
      e.setFlipX(dir < 0);
      return;
    }
    e.setVelocityX(dir * e.speed);
    e.setFlipX(dir < 0);
  }

  // Onda d'urto all'atterraggio del Saltatore: danno ad area se sei troppo vicino (oltre
  // all'eventuale contatto diretto, gia' gestito centralmente per tutti i nemici).
  hopperLandFx(x, y) {
    const R = 60;
    const ring = this.add.circle(x, y, R, 0xff8a4a, 0.3).setDepth(11).setScale(0.3);
    this.tweens.add({ targets: ring, scale: 1, alpha: 0, duration: 260, ease: 'Quad.out', onComplete: () => ring.destroy() });
    this.cameras.main.shake(90, 0.006);
    if (Math.hypot(this.player.x - x, this.player.y - y) < R) {
      this.hurtPlayer(Math.round(6 + window.GameState.level * 1.5), x);
    }
  }

  // IA del BOSS (Tappo di Cerume): avanza lento e SPUTA con telegrafo (breve carica
  // lampeggiante prima del lancio), INTERCALATO a un "Balzo + schiacciata" a cooldown
  // (macchina a stati in e.bossAtk: null|'slamwind'|'slamjump'). A META' VITA si INFURIA:
  // sputo piu' frequente e a VENTAGLIO (3 vie), slam piu' frequente, evoca un cerumino ogni
  // tanto. Chiamato dal loop nemici.
  bossAI(e, now) {
    const dir = Math.sign(this.player.x - e.x) || 1;

    // Balzo+schiacciata IN CORSO: fermo/immobile durante il telegrafo, poi balza verso il
    // giocatore; niente avanzata "normale" ne' sputo finche' non e' finito (gate e.bossAtk).
    if (e.bossAtk === 'slamwind') {
      e.setVelocityX(0);
      e.setTint((Math.floor(now / 90) % 2) ? 0xff8a4a : 0xffffff);
      if (now >= e.slamWindupUntil) {
        e.clearTint();
        if (e._baseScale) e.setScale(e._baseScale);
        e.bossAtk = 'slamjump';
        e.slamStartAt = now;
        e.slamDir = dir;
        e.setFlipX(dir < 0);
        // Arco VERTICALE (round 2, D.1): salto alto (-600, apice ~164px, quasi il doppio del
        // vecchio -430 di appena 84px) che ATTERRA SUL giocatore invece di superarlo — la
        // velocita' orizzontale si calcola dalla distanza reale al bersaglio (non un
        // moltiplicatore fisso di e.speed) assumendo un volo simmetrico (stessa quota di
        // partenza/arrivo): T = 2*|vy|/g, vx = distanza/T. Clamp di sicurezza (non dovrebbe
        // mai servire, il raggio d'innesco e' comunque limitato).
        const SLAM_VY = 600;
        const flightT = (2 * SLAM_VY) / this.physics.world.gravity.y;
        const vx = Phaser.Math.Clamp((this.player.x - e.x) / flightT, -420, 420);
        e.setVelocity(vx, -SLAM_VY);
        e.slamApex = (SLAM_VY * SLAM_VY) / (2 * this.physics.world.gravity.y);   // per l'ombra sotto
        // VENDERE il salto: stiramento verticale, ma APPLICATO UN ATTIMO DOPO il decollo (~50ms),
        // NON sullo stesso frame del lancio. In questa build `setScale` ridimensiona anche il CORPO
        // fisico (vedi gotcha nota): ingrandirlo mentre il boss e' ancora appoggiato a terra fa
        // ri-separare il corpo dal suolo e ANNULLA la velocita' di salto — era la vera causa del
        // "boss ancorato a terra" (il fix D.1 del round 2 non funzionava davvero in gioco, il salto
        // veniva azzerato all'istante). Scoperto 2026-07-18. A terra il boss resta a scala normale
        // (ripristinata sopra, riga ~clearTint); lo stiramento parte quando e' gia' in aria.
        const bs = e._baseScale || (e._baseScale = e.scaleX);
        this.time.delayedCall(50, () => {
          if (!e.active || e.bossAtk !== 'slamjump') return;   // gia' atterrato / morto: niente stiramento
          e.setScale(bs * 0.9, bs * 1.2);
          this.tweens.add({ targets: e, scaleX: bs, scaleY: bs, duration: 200, ease: 'Quad.out' });
        });
        if (!e.slamShadow) {
          e.slamShadow = this.add.ellipse(e.x, this.groundTop, 70, 18, 0x000000, 0.35).setDepth(6);
        }
        e.slamShadow.setPosition(e.x, this.groundTop).setScale(1).setAlpha(0.35).setVisible(true);
      }
      return;
    }
    if (e.bossAtk === 'slamjump') {
      e.setFlipX(e.slamDir < 0);
      // Ombra a terra: segue orizzontalmente, si rimpicciolisce/schiarisce mentre sale (stessa
      // logica dell'altezza apice usata per calcolare la traiettoria, cosi' resta coerente).
      if (e.slamShadow) {
        const heightRatio = Phaser.Math.Clamp((this.groundTop - e.body.bottom) / (e.slamApex || 1), 0, 1);
        e.slamShadow.setPosition(e.x, this.groundTop);
        e.slamShadow.setScale(1 - heightRatio * 0.65);
        e.slamShadow.setAlpha(0.35 * (1 - heightRatio * 0.55));
      }
      // Atterrato per davvero (non nel primo istante del balzo, dove il corpo tocca ancora
      // terra per un frame): stesso accorgimento gia' usato per il Saltatore.
      const landed = e._grounded && now - e.slamStartAt > 250;
      if (landed) {
        e.bossAtk = null;
        e.setVelocityX(0);
        if (e.slamShadow) { e.slamShadow.destroy(); e.slamShadow = null; }
        this.bossSlamFx(e, e.x, e.y);
        e.slamReadyAt = now + (e._enraged ? 3000 : 4500);
      }
      return;
    }

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

    // Pronto + giocatore abbastanza vicino + boss a terra: parte il telegrafo dello slam.
    // Raggio allargato da 360 a 440 (round 2, D.1): con l'arco piu' verticale il boss deve
    // poter agganciare lo slam anche quando il giocatore lo tiene a distanza col getto.
    if (now >= (e.slamReadyAt || 0) && Math.abs(this.player.x - e.x) < 440 &&
        e._grounded) {
      e.bossAtk = 'slamwind';
      e.slamWindupUntil = now + 600;   // telegrafo lungo: e' pesante, si vede arrivare
      e.setVelocityX(0);
      e.setTint(0xff8a4a);
      const bs = e._baseScale || (e._baseScale = e.scaleX);
      e.setScale(bs * 1.22, bs * 0.72);   // si accovaccia
      return;
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

  // Onda d'urto all'atterraggio dello slam del boss: anello grosso + shake forte + danno ad
  // area al giocatore (se entro raggio) e al cerume vicino (stesso pattern di hopperLandFx,
  // ma piu' intenso: il boss e' molto piu' pesante del Saltatore).
  bossSlamFx(e, x, y) {
    const R = 100;
    const ring = this.add.circle(x, y, R, 0xff6b3d, 0.35).setDepth(12).setScale(0.3);
    this.tweens.add({ targets: ring, scale: 1, alpha: 0, duration: 320, ease: 'Quad.out', onComplete: () => ring.destroy() });
    window.Sfx.smash();
    this.cameras.main.shake(220, 0.014);
    if (Math.hypot(this.player.x - x, this.player.y - y) < R) {
      this.hurtPlayer(Math.round(e.contactDamage * 0.9), x);
    }
    this.blocks.getChildren().forEach((b) => {
      if (b.active && Math.hypot(b.x - x, b.y - y) < R) this.damageBlock(b, 20);
    });
  }

  // Onda d'urto dello SCHIANTO (Abilità del giocatore): stesso trattamento del boss (C.1), ma
  // dal giocatore verso i nemici — "impari dal boss" la stessa mossa. Danno ad area a nemici e
  // cerume vicini, niente danno al giocatore stesso ovviamente.
  playerSlamFx() {
    const p = window.GameState.player;
    const x = this.player.x, y = this.player.body.bottom;
    const R = 100;
    const dmg = Math.round(p.damage * 0.8);
    const ring = this.add.circle(x, y, R, 0xff6b3d, 0.35).setDepth(12).setScale(0.3);
    this.tweens.add({ targets: ring, scale: 1, alpha: 0, duration: 300, ease: 'Quad.out', onComplete: () => ring.destroy() });
    window.Sfx.smash();
    this.cameras.main.shake(180, 0.012);
    this.setJuice(1.32, 0.7);   // schiacciamento forte all'impatto (piu' dell'atterraggio normale)
    this.enemies.getChildren().forEach((e) => {
      if (e.active && !e.spawning && Math.hypot(e.x - x, e.y - y) < R) this.damageEnemy(e, dmg, true);
    });
    this.blocks.getChildren().forEach((b) => {
      if (b.active && Math.hypot(b.x - x, b.y - y) < R) this.damageBlock(b, Math.round(dmg * 0.6));
    });
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
    // Quota di volo tenuta SOTTO il soffitto locale (round 4) cosi' il moscerino non spinge
    // contro i collider del soffitto nei tratti bassi.
    const hoverY = Phaser.Math.Clamp(py - 150, this.ceilingYAt(e.x) + 40, this.groundTop - 110);

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
      this.shieldBreakFx(sourceX);
      if (this.shieldAura) this.shieldAura.setVisible(false);   // ora in ricarica: alone spento
      return;
    }
    this.invulnUntil = now + 900;
    window.GameState.player.hp -= dmg;
    if (pl.rage) this.rageReadyUntil = now + 4000;   // Abilità RABBIA: arma il prossimo attacco
    window.Sfx.hurt();
    this.cameras.main.shake(120, 0.01);
    // JUICE — colpo incassato: schiacciata netta (solo quando il danno e' REALMENTE applicato,
    // non se lo scudo para o si e' invulnerabili — quei casi escono prima, sopra).
    this.setJuice(1 + window.CONFIG.JUICE_HIT, 1 - window.CONFIG.JUICE_HIT);
    this.maybeSpeech('hit', 0.35);   // CARATTERE COMICO: reazione occasionale al colpo
    const dir = Math.sign(this.player.x - sourceX) || 1;
    this.player.setVelocity(dir * 240, -260);
    this.tweens.add({ targets: this.player, alpha: 0.3, duration: 90, yoyo: true, repeat: 4 });
    if (window.GameState.player.hp <= 0) {
      // Abilità SECONDA VITA: sopravvivi a un colpo mortale, UNA SOLA VOLTA per l'intera run.
      if (pl.secondLife && !pl.secondLifeUsed) {
        pl.secondLifeUsed = true;
        pl.hp = Math.max(1, Math.round(pl.maxHp * 0.35));
        this.invulnUntil = now + 1300;
        this.secondLifeFx();
        return;
      }
      window.GameState.player.hp = 0;
      this.gameOver();
    }
  }

  // Effetto SECONDA VITA: esplosione dorata + lampo, per far capire che sei "risorto".
  secondLifeFx() {
    const x = this.player.x, y = this.player.y;
    window.Sfx.smash();
    const ring = this.add.circle(x, y, 24, 0xffe08a, 0).setStrokeStyle(5, 0xffd166, 1).setDepth(23);
    this.tweens.add({ targets: ring, scale: 3.4, alpha: 0, duration: 480, ease: 'Quad.out', onComplete: () => ring.destroy() });
    const flash = this.add.circle(x, y, 34, 0xffffff, 0.8).setDepth(23);
    this.tweens.add({ targets: flash, scale: 2, alpha: 0, duration: 300, ease: 'Quad.out', onComplete: () => flash.destroy() });
    this.heroVisual.setTintFill(0xffe08a);
    this.time.delayedCall(140, () => { if (this.heroVisual && this.heroVisual.active) this.heroVisual.clearTint(); });
    this.cameras.main.shake(220, 0.012);
    this.showBanner(window.I18n.t('game_second_life'), '#ffd166');
  }

  // Effetto "vita rubata": un lampo verde che sale dal giocatore.
  healFx(x, y) {
    const c = this.add.circle(x, y - 10, 7, 0x6bd66b, 0.9).setDepth(21);
    this.tweens.add({ targets: c, y: y - 40, alpha: 0, scale: 1.6, duration: 420, ease: 'Quad.out', onComplete: () => c.destroy() });
  }

  // Alone permanente dello scudo: una bolla azzurra attorno al giocatore, VISIBILE solo
  // quando lo scudo è CARICO (pronto a parare). Sparisce durante la ricarica → così si
  // capisce sempre a colpo d'occhio se sei protetto o no. Chiamato ogni frame in update().
  updateShieldAura(now) {
    const pl = window.GameState.player;
    if (!pl.shield) { if (this.shieldAura) this.shieldAura.setVisible(false); return; }
    if (!this.shieldAura) {
      this.shieldAura = this.add.circle(this.player.x, this.player.y, 24, 0x8fd0ff, 0.12)
        .setStrokeStyle(2.5, 0xbfe8ff, 0.9).setDepth(9);   // dietro il PG (depth 10): alone, non lo copre
    }
    const charged = now >= (this.shieldReadyAt || 0);
    this.shieldAura.setVisible(charged);
    if (charged) {
      this.shieldAura.x = this.player.x;
      this.shieldAura.y = this.player.y;
      this.shieldAura.setScale(1 + Math.sin(now / 180) * 0.06);   // pulsazione leggera = "vivo"
    }
  }

  // Effetto di ROTTURA scudo (quando para un colpo): flash bianco + anello brillante +
  // schegge che schizzano + lampo sul personaggio + scossa. Molto più evidente di prima.
  shieldBreakFx(sourceX) {
    const x = this.player.x, y = this.player.y;
    const flash = this.add.circle(x, y, 30, 0xffffff, 0.85).setDepth(22);
    this.tweens.add({ targets: flash, scale: 2.2, alpha: 0, duration: 260, ease: 'Quad.out', onComplete: () => flash.destroy() });
    const ring = this.add.circle(x, y, 22, 0x8fd0ff, 0).setStrokeStyle(4, 0xbfe8ff, 1).setDepth(22);
    this.tweens.add({ targets: ring, scale: 3, alpha: 0, duration: 380, ease: 'Quad.out', onComplete: () => ring.destroy() });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const sh = this.add.circle(x, y, 3, 0xbfe8ff, 1).setDepth(22);
      this.tweens.add({ targets: sh, x: x + Math.cos(a) * 46, y: y + Math.sin(a) * 46, alpha: 0, duration: 320, ease: 'Quad.out', onComplete: () => sh.destroy() });
    }
    this.heroVisual.setTintFill(0xffffff);                  // lampo bianco pieno sul PG
    this.time.delayedCall(90, () => { if (this.heroVisual && this.heroVisual.active) this.heroVisual.clearTint(); });
    this.cameras.main.shake(120, 0.008);
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
    if (this.quakeTimer) { this.quakeTimer.remove(false); this.quakeTimer = null; }
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
    if (this.quakeTimer) { this.quakeTimer.remove(false); this.quakeTimer = null; }

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

  // Timer grande e centrato (round 2, F.1/F.2a): condiviso da Assedio e Corsa (prima l'assedio
  // aveva solo `siegeText`, 20px poco leggibile, e la corsa non aveva nessun timer). Negli
  // ultimi 5s LAMPEGGIA (colore acceso + pulsazione) per segnalare che sta per scadere.
  buildBigTimer() {
    this.bigTimerText = this.add.text(window.CONFIG.WIDTH / 2, 92, '', {
      fontFamily: 'monospace', fontSize: '38px', color: '#ffd9a0', stroke: '#14161f', strokeThickness: 6,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(100);
  }

  // `text` = stringa gia' formattata (i18n) da mostrare; `secondsLeft` guida SOLO il lampeggio.
  updateBigTimer(text, secondsLeft, now) {
    if (!this.bigTimerText) return;
    this.bigTimerText.setText(text);
    if (secondsLeft <= 5) {
      const blink = Math.floor(now / 200) % 2 === 0;
      this.bigTimerText.setColor(blink ? '#ff4040' : '#ffd9a0');
      this.bigTimerText.setScale(blink ? 1.18 : 1);
    } else {
      this.bigTimerText.setColor('#ffd9a0');
      this.bigTimerText.setScale(1);
    }
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

  // JUICE — imposta jx/jy SOLO se lo spostamento richiesto e' piu' marcato di quello gia' in
  // corso (per ampiezza, |1-jx|+|1-jy|), invece di sovrascrivere sempre l'ultimo arrivato.
  // Altrimenti un salto "bufferizzato" che scatta esattamente sul frame dell'atterraggio
  // cancellerebbe del tutto lo schiacciamento dell'atterraggio (capita nei bunny-hop veloci).
  setJuice(ax, ay) {
    const newAmp = Math.abs(1 - ax) + Math.abs(1 - ay);
    const curAmp = Math.abs(1 - this.jx) + Math.abs(1 - this.jy);
    if (newAmp >= curAmp) { this.jx = ax; this.jy = ay; }
  }

  update(time) {
    window.GameGfx.updateBackground(this);   // parallax: scorre gli strati di sfondo
    this.animateWax(time);                    // cerume "fluido": ondeggia e cola
    if (this.locked) { this.player.setVelocityX(0); return; }
    const p = window.GameState.player;
    const k = this.keys;
    const now = time;

    // ASSEDIO: si vince SOPRAVVIVENDO fino allo scadere del cronometro (niente timpano).
    if (this.levelKind === 'siege') {
      const left = Math.max(0, Math.ceil((this.siegeEndAt - now) / 1000));
      this.updateBigTimer(window.I18n.t('hud_siege', { s: left }), left, now);
      if (now >= this.siegeEndAt) { this.levelComplete(); return; }
    } else if (this.levelKind === 'rush') {
      // CORSA A TEMPO (round 2, F.1): se il tempo scade PRIMA del timpano -> game over (deciso
      // con l'utente). Il controllo `player.x < goalX` evita che, nel caso limite in cui tempo
      // scaduto e traguardo raggiunto capitino nello stesso frame, si perda una corsa in realta'
      // vinta (il blocco "Traguardo" qui sotto la completerebbe comunque, se lo lasciamo passare).
      const left = Math.max(0, Math.ceil((this.rushEndAt - now) / 1000));
      this.updateBigTimer(window.I18n.t('hud_rush', { s: left }), left, now);
      if (now >= this.rushEndAt && this.player.x < this.goalX) { this.gameOver(); return; }
    }

    // Traguardo: bisogna PULIRE almeno la soglia di cerume E raggiungere il timpano.
    // Nei livelli boss il timpano resta "sbarrato" finche' il Tappo di Cerume e' vivo.
    if (this.levelKind !== 'siege' && this.player.x >= this.goalX) {
      // Confronto sulle PERCENTUALI ARROTONDATE (le stesse mostrate nell'HUD): così se l'HUD
      // segna "80%" e la soglia e' 80%, basta — niente 79,8% che sembra 80 ma non completa.
      const cleanPct = this.totalWax ? Math.round((this.cleanedWax / this.totalWax) * 100) : 100;
      const goalPct = Math.round(this.cleanGoal * 100);
      const bossBlocking = this.levelKind === 'boss' &&
        this.enemies.getChildren().some((e) => e.active && e.kind === 'boss');
      if (cleanPct < goalPct) {
        this.cleanHint(now);                       // sei al timpano ma manca cerume da pulire
      } else if (bossBlocking) {
        if (!this._bossHintShown) { this._bossHintShown = true; this.showBanner(window.I18n.t('game_boss_guard'), '#ffb04a'); }
      } else {
        this.levelComplete(); return;
      }
    }

    // TERRENO A "MAPPA DI ALTEZZE" (prototipo round 4): il PG cammina sul profilo `terrainTopAt`
    // (colline dolci) agganciando i piedi alla superficie frame per frame → camminata liscia su/giu'
    // senza blocchi fisici (niente cuciture che incastrano). NON aggancia mentre SALE in un salto
    // (vy<0), ne' se la superficie e' molto piu' in basso (dirupo/salto) → li' cade. I dislivelli
    // sono limitati a pendenze dolci (vedi buildTerrain), quindi il cap di salita non si vede.
    let onGround = this.player.body.blocked.down || this.player.body.touching.down;   // backstop/pedane
    const surfaceY = this.terrainTopAt(this.player.x);
    const feetY = this.player.body.bottom;
    if (this.player.body.velocity.y >= -1 && (feetY - surfaceY) >= -44) {
      // sposto SOLO il corpo in verticale (non lo sprite → l'orizzontale resta al motore);
      // sali max 26/frame, scendi max 44/frame (per entrare/uscire dalle cunette).
      this.player.body.y -= Phaser.Math.Clamp(feetY - surfaceY, -44, 26);
      this.player.body.velocity.y = 0;
      onGround = true;
    }

    // JUICE — atterraggio: si rileva il passaggio aria->terra, ma solo se si era DAVVERO in aria
    // da un po' (confronto con `this.lastGroundAt`, letto PRIMA che il rifornimento salti qui
    // sotto lo aggiorni). Necessario perche' Arcade Physics risolve gravita'+collisione ogni
    // frame: da fermo `onGround` sfarfalla vero/falso in continuazione (un frame gravita' stacca
    // di un pelo, il frame dopo il collider rincolla) — lo stesso motivo per cui piu' sotto
    // l'accovacciamento usa gia' `lastGroundAt` invece di `onGround` nudo. Senza il filtro,
    // ogni sfarfallio farebbe scattare uno schiacciamento anche da fermi.
    const landed = onGround && !this._wasOnGround && (now - this.lastGroundAt) > 60;
    this._wasOnGround = onGround;
    if (landed) {
      const impact = Phaser.Math.Clamp(this._prevVelY / p.jumpVelocity, 0, 1.4);
      const a = window.CONFIG.JUICE_LAND * (0.5 + 0.5 * impact);
      this.setJuice(1 + a, 1 - a);
      // Abilità SCHIANTO: se stavi cadendo veloce per lo schianto, l'onda d'urto scatta qui,
      // esattamente all'atterraggio (non prima: deve colpire quando tocchi terra).
      if (this.slamming) { this.slamming = false; this.playerSlamFx(); }
    }

    // Rifornisci i salti SOLO quando sei davvero appoggiato e non stai già salendo: subito
    // dopo un salto il corpo "tocca" ancora il suolo per un frame e, senza questo controllo,
    // bastava ripremere in fretta per ottenere un salto in più (falso doppio salto).
    if (onGround && this.player.body.velocity.y >= 0) { this.jumpsLeft = p.doubleJump ? 2 : 1; this.lastGroundAt = now; }

    // Gocce dal soffitto: emettitori che si gonfiano e rilasciano gocce che cadono. Il danno
    // al contatto e' gestito dall'overlap player/movers in create(); lo splash a terra qui.
    this.updateDrips(now);
    this.updateCollapseChunks();
    // Pozze di cerume scivoloso: rallentano il movimento mentre ci si cammina sopra a terra.
    const onSlime = onGround && this.slimeZones && this.slimeZones.some(
      (z) => this.player.x > z.x1 && this.player.x < z.x2);

    // BUCHE (round 4): stando A TERRA dentro una buca si prende danno periodico → si supera SALTANDO
    // (in aria = sopra la buca = salvo). Nessun contraccolpo (srcX = player.x) per non spingerlo in giro.
    if (onGround && this.pitZones && this.pitZones.some((z) => this.player.x > z.x1 && this.player.x < z.x2)
        && now >= (this._pitHurtAt || 0)) {
      this._pitHurtAt = now + 500;
      this.hurtPlayer(8 + Math.floor(window.GameState.level / 3), this.player.x);
    }

    // Abilità CALAMITA: i bonus di cerume vicini volano verso il giocatore (raccolta a distanza).
    // EVOLUZIONE Buco Nero (evoMagnet): raggio molto più ampio.
    if (p.magnet && this.pickups) {
      const R = p.evoMagnet ? 320 : 170;
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
    // Abilità SCHIANTO: in aria, premere GIU' di fresco (non tenuto: altrimenti mirare in giù
    // in volo lo farebbe scattare da solo) ti fa cadere veloce; l'onda d'urto parte quando
    // atterri (vedi il blocco 'landed' piu' sopra). "_slamPrevDown" rileva il fronte di
    // pressione sullo stesso downHeld gia' unificato tastiera/touch.
    if (p.slam && !onGround && downHeld && !this._slamPrevDown && !this.slamming) {
      this.slamming = true;
      this.player.setVelocityY(Math.max(this.player.body.velocity.y, 0) + 900);
      window.Sfx.dash();
    }
    this._slamPrevDown = downHeld;
    // L'accovacciamento resta valido per un attimo dopo aver perso il contatto col suolo
    // (dossi/bordi mentre ci si muove), COSI' il getto non passa a "mira in giù" sparando
    // nel pavimento. NON vale durante un vero salto (velocità decisa verso l'alto).
    this.crouching = downHeld && (onGround ||
      ((now - this.lastGroundAt) < 140 && this.player.body.velocity.y > -50));

    // Movimento (tastiera o pad a schermo); accovacciato ci si muove piano. La velocita' REALE
    // insegue quella bersaglio con un'accelerazione/decelerazione morbida (a terra piu'
    // reattiva, in aria piu' "molle"), invece di scattare istantanea: toglie il "legnoso" senza
    // diventare scivoloso. Lo SCATTO resta istantaneo (salta l'inseguimento apposta).
    const left = k.A.isDown || k.LEFT.isDown || this.touch.left;
    const right = k.D.isDown || k.RIGHT.isDown || this.touch.right;
    let targetVx = 0;
    if (left) { targetVx = -p.moveSpeed; this.facing = -1; }
    else if (right) { targetVx = p.moveSpeed; this.facing = 1; }
    if (this.crouching) targetVx *= 0.45;
    if (onSlime) targetVx *= 0.5;
    if (now < this.dashUntil) {
      this.player.setVelocityX(this.facing * p.moveSpeed * 2.4);
      this.spawnDashGhost(p.dashStrike);   // scia: azzurra normale, arancio se fa danno
    } else {
      const accel = onGround ? window.CONFIG.MOVE_ACCEL_GROUND : window.CONFIG.MOVE_ACCEL_AIR;
      this.player.setVelocityX(Phaser.Math.Linear(this.player.body.velocity.x, targetVx, accel));
    }

    // JUICE — inversione di corsa: piccola schiacciata quando cambi direzione a terra in movimento.
    if (onGround && this.facing !== this._lastFacing && Math.abs(this.player.body.velocity.x) > 10) {
      this.setJuice(1 + window.CONFIG.JUICE_TURN, 1 - window.CONFIG.JUICE_TURN);
    }
    this._lastFacing = this.facing;

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
      // JUICE — salto: allungamento (alto/sottile) al decollo.
      this.setJuice(1 - window.CONFIG.JUICE_JUMP, 1 + window.CONFIG.JUICE_JUMP);
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
      if (p.dashStrike) this.dashStrikeFx();   // lampo arancio: questo scatto fa danno
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

    // Animazione (sul "vestito" this.heroVisual; la fisica resta sul player invisibile)
    this.heroVisual.setFlipX(this.facing < 0);
    const _vx = Math.abs(this.player.body.velocity.x);
    if (!onGround) {
      this.heroVisual.anims.play('hero_jump_a', true);
    } else if (_vx > 10) {
      const key = (_vx > p.moveSpeed * 0.85) ? 'hero_run_a' : 'hero_walk_a';
      this.heroVisual.anims.play(key, true);
    } else {
      this.heroVisual.anims.play('hero_idle_a', true);
    }

    // IA nemici + danno da contatto
    const pb = this.player.getBounds();
    this.enemies.getChildren().forEach((e) => {
      if (!e.active) return;
      if (e.eliteAura) { e.eliteAura.x = e.x; e.eliteAura.y = e.y; }   // l'aura élite segue il nemico
      if (e.spawning) return;   // mentre emerge/cala è inerte: niente IA, sputi o danno

      // TERRENO (round 4): i nemici A TERRA camminano sul profilo `terrainTopAt` come il PG
      // (heightmap-snap: aggancio i piedi alla superficie). I VOLANTI no. `e._grounded` sostituisce
      // `blocked.down` nei controlli "a terra" dell'IA (che qui sopra le colline sarebbe falso).
      if (e.kind === 'fly') {
        e._grounded = e.body.blocked.down || e.body.touching.down;
      } else {
        const surf = this.terrainTopAt(e.x);
        // aggancio se NON sta salendo in un salto (vy >= -30: esclude affondi/balzi -190/-480/…) e i
        // piedi sono entro il range dalla superficie (i balzi grandi hanno i piedi ben piu' in alto → passano).
        if (e.body.velocity.y >= -30 && (e.body.bottom - surf) >= -44) {
          e.body.y -= Phaser.Math.Clamp(e.body.bottom - surf, -44, 22);
          if (e.body.velocity.y > 0) e.body.velocity.y = 0;
          e._grounded = true;
        } else {
          e._grounded = e.body.blocked.down || e.body.touching.down;
        }
      }

      // Sapone corrosivo: danno-nel-tempo ad intervalli finché la corrosione è attiva.
      if (e.corrodeUntil && now < e.corrodeUntil && now >= (e.corrodeNext || 0)) {
        e.corrodeNext = now + 350;
        this.damageEnemy(e, e.corrodeDmg || 2, false, true);
        if (!e.active) return;   // può morire dalla corrosione
      }

      // Nemico rimasto troppo indietro (oltre una membrana gia' superata): non potra'
      // piu' raggiungere il giocatore, lo rimuoviamo cosi' lo spawner ne crea di nuovi
      // nella sezione attuale. Boss, guardiani e il fuggitivo (gestisce da solo il proprio
      // esaurimento in fugitiveAI, con banner "scappato") sono esenti.
      if (!e.guard && !e.fugitive && e.kind !== 'boss' && (this.player.x - e.x) > this.cameras.main.width * 1.3) {
        e.destroy();
        return;
      }

      if (now >= e.knockUntil && now < (e.stunnedUntil || 0)) {
        e.setVelocityX(0);   // Abilità GETTO STORDENTE: fermo, niente IA finche' dura lo stordimento
      } else if (now >= e.knockUntil) {
        if (e.fugitive) {
          this.fugitiveAI(e, now);   // ignora tutto il resto: corre sempre verso il timpano
        } else if (e.kind === 'boss') {
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
        } else if (e.kind === 'flea') {
          this.fleaAI(e, now);     // Pulce: saltella di continuo verso il giocatore
        } else if (e.kind === 'hopper') {
          this.hopperAI(e, now);   // Saltatore: balzo enorme telegrafato + onda d'urto
        } else {
          // Cerumino (blob): cammina + AFFONDO telegrafato.
          this.groundEnemyAI(e, now);
        }
      }

      if (!e.fugitive && Phaser.Geom.Intersects.RectangleToRectangle(e.getBounds(), pb)) {
        this.hurtPlayer(e.contactDamage, e.x);
      }
    });

    if (this.companions.length) this.updateCompanions(now);
    if (p.homing) this.updateHomingShots(now);
    if (p.dashStrike) this.updateDashStrike(now);
    this.updateShieldAura(now);

    // JUICE — molla: i moltiplicatori di scala tornano verso 1 ogni frame (rimbalzo morbido).
    // Applicata qui, a fine update(): DOPO ogni possibile trigger di questo stesso frame
    // (atterraggio/inversione/salto sopra, ma anche il contatto coi nemici appena elaborato
    // sopra), cosi' nessun evento resta con un frame di ritardo prima di vedersi.
    this.jx += (1 - this.jx) * window.CONFIG.JUICE_SPRING;
    this.jy += (1 - this.jy) * window.CONFIG.JUICE_SPRING;
    // Posa accovacciata (segnaposto in attesa di un frame dedicato) + juice procedurale.
    this.player.setScale(1.5 * this.jx, (this.crouching ? 1.02 : 1.5) * this.jy);
    // Il "vestito" animato segue il player (piedi = fondo del corpo fisico) e riceve il juice.
    this.heroVisual.setPosition(this.player.x, this.player.body.bottom);
    this.heroVisual.setScale(this.HERO_SCALE * this.jx, this.HERO_SCALE * this.jy);
    // Arma in mano (layer): segue la mano finche' visibile, poi si nasconde a fine attacco.
    if (this.heroWeapon.visible) {
      if (this.time.now > this._weaponHideAt) this.heroWeapon.setVisible(false);
      else this.positionWeapon();
    }

    // JUICE — salva la velocita' verticale di QUESTO frame: al prossimo frame, se si atterra,
    // e' la velocita' di caduta appena prima che il pavimento la azzeri (misura l'impatto).
    this._prevVelY = this.player.body.velocity.y;

    this.updateHud();
  }
}
window.GameScene = GameScene;
