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
    this.invulnUntil = 0;
    this.dashReady = 0;
    this.dashUntil = 0;
    this.jumpsLeft = 1;

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
    this.physics.world.setBounds(0, 0, this.worldW, H);

    this.drawBackground();

    // Pavimento del condotto (lungo tutto il mondo)
    const gh = window.CONFIG.GROUND_H;
    this.ground = this.add.rectangle(this.worldW / 2, H - gh / 2, this.worldW, gh, C.ground).setDepth(4);
    this.add.rectangle(this.worldW / 2, H - gh, this.worldW, 5, C.groundDark).setDepth(4);
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
    const notFlyer = (e) => e.kind !== 'fly';
    this.physics.add.collider(this.enemies, this.ground, null, notFlyer);
    this.physics.add.collider(this.enemies, this.blocks, null, notFlyer);
    this.physics.add.collider(this.enemies, this.platforms, null, notFlyer);

    // Le palline sputate feriscono il giocatore e si spappolano contro muro/pavimento.
    this.physics.add.overlap(this.player, this.projectiles, (pl, proj) => {
      this.hurtPlayer(proj.dmg, proj.x);
      this.popProjectile(proj);
    });
    this.physics.add.collider(this.projectiles, this.blocks, (proj) => this.popProjectile(proj));
    this.physics.add.collider(this.projectiles, this.platforms, (proj) => this.popProjectile(proj));
    this.physics.add.collider(this.projectiles, this.ground, (proj) => this.popProjectile(proj));

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

    // Su PC (mouse, niente touch): clic per attaccare. Su mobile usa il
    // pulsante dedicato, così toccare il pad direzionale non fa attaccare.
    if (!this.touch.enabled) {
      this.input.on('pointerdown', () => {
        window.Sfx.unlock();
        if (!this.locked) this.tryAttack();
      });
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

    this.membraneXs = [];
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0 : i / (count - 1);
      const mx = Math.round(firstX + span * t);
      this.membraneXs.push(mx);
      this.buildMembrane(mx, lvl, i);
    }
    this.buildPlatforms();
    this.buildGoal();

    this.totalBlocks = this.blocks.countActive(true);
    this.blocksLeft = this.totalBlocks;
    this.drawWax();
  }

  // Una membrana di cerume: una colonna di blocchi dal pavimento verso l'alto che
  // sbarra il corridoio. Per proseguire bisogna sfondarne un varco (di solito in basso).
  buildMembrane(mx, lvl, idx) {
    const B = window.CONFIG.BLOCK;
    const H = window.CONFIG.HEIGHT;
    const groundTop = this.groundTop;

    const thick = (lvl >= 4 && idx % 2 === 1) ? 2 : 1;    // qualche membrana piu' spessa
    const fullRows = Math.floor((H - 90) / B);            // dal pavimento quasi al soffitto
    const topGap = Math.random() < 0.45 ? Phaser.Math.Between(1, 2) : 0;  // a volte aperta in alto
    const rows = Math.max(3, fullRows - topGap);
    const baseCol = Math.round(mx / B);

    for (let tcol = 0; tcol < thick; tcol++) {
      const col = baseCol + tcol;
      const x = col * B + B / 2;
      for (let r = 0; r < rows; r++) {
        const y = groundTop - r * B - B / 2;

        // Base sporca, qualche blocco duro piu' in alto col crescere del livello.
        let type = 'soft';
        if (r === 0) type = 'dirt';
        else if (lvl >= 2 && (r + col) % 4 === 0) type = 'hard';

        let key, hp, bitKey, wax;
        if (type === 'hard') { key = 'block_hard'; hp = 60 + lvl * 10; bitKey = 'bit_hard'; wax = 6; }
        else if (type === 'dirt') { key = 'block_dirt'; hp = 40 + lvl * 7; bitKey = 'bit_dirt'; wax = 4; }
        else { key = 'block_soft'; hp = 26 + lvl * 5; bitKey = 'bit_wax'; wax = 3; }

        const b = this.blocks.create(x, y, key).setDepth(5).setVisible(false);
        b.hp = hp; b.maxHp = hp; b.bitKey = bitKey; b.waxValue = wax;
        b.col = col; b.row = r; b.waxType = type;
        b.dripLen = Math.random() < 0.55 ? Phaser.Math.Between(8, 20) : 0;
        b.refreshBody();
      }
    }
  }

  // Pedane sospese tra le membrane, per saltare e dare verticalita'.
  buildPlatforms() {
    const xs = this.membraneXs;
    for (let i = 0; i < xs.length - 1; i++) {
      if (Math.random() < 0.35) continue;          // non in ogni intervallo
      const midX = Math.round((xs[i] + xs[i + 1]) / 2);
      const py = this.groundTop - Phaser.Math.Between(110, 200);
      this.addPlatform(midX, py, Phaser.Math.Between(90, 150));
    }
    // Una anche poco prima della prima membrana, come "rampa" iniziale.
    this.addPlatform(Math.max(220, xs[0] - 240), this.groundTop - Phaser.Math.Between(110, 160), 120);
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
    const C = window.CONFIG.COLORS;
    const H = window.CONFIG.HEIGHT;
    const gh = window.CONFIG.GROUND_H;
    this.goalX = this.worldW - 150;
    const cx = this.goalX + 40;
    const cy = (H - gh) * 0.5;
    const ah = (H - gh) * 0.92;

    this.add.ellipse(cx, cy, 150, ah, C.eardrum, 0.5).setDepth(2);
    this.add.ellipse(cx, cy, 112, ah * 0.78, 0xf3b2ad, 0.5).setDepth(2);
    const core = this.add.ellipse(cx, cy, 72, ah * 0.55, 0xfbe2bf, 0.55).setDepth(3);
    this.tweens.add({ targets: core, scaleX: 1.15, scaleY: 1.08, alpha: 0.82, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

    // Indizio "vai a destra" che fluttua davanti al timpano.
    const arrow = this.add.text(this.goalX - 70, cy, '>>', {
      fontFamily: 'monospace', fontSize: '40px', color: '#fff7e8', stroke: '#14161f', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(7).setAlpha(0.85);
    this.tweens.add({ targets: arrow, x: this.goalX - 36, alpha: 0.3, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  }

  // Disegna il muro come UN'UNICA massa di cerume gommosa e lucida, sovrapponendo
  // blob arrotondati ai blocchi (cosi i bordi si fondono e non si vede piu il reticolo).
  // Richiamata a ogni colpo per "erodere" la massa col muro.
  drawWax() {
    const g = this.waxGfx;
    if (!g) return;
    const C = window.CONFIG.COLORS;
    const B = window.CONFIG.BLOCK;
    g.clear();
    const blocks = this.blocks.getChildren().filter((b) => b.active);
    if (!blocks.length) return;

    const occ = new Set(blocks.map((b) => b.col + ',' + b.row));
    const has = (col, row) => occ.has(col + ',' + row);
    const PAL = {
      soft: [C.waxSoft, C.waxSoftLight, C.waxSoftDark],
      hard: [C.waxHard, C.waxHardLight, C.waxHardDark],
      dirt: [C.dirt, C.dirtLight, C.dirtDark],
    };

    // 1) Ombra/base: blob scuri spostati in basso, danno spessore alla massa.
    blocks.forEach((b) => {
      g.fillStyle(PAL[b.waxType][2], 1);
      g.fillCircle(b.x + 2, b.y + 4, B * 0.80);
    });

    // 2) Gocce che colano dagli sporti (blocco senza nulla sotto).
    blocks.forEach((b) => {
      if (b.row > 0 && !has(b.col, b.row - 1) && b.dripLen > 0) {
        const x = b.x, y0 = b.y + B * 0.40, len = b.dripLen, w = 5;
        g.fillStyle(PAL[b.waxType][2], 1);
        g.fillRect(x - w / 2, y0, w, len);
        g.fillCircle(x, y0 + len, w * 0.9);
        g.fillStyle(PAL[b.waxType][0], 1);
        g.fillRect(x - w / 2 + 1, y0, w - 2, len * 0.7);
      }
    });

    // 3) Corpo principale a colore pieno; piu scuro dove e danneggiato ("livido").
    blocks.forEach((b) => {
      g.fillStyle(PAL[b.waxType][0], 1);
      g.fillCircle(b.x, b.y, B * 0.76);
    });
    blocks.forEach((b) => {
      const t = Phaser.Math.Clamp(b.hp / b.maxHp, 0, 1);
      if (t < 0.98) {
        g.fillStyle(PAL[b.waxType][2], (1 - t) * 0.55);
        g.fillCircle(b.x, b.y, B * 0.70);
      }
    });

    // 4) Riflessi lucidi: bordo superiore e faccia esposta + puntini speculari.
    blocks.forEach((b) => {
      const light = PAL[b.waxType][1];
      if (!has(b.col, b.row + 1)) {           // niente blocco sopra = cresta
        g.fillStyle(light, 0.6);
        g.fillEllipse(b.x - 4, b.y - B * 0.34, B * 0.70, B * 0.34);
      }
      if (!has(b.col + 1, b.row)) {            // niente blocco a sinistra = faccia verso il giocatore
        g.fillStyle(light, 0.28);
        g.fillEllipse(b.x - B * 0.32, b.y, B * 0.26, B * 0.62);
      }
    });
    blocks.forEach((b) => {
      if (!has(b.col, b.row + 1) && !has(b.col + 1, b.row)) {
        g.fillStyle(0xffffff, 0.5);
        g.fillCircle(b.x - B * 0.22, b.y - B * 0.26, 2.6);
      }
    });
  }

  // Piccolo "splat" di feedback quando un pezzo di cerume si stacca.
  splat(x, y, type) {
    const C = window.CONFIG.COLORS;
    const col = { soft: C.waxSoftLight, hard: C.waxHardLight, dirt: C.dirtLight }[type] || C.waxSoftLight;
    const ring = this.add.circle(x, y, 6, col, 0.7).setDepth(7);
    this.tweens.add({ targets: ring, scale: 3.4, alpha: 0, duration: 260, ease: 'Quad.out', onComplete: () => ring.destroy() });
  }

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

  spawnEnemy(kind) {
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
      x = Phaser.Math.Clamp(this.player.x + Phaser.Math.Between(-220, 260), 60, this.worldW - 60);
      y = -24;                                   // parte sopra lo schermo
    } else if (cfg.boss) {
      x = Phaser.Math.Clamp(this.player.x + 380, 400, this.worldW - 240);  // davanti, verso il timpano
      y = restY;                                 // a livello del pavimento
    } else {
      x = this.pickGroundX();
      y = restY;
    }

    const e = this.enemies.create(x, y, cfg.tex).setDepth(cfg.boss ? 9 : 8);
    e.kind = kind;
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
  }

  // Sceglie un punto di spawn a terra appena FUORI dalla visuale, di solito davanti
  // al giocatore (verso il timpano), così i nemici "popolano" il corridoio mentre avanzi.
  pickGroundX() {
    const camW = this.cameras.main.width;
    const margin = camW * 0.5 + 60;
    const ahead = Math.random() < 0.7 ? 1 : -1;
    let x = Phaser.Math.Clamp(this.player.x + ahead * Phaser.Math.Between(margin, margin + 240), 60, this.worldW - 60);
    // Evita di farli sbucare dentro una membrana (resterebbero incastrati nei blocchi).
    for (const mx of (this.membraneXs || [])) {
      if (Math.abs(x - mx) < 60) { x = Phaser.Math.Clamp(mx + 90 * ahead, 60, this.worldW - 60); break; }
    }
    return x;
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

  // Sbuffo di terriccio/cerume quando qualcosa emerge dal pavimento.
  groundPuff(x, groundTop, big) {
    this.burst('bit_dirt', x, groundTop - 4, big ? 18 : 9);
    const C = window.CONFIG.COLORS;
    const mound = this.add.ellipse(x, groundTop - 2, big ? 70 : 44, big ? 26 : 16, C.dirtDark, 0.8).setDepth(7);
    this.tweens.add({ targets: mound, scaleX: 1.6, scaleY: 0.2, alpha: 0, duration: 360, ease: 'Quad.out', onComplete: () => mound.destroy() });
  }

  // Filo di cerume che cola dal soffitto sopra al volante mentre scende.
  ceilingDrip(x, restY) {
    const C = window.CONFIG.COLORS;
    const strand = this.add.rectangle(x, 0, 5, restY + 20, C.waxSoftDark, 0.85).setOrigin(0.5, 0).setDepth(7);
    const blob = this.add.circle(x, 6, 6, C.waxSoft, 0.9).setDepth(7);
    this.tweens.add({ targets: [strand], scaleY: 0, alpha: 0, duration: 540, ease: 'Quad.in', onComplete: () => strand.destroy() });
    this.tweens.add({ targets: [blob], y: 0, scale: 0, alpha: 0, duration: 300, onComplete: () => blob.destroy() });
  }

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

  // Cartello a schermo per annunciare i livelli speciali (boss / sciame).
  showBanner(text, color) {
    const W = window.CONFIG.WIDTH;
    const t = this.add.text(W / 2, 120, text, {
      fontFamily: 'monospace', fontSize: '24px', color: color || '#ffd166',
      stroke: '#14161f', strokeThickness: 5, align: 'center',
    }).setOrigin(0.5).setDepth(120).setScrollFactor(0).setAlpha(0);
    this.tweens.add({
      targets: t, alpha: 1, y: 100, duration: 300, ease: 'Back.out',
      onComplete: () => this.tweens.add({ targets: t, alpha: 0, delay: 1700, duration: 600, onComplete: () => t.destroy() }),
    });
  }

  // ---------- Combattimento ----------

  tryAttack() {
    const now = this.time.now;
    const p = window.GameState.player;
    if (now - this.lastAttack < p.attackCooldown) return;
    this.lastAttack = now;
    window.Sfx.hit();

    const isHammer = p.weapon === 'hammer';
    const baseRange = isHammer ? 64 : 50;
    const range = baseRange * p.attackRange;
    const halfH = isHammer ? 46 : 30;
    const ax = this.facing > 0 ? this.player.x + 4 : this.player.x - range - 4;
    const rect = new Phaser.Geom.Rectangle(ax, this.player.y - halfH, range, halfH * 2);

    this.showWeaponSwing(this.facing, isHammer);

    this.blocks.getChildren().forEach((b) => {
      if (b.active && Phaser.Geom.Intersects.RectangleToRectangle(rect, b.getBounds())) {
        this.damageBlock(b, p.damage);
      }
    });
    this.enemies.getChildren().forEach((e) => {
      if (e.active && Phaser.Geom.Intersects.RectangleToRectangle(rect, e.getBounds())) {
        this.damageEnemy(e, p.damage);
      }
    });
  }

  showWeaponSwing(facing, isHammer) {
    const key = isHammer ? 'hammer' : 'swab';
    const w = this.add.sprite(this.player.x + facing * 20, this.player.y - (isHammer ? 6 : 2), key);
    w.setDepth(20);
    w.setFlipX(facing < 0);
    w.setOrigin(facing > 0 ? 0.05 : 0.95, 0.5);
    const fromAngle = facing > 0 ? -70 : 70;
    const toAngle = facing > 0 ? 45 : -45;
    w.angle = fromAngle;
    this.tweens.add({
      targets: w, angle: toAngle, duration: 130, ease: 'Quad.out',
      onComplete: () => this.tweens.add({ targets: w, alpha: 0, duration: 90, onComplete: () => w.destroy() }),
    });
  }

  damageBlock(b, dmg) {
    b.hp -= dmg;
    if (b.hp <= 0) {
      window.Sfx.smash();
      this.burst(b.bitKey, b.x, b.y, 14);
      this.splat(b.x, b.y, b.waxType);
      window.GameState.wax += b.waxValue;
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

  burst(key, x, y, n) {
    const e = this.add.particles(x, y, key, {
      speed: { min: 60, max: 210 }, angle: { min: 0, max: 360 },
      lifespan: 450, scale: { start: 1, end: 0 }, gravityY: 520, emitting: false,
    });
    e.setDepth(15);
    e.explode(n, x, y);
    this.time.delayedCall(700, () => e.destroy());
  }

  // ---------- Esiti del livello ----------

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
    const pct = this.goalX ? Phaser.Math.Clamp(Math.round((this.player.x / this.goalX) * 100), 0, 100) : 0;
    this.blockText.setText(T.t('hud_goal', { pct: pct }));
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

  drawBackground() {
    const WW = this.worldW, H = window.CONFIG.HEIGHT, C = window.CONFIG.COLORS;
    const g = this.add.graphics().setDepth(-10);

    // Il timpano (luce) e' in fondo a destra: il condotto schiarisce mentre avanzi.
    const cx = WW - 220, cy = H * 0.46;

    // Parete scura del condotto (base, per tutta la lunghezza del mondo).
    g.fillStyle(0x5e3528, 1);
    g.fillRect(0, 0, WW, H);

    // Gradiente "a tunnel": ellissi concentriche dal buio (ingresso, sinistra) alla
    // luce calda in fondo (timpano, destra). La piu' grande copre tutto il mondo.
    const cols = [0x6e3f30, 0x7c4736, 0x8d5340, 0xa5654b, 0xbb7657, 0xd08c67, 0xe2a578, 0xf0c293, 0xf8d8b0];
    const n = cols.length;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);                       // 0 = esterno/buio, 1 = interno/luce
      const rx = (WW * 1.08) * (1 - t) + 130 * t;
      const ry = (H * 1.15) * (1 - t) + 50 * t;
      g.fillStyle(cols[i], 1);
      g.fillEllipse(cx, cy, rx, ry);
    }

    // Anelli di profondita del condotto (sottili e scuri).
    g.lineStyle(6, 0x4f2c20, 0.12);
    for (let i = 1; i <= 6; i++) g.strokeEllipse(cx, cy, WW * 0.16 * i, H * 0.22 * i);

    // Pieghe carnose lungo i bordi, ripetute per tutta la lunghezza.
    g.fillStyle(0x5a3322, 0.14);
    for (let x = 120; x < WW; x += 280) {
      g.fillEllipse(x, 64, 360, 70);
      g.fillEllipse(x + 140, H - 64, 360, 70);
    }

    // Alone luminoso del timpano che "respira".
    this.bgGlow = this.add.ellipse(cx, cy, 240, H * 0.5, 0xfbe2bf, 0.22).setDepth(-9);
    this.tweens.add({
      targets: this.bgGlow, scaleX: 1.16, scaleY: 1.16, alpha: 0.34,
      duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.inOut',
    });
  }

  // ---------- Loop ----------

  update(time) {
    if (this.locked) { this.player.setVelocityX(0); return; }
    const p = window.GameState.player;
    const k = this.keys;
    const now = time;

    // Traguardo: raggiunto il timpano in fondo al condotto = livello completato.
    if (this.player.x >= this.goalX) { this.levelComplete(); return; }

    const onGround = this.player.body.blocked.down || this.player.body.touching.down;
    if (onGround) this.jumpsLeft = p.doubleJump ? 2 : 1;

    // Movimento (tastiera o pad a schermo)
    const left = k.A.isDown || k.LEFT.isDown || this.touch.left;
    const right = k.D.isDown || k.RIGHT.isDown || this.touch.right;
    let vx = 0;
    if (left) { vx = -p.moveSpeed; this.facing = -1; }
    else if (right) { vx = p.moveSpeed; this.facing = 1; }
    if (now < this.dashUntil) vx = this.facing * p.moveSpeed * 2.4;
    this.player.setVelocityX(vx);

    // Salto (con doppio salto)
    const jumpPressed =
      Phaser.Input.Keyboard.JustDown(k.W) ||
      Phaser.Input.Keyboard.JustDown(k.SPACE) ||
      Phaser.Input.Keyboard.JustDown(k.UP) ||
      this.touch.jumpQueued;
    this.touch.jumpQueued = false;
    if (jumpPressed && this.jumpsLeft > 0) {
      this.player.setVelocityY(-p.jumpVelocity);
      this.jumpsLeft--;
      window.Sfx.jump();
    }

    // Scatto
    const dashPressed = Phaser.Input.Keyboard.JustDown(k.SHIFT) || this.touch.dashQueued;
    this.touch.dashQueued = false;
    if (p.dash && dashPressed && now > this.dashReady) {
      this.dashUntil = now + 160;
      this.dashReady = now + 700;
      this.invulnUntil = Math.max(this.invulnUntil, now + 160);
      window.Sfx.dash();
    }

    // Attacco
    if (Phaser.Input.Keyboard.JustDown(k.J) || this.touch.attackQueued) { window.Sfx.unlock(); this.tryAttack(); }
    this.touch.attackQueued = false;

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
