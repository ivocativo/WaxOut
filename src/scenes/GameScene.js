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

    this.physics.world.setBounds(0, 0, W, H);

    this.drawBackground();

    // Pavimento del condotto
    const gh = window.CONFIG.GROUND_H;
    this.ground = this.add.rectangle(W / 2, H - gh / 2, W, gh, C.ground).setDepth(4);
    this.add.rectangle(W / 2, H - gh, W, 5, C.groundDark).setDepth(4);
    this.physics.add.existing(this.ground, true);

    // Gruppi
    this.blocks = this.physics.add.staticGroup();
    this.enemies = this.physics.add.group();

    this.buildWall();

    // Giocatore
    this.player = this.physics.add.sprite(80, H - gh - 60, 'player_a').setDepth(10);
    this.player.body.setSize(18, 40, true);
    this.player.setCollideWorldBounds(true);
    this.physics.add.collider(this.player, this.ground);
    this.physics.add.collider(this.player, this.blocks);

    this.physics.add.collider(this.enemies, this.ground);
    this.physics.add.collider(this.enemies, this.blocks);

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

    // Nemici iniziali + spawner periodico
    const lvl = window.GameState.level;
    this.maxEnemies = Math.min(2 + lvl, 6);
    for (let i = 0; i < Math.min(2, this.maxEnemies); i++) this.spawnEnemy();
    this.spawnTimer = this.time.addEvent({
      delay: Math.max(1500, 2800 - lvl * 150), loop: true,
      callback: () => { if (!this.locked && this.enemies.countActive(true) < this.maxEnemies) this.spawnEnemy(); },
    });

    this.buildHud();

    // Pausa: tasti ESC/P + pulsante a schermo (in alto a destra)
    this.input.keyboard.on('keydown-ESC', () => this.pauseGame());
    this.input.keyboard.on('keydown-P', () => this.pauseGame());
    this.buildPauseButton();

    // Suggerimento abilita di questo livello
    if (window.GameState.ownedAbilities.length > 0) {
      const txt = 'Abilita: ' + window.GameState.ownedAbilities.join(', ');
      const t = this.add.text(W / 2, H - gh - 8, txt, {
        fontFamily: 'monospace', fontSize: '13px', color: '#fff7e8',
        stroke: '#14161f', strokeThickness: 3,
      }).setOrigin(0.5, 1).setDepth(40).setScrollFactor(0);
      this.tweens.add({ targets: t, alpha: 0, delay: 2500, duration: 800, onComplete: () => t.destroy() });
    }
  }

  // ---------- Costruzione livello ----------

  buildWall() {
    const C = window.CONFIG.COLORS;
    const B = window.CONFIG.BLOCK;
    const W = window.CONFIG.WIDTH;
    const H = window.CONFIG.HEIGHT;
    const gh = window.CONFIG.GROUND_H;
    const lvl = window.GameState.level;

    const cols = Math.min(4 + Math.ceil(lvl / 2), 7);
    const rows = Math.min(4 + Math.floor(lvl / 3), 6);
    const rightX = W - 24 - B / 2;
    const groundTop = H - gh;

    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const x = rightX - c * B;
        const y = groundTop - r * B - B / 2;

        let type = 'soft';
        if (r === 0) type = 'dirt';                          // base sporca
        else if ((r + c) % 4 === 0 && lvl >= 2) type = 'hard';
        else if (Math.random() < lvl * 0.05) type = 'hard';

        let key, hp, bitKey, wax;
        if (type === 'hard') { key = 'block_hard'; hp = 70 + lvl * 12; bitKey = 'bit_hard'; wax = 6; }
        else if (type === 'dirt') { key = 'block_dirt'; hp = 50 + lvl * 8; bitKey = 'bit_dirt'; wax = 4; }
        else { key = 'block_soft'; hp = 30 + lvl * 6; bitKey = 'bit_wax'; wax = 3; }

        const b = this.blocks.create(x, y, key).setDepth(5);
        b.hp = hp; b.maxHp = hp; b.bitKey = bitKey; b.waxValue = wax;
        b.refreshBody();
      }
    }
    this.totalBlocks = this.blocks.countActive(true);
    this.blocksLeft = this.totalBlocks;
  }

  spawnEnemy() {
    const C = window.CONFIG.COLORS;
    const H = window.CONFIG.HEIGHT;
    const gh = window.CONFIG.GROUND_H;
    const lvl = window.GameState.level;
    const isCrust = lvl >= 2 && Math.random() < 0.3;
    const key = isCrust ? 'enemy_crust' : 'enemy_blob';
    const x = Phaser.Math.Between(40, 140);
    const y = H - gh - 70;

    const e = this.enemies.create(x, y, key).setDepth(8);
    e.setCollideWorldBounds(true);
    e.setBounce(0.1);
    e.body.setSize(26, 22, true);
    e.hp = isCrust ? 60 + lvl * 6 : 30 + lvl * 4;
    e.maxHp = e.hp;
    e.speed = isCrust ? 46 : 72 + lvl * 3;
    e.contactDamage = (isCrust ? 16 : 11) + lvl * 2;
    e.waxValue = isCrust ? 8 : 5;
    e.bitKey = isCrust ? 'bit_dirt' : 'bit_wax';
    e.knockUntil = 0;

    // comparsa
    e.setScale(0.2);
    this.tweens.add({ targets: e, scaleX: 1, scaleY: 1, duration: 250, ease: 'Back.out' });
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
    this.tweens.add({ targets: b, scaleX: 1.16, scaleY: 0.85, duration: 60, yoyo: true });
    if (b.hp <= 0) {
      window.Sfx.smash();
      this.burst(b.bitKey, b.x, b.y, 12);
      window.GameState.wax += b.waxValue;
      b.destroy();
      this.blocksLeft = this.blocks.countActive(true);
      if (this.blocksLeft === 0) this.levelComplete();
    } else {
      window.Sfx.crack();
      this.burst(b.bitKey, b.x, b.y, 3);
      const t = Phaser.Math.Clamp(b.hp / b.maxHp, 0, 1);
      const col = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.IntegerToColor(0x6b4a1f),
        Phaser.Display.Color.IntegerToColor(0xffffff), 100, Math.floor(t * 100));
      b.setTint(Phaser.Display.Color.GetColor(col.r, col.g, col.b));
    }
  }

  damageEnemy(e, dmg) {
    e.hp -= dmg;
    e.setTintFill(0xffffff);
    this.time.delayedCall(70, () => { if (e.active) e.clearTint(); });
    const dir = Math.sign(e.x - this.player.x) || 1;
    e.setVelocity(dir * 190, -150);
    e.knockUntil = this.time.now + 200;
    if (e.hp <= 0) {
      window.Sfx.enemyDie();
      this.burst(e.bitKey, e.x, e.y, 14);
      window.GameState.wax += e.waxValue;
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
    this.add.text(W / 2, H / 2 - 20, 'LIVELLO ' + window.GameState.level + ' COMPLETATO!', {
      fontFamily: 'monospace', fontSize: '34px', color: '#ffd166',
      stroke: '#14161f', strokeThickness: 6, align: 'center',
    }).setOrigin(0.5).setDepth(51).setScrollFactor(0);
    this.add.text(W / 2, H / 2 + 26, 'Muro di cerume sfondato!', {
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
    this.add.text(W / 2, H / 2 - 56, 'SOPRAFFATTO DAL CERUME', {
      fontFamily: 'monospace', fontSize: '30px', color: '#e74c3c',
      stroke: '#14161f', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(51).setScrollFactor(0);
    this.add.text(W / 2, H / 2 - 14, 'Run terminata al livello ' + lvl, {
      fontFamily: 'monospace', fontSize: '18px', color: '#fff7e8',
      stroke: '#14161f', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(51).setScrollFactor(0);
    this.add.text(W / 2, H / 2 + 16, 'Cerume incassato: +' + earned + '   (in banca: ' + meta.bank + ')', {
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
    mkButton(W / 2 - 175, 'NUOVA RUN', () => { window.GameState.reset(); this.scene.start('GameScene'); });
    mkButton(W / 2, 'NEGOZIO', () => { window.GameState.reset(); this.scene.start('ShopScene'); });
    mkButton(W / 2 + 175, 'MENU', () => { window.GameState.reset(); this.scene.start('MenuScene'); });

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

    this.hpText.setText('HP ' + Math.ceil(p.hp) + '/' + p.maxHp);
    this.levelText.setText('Livello ' + window.GameState.level);
    this.blockText.setText('Muro: ' + this.blocksLeft + '/' + this.totalBlocks);
    this.waxText.setText('Cerume: ' + window.GameState.wax);
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
    const W = window.CONFIG.WIDTH, H = window.CONFIG.HEIGHT, C = window.CONFIG.COLORS;
    const g = this.add.graphics().setDepth(-10);
    const steps = 24;
    for (let i = 0; i < steps; i++) {
      const col = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.IntegerToColor(C.bgTop),
        Phaser.Display.Color.IntegerToColor(C.bgBottom), steps - 1, i);
      g.fillStyle(Phaser.Display.Color.GetColor(col.r, col.g, col.b), 1);
      g.fillRect(0, Math.floor(i / steps * H), W, Math.ceil(H / steps) + 1);
    }
    // pieghe del condotto
    g.fillStyle(C.canalShade, 0.15);
    for (let i = 0; i < 6; i++) g.fillEllipse(W * 0.4, 80 + i * 90, W * 1.1, 70);
    // accenno di timpano sullo sfondo a destra
    g.fillStyle(C.eardrum, 0.35);
    g.fillEllipse(W - 60, H * 0.5, 180, 360);
  }

  // ---------- Loop ----------

  update(time) {
    if (this.locked) { this.player.setVelocityX(0); return; }
    const p = window.GameState.player;
    const k = this.keys;
    const now = time;

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
      if (now >= e.knockUntil) {
        const dir = Math.sign(this.player.x - e.x);
        e.setVelocityX(dir * e.speed);
        e.setFlipX(dir < 0);
      }
      if (Phaser.Geom.Intersects.RectangleToRectangle(e.getBounds(), pb)) {
        this.hurtPlayer(e.contactDamage, e.x);
      }
    });

    this.updateHud();
  }
}
window.GameScene = GameScene;
