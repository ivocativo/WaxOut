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
    const hitWax = (a, b) => {
      const sh = this.shots.contains(a) ? a : b, bl = (sh === a) ? b : a;
      this.damageBlock(bl, sh.dmg); this.popShot(sh);
    };
    const hitFoe = (a, b) => {
      const sh = this.shots.contains(a) ? a : b, en = (sh === a) ? b : a;
      if (en.spawning) return;
      this.damageEnemy(en, sh.dmg); this.popShot(sh);
    };
    const hitSolid = (a, b) => this.popShot(this.shots.contains(a) ? a : b);
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

    // Disegno del cerume come massa unica gommosa (sopra i blocchi, che restano invisibili).
    this.waxGfx = this.add.graphics().setDepth(6);

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
    this.buildGoal();
    window.GameGfx.drawProtuberances(this);   // scenografia organica (pavimento + soffitto)

    this.totalBlocks = this.blocks.countActive(true);
    this.blocksLeft = this.totalBlocks;
    // Cerume totale del livello (per la percentuale "pulito" — vedi HUD).
    this.totalWax = 0;
    this.blocks.getChildren().forEach((b) => { if (b.active) this.totalWax += b.waxValue; });
    this.cleanedWax = 0;
    this.drawWax();
  }

  // Una membrana di cerume: una colonna di blocchi dal pavimento verso l'alto che
  // sbarra il corridoio. Tipo 'full' = alta, da sfondare (varco in basso); tipo
  // 'short' = bassa, scavalcabile con un salto (o sfondabile, ha pochi HP).
  buildMembrane(mx, lvl, idx, type) {
    const B = window.CONFIG.BLOCK;
    const groundTop = this.groundTop;

    let rows, thick;
    if (type === 'short') {
      rows = Phaser.Math.Between(2, 3);                   // scavalcabile con un salto
      thick = 1;
    } else {
      thick = (lvl >= 5) ? 2 : 1;                         // ai livelli alti qualcuna piu' spessa
      // Dal pavimento quasi al soffitto: l'altezza e' relativa al CANALE (groundTop),
      // non all'intero schermo, cosi' non sfonda il soffitto col pavimento piu' alto.
      const fullRows = Math.floor((groundTop - 16) / B);
      const topGap = Math.random() < 0.4 ? Phaser.Math.Between(1, 2) : 0;
      rows = Math.max(3, fullRows - topGap);
    }
    const baseCol = Math.round(mx / B);

    for (let tcol = 0; tcol < thick; tcol++) {
      const col = baseCol + tcol;
      const x = col * B + B / 2;
      for (let r = 0; r < rows; r++) {
        const y = groundTop - r * B - B / 2;

        // Base sporca, qualche blocco duro piu' in alto (solo sulle membrane piene).
        let bt = 'soft';
        if (r === 0) bt = 'dirt';
        else if (type === 'full' && lvl >= 2 && (r + col) % 4 === 0) bt = 'hard';

        let key, hp, bitKey, wax;
        if (bt === 'hard') { key = 'block_hard'; hp = 60 + lvl * 10; bitKey = 'bit_hard'; wax = 6; }
        else if (bt === 'dirt') { key = 'block_dirt'; hp = 40 + lvl * 7; bitKey = 'bit_dirt'; wax = 4; }
        else { key = 'block_soft'; hp = 26 + lvl * 5; bitKey = 'bit_wax'; wax = 3; }

        const b = this.blocks.create(x, y, key).setDepth(5).setVisible(false);
        b.hp = hp; b.maxHp = hp; b.bitKey = bitKey; b.waxValue = wax;
        b.col = col; b.row = r; b.waxType = bt;
        b.dripLen = Math.random() < 0.55 ? Phaser.Math.Between(8, 20) : 0;
        b.refreshBody();
      }
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
      for (let c = 0; c < span; c++) this.addWaxBlock(baseCol + c, topRow - d, lvl, 'soft');
    }
  }

  // Pedane sospese: una "rampa" davanti a ogni membrana bassa (per scavalcarla con un
  // salto) + qualche pedana piu' in alto tra le membrane, a volte con un bonus di cerume.
  buildPlatforms() {
    this.membranes.forEach((m) => {
      if (m.type !== 'short') return;
      const px = Math.max(200, m.x - 110);
      const py = this.groundTop - Phaser.Math.Between(72, 96);
      this.addPlatform(px, py, 110);
    });

    const xs = this.membraneXs;
    for (let i = 0; i < xs.length - 1; i++) {
      if (Math.random() < 0.45) continue;          // non in ogni intervallo
      const midX = Math.round((xs[i] + xs[i + 1]) / 2);
      const py = this.groundTop - Phaser.Math.Between(150, 215);
      this.addPlatform(midX, py, Phaser.Math.Between(90, 130));
      if (Math.random() < 0.6) this.addWaxPickup(midX, py - 26);
    }
    // Rampa d'avvio prima della prima membrana.
    this.addPlatform(Math.max(200, xs[0] - 240), this.groundTop - Phaser.Math.Between(110, 150), 120);
  }

  // Pallina di cerume da raccogliere (premia chi sale sulle pedane). Ondeggia leggera.
  addWaxPickup(x, y) {
    const p = this.pickups.create(x, y, 'wax_glob').setDepth(7);
    p.body.setAllowGravity(false);
    p.body.setSize(14, 14, true);
    p.waxValue = 5;
    this.tweens.add({ targets: p, y: y - 6, yoyo: true, repeat: -1, duration: 750, ease: 'Sine.inOut' });
  }

  grabPickup(pk) {
    if (!pk || !pk.active) return;
    window.GameState.wax += pk.waxValue;
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

  // Disegno del muro di cerume e splat di feedback: vedi GameGfx in src/gfx.js.
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
  spitAt(e) {
    const g = window.CONFIG.GRAVITY;
    const dir = Math.sign(this.player.x - e.x) || 1;
    const sx = e.x + dir * 12, sy = e.y - 6;
    const dx = this.player.x - sx;
    const dy = (this.player.y - 8) - sy;
    const dist = Math.hypot(dx, dy);
    const T = Phaser.Math.Clamp(dist / 260, 0.5, 1.0);  // tempo di volo stimato
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
    const sp = 580;
    const s = this.shots.create(this.player.x + nx * 18, this.player.y - 6 + ny * 14, 'soap').setDepth(9);
    s.body.setAllowGravity(false);
    s.body.setSize(10, 10, true);
    s.setVelocity(nx * sp, ny * sp);
    s.dmg = p.jetDamage;
    // Lampo alla "bocca" del getto (feedback visivo di sparo).
    const flash = this.add.circle(this.player.x + nx * 20, this.player.y - 6 + ny * 20, 7, 0xdff3ff, 0.9).setDepth(11);
    this.tweens.add({ targets: flash, scale: 0.2, alpha: 0, duration: 120, ease: 'Quad.out', onComplete: () => flash.destroy() });
    window.Sfx.spray();
    this.time.delayedCall(850, () => { if (s.active) s.destroy(); });
  }

  popShot(s) {
    if (!s || !s.active) return;
    this.splat(s.x, s.y, 'soft');
    s.destroy();
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

  // Bastonata verso il nemico vicino (rispetta la cadenza dell'arma corpo a corpo).
  doMelee(now, foe) {
    const p = window.GameState.player;
    if (now - this.lastAttack < p.attackCooldown) return;
    this.lastAttack = now;
    this.facing = Math.sign(foe.x - this.player.x) || this.facing;
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
    const ax = this.facing > 0 ? this.player.x + 4 : this.player.x - range - 4;
    const rect = new Phaser.Geom.Rectangle(ax, this.player.y - halfH, range, halfH * 2);
    this.showWeaponSwing(this.facing, isHammer);
    let hitEnemy = false, hitAny = false;
    this.blocks.getChildren().forEach((b) => {
      if (b.active && Phaser.Geom.Intersects.RectangleToRectangle(rect, b.getBounds())) { this.damageBlock(b, p.damage); hitAny = true; }
    });
    this.enemies.getChildren().forEach((e) => {
      if (e.active && !e.spawning && Phaser.Geom.Intersects.RectangleToRectangle(rect, e.getBounds())) { this.damageEnemy(e, p.damage); hitEnemy = true; hitAny = true; }
    });
    // IMPATTO: quando la mazzata CONNETTE, micro-pausa (hit-stop) + tremolio -> peso.
    // Piu' forte sui nemici e col martello; leggero sul solo cerume.
    if (hitAny) {
      this.cameras.main.shake(hitEnemy ? 90 : 55, hitEnemy ? 0.006 : 0.0035);
      this.hitStop(isHammer ? 70 : (hitEnemy ? 55 : 32));
    }
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
    if (b.hp <= 0) {
      window.Sfx.smash();
      this.burst(b.bitKey, b.x, b.y, 14);
      this.splat(b.x, b.y, b.waxType);
      window.GameState.wax += b.waxValue;
      this.cleanedWax = (this.cleanedWax || 0) + b.waxValue;   // per la % "pulito"
      b.destroy();
      this.blocksLeft = this.blocks.countActive(true);
      this.drawWax();
    } else {
      window.Sfx.crack();
      this.burst(b.bitKey, b.x, b.y, 3);
      this.drawWax();
    }
  }

  damageEnemy(e, dmg) {
    e.hp -= dmg;
    e.setTintFill(0xffffff);
    this.time.delayedCall(70, () => { if (e.active) e.clearTint(); });
    const dir = Math.sign(e.x - this.player.x) || 1;
    // Il Boss è massiccio: subisce molta meno spinta degli altri.
    const kbX = e.kind === 'boss' ? 70 : 190;
    const kbY = e.kind === 'boss' ? -60 : -150;
    e.setVelocity(dir * kbX, kbY);
    e.knockUntil = this.time.now + 200;
    if (e.hp <= 0) {
      window.Sfx.enemyDie();
      window.GameState.wax += e.waxValue;
      if (e.kind === 'boss') {
        this.cameras.main.shake(260, 0.014);
        this.burst(e.bitKey, e.x, e.y, 28);
        this.showBanner(window.I18n.t('game_boss_dead', { wax: e.waxValue }), '#ffd166');
      } else {
        this.cameras.main.shake(80, 0.006);
        this.hitStop(60);
        this.burst(e.bitKey, e.x, e.y, 14);
      }
      e.destroy();
    }
  }

  hurtPlayer(dmg, sourceX) {
    const now = this.time.now;
    if (now < this.invulnUntil || this.locked) return;
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
    const x = 18, y = 40, w = 200, h = 18;
    this.hudG.clear();
    this.hudG.fillStyle(0x000000, 0.5); this.hudG.fillRect(x - 2, y - 2, w + 4, h + 4);
    this.hudG.fillStyle(0x3a2a1a, 1); this.hudG.fillRect(x, y, w, h);
    const ratio = Phaser.Math.Clamp(p.hp / p.maxHp, 0, 1);
    const col = ratio > 0.5 ? 0x4caf50 : (ratio > 0.25 ? 0xe0a020 : 0xe74c3c);
    this.hudG.fillStyle(col, 1); this.hudG.fillRect(x, y, w * ratio, h);

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

    // Movimento (tastiera o pad a schermo)
    const left = k.A.isDown || k.LEFT.isDown || this.touch.left;
    const right = k.D.isDown || k.RIGHT.isDown || this.touch.right;
    let vx = 0;
    if (left) { vx = -p.moveSpeed; this.facing = -1; }
    else if (right) { vx = p.moveSpeed; this.facing = 1; }
    if (now < this.dashUntil) vx = this.facing * p.moveSpeed * 2.4;
    this.player.setVelocityX(vx);

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

    // Attacco UNICO e "intelligente" (tieni premuto: J / pulsante Spruzza / clic).
    // Se un nemico e' a distanza ravvicinata parte la BASTONATA (coton fioc) al posto
    // del getto; altrimenti spara il getto (pulisce il cerume e colpisce da lontano).
    const attackHeld = k.J.isDown || this.touch.sprayHeld || this.pcFiring;
    if (attackHeld) {
      window.Sfx.unlock();
      const foe = this.meleeTargetNear();
      if (foe) this.doMelee(now, foe);
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

      // Sputatori (Gorgogliante e Boss): lanciano una pallina ogni tanto.
      if (e.nextSpit !== undefined && now >= e.nextSpit && now >= e.knockUntil) {
        this.spitAt(e);
        e.nextSpit = now + e.spitEvery;
      }

      if (now >= e.knockUntil) {
        if (e.kind === 'fly') {
          // Volante: punta il giocatore in linea d'aria (leggermente sopra la sua testa).
          const dx = this.player.x - e.x;
          const dy = (this.player.y - 14) - e.y;
          const d = Math.hypot(dx, dy) || 1;
          e.setVelocity((dx / d) * e.speed, (dy / d) * e.speed);
          e.setFlipX(dx < 0);
        } else if (e.guard && Math.abs(this.player.x - e.homeX) > e.guardRange) {
          // Guardiano in attesa: il giocatore e' lontano, resta a presidiare la membrana.
          if (Math.abs(e.homeX - e.x) > 8) e.setVelocityX(Math.sign(e.homeX - e.x) * e.speed * 0.5);
          else e.setVelocityX(0);
          e.setFlipX(this.player.x < e.x);
        } else {
          // A terra: cammina verso il giocatore.
          const dir = Math.sign(this.player.x - e.x);
          e.setVelocityX(dir * e.speed);
          e.setFlipX(dir < 0);
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
