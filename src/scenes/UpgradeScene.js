// UpgradeScene: a fine livello scegli 1 di 3 potenziamenti, poi si va al livello successivo.
class UpgradeScene extends Phaser.Scene {
  constructor() { super('UpgradeScene'); }

  create() {
    const W = window.CONFIG.WIDTH, H = window.CONFIG.HEIGHT, C = window.CONFIG.COLORS;
    const p = window.GameState.player;

    // La scena Phaser viene riusata: azzera la "scelta gia fatta" a ogni apertura,
    // altrimenti dal 2o potenziamento in poi i click verrebbero ignorati.
    this._chosen = false;

    // sfondo
    const g = this.add.graphics();
    g.fillStyle(C.bgBottom, 1); g.fillRect(0, 0, W, H);
    g.fillStyle(0x000000, 0.35); g.fillRect(0, 0, W, H);

    this.add.text(W / 2, 60, 'POTENZIAMENTO', {
      fontFamily: 'monospace', fontSize: '44px', color: '#ffd166',
      stroke: '#14161f', strokeThickness: 7,
    }).setOrigin(0.5);
    this.add.text(W / 2, 108, 'Scegli una nuova abilita o arma (1 / 2 / 3 o click)', {
      fontFamily: 'monospace', fontSize: '18px', color: '#fff7e8',
      stroke: '#14161f', strokeThickness: 3,
    }).setOrigin(0.5);

    // Pool di potenziamenti
    const ALL = [
      { id: 'damage', name: 'Affilatura', desc: '+8 danno', rep: true, apply: (s) => { s.damage += 8; } },
      { id: 'hp', name: 'Fibra Extra', desc: '+25 HP max\n(e cura completa)', rep: true, apply: (s) => { s.maxHp += 25; s.hp = s.maxHp; } },
      { id: 'attspd', name: 'Riflessi', desc: 'Attacco piu rapido', rep: true, apply: (s) => { s.attackCooldown = Math.max(150, s.attackCooldown - 45); } },
      { id: 'speed', name: 'Stivali Veloci', desc: '+30 velocita', rep: true, apply: (s) => { s.moveSpeed += 30; } },
      { id: 'range', name: 'Braccio Lungo', desc: '+25% portata', rep: true, apply: (s) => { s.attackRange += 0.25; } },
      { id: 'doublejump', name: 'Salto Doppio', desc: 'Salta due volte', rep: false, ability: 'salto doppio', apply: (s) => { s.doubleJump = true; } },
      { id: 'dash', name: 'Scatto', desc: 'Shift per scattare', rep: false, ability: 'scatto', apply: (s) => { s.dash = true; } },
      { id: 'hammer', name: 'Martello di Cerume', desc: 'Arma ad area\n+6 danno', rep: false, ability: 'martello', apply: (s) => { s.weapon = 'hammer'; s.damage += 6; } },
    ];

    const avail = ALL.filter((u) => {
      if (u.rep) return true;
      if (u.id === 'doublejump') return !p.doubleJump;
      if (u.id === 'dash') return !p.dash;
      if (u.id === 'hammer') return p.weapon !== 'hammer';
      return true;
    });
    Phaser.Utils.Array.Shuffle(avail);
    const choices = avail.slice(0, 3);

    // Carte
    const cardW = 240, cardH = 170, gap = 30;
    const totalW = choices.length * cardW + (choices.length - 1) * gap;
    const startX = (W - totalW) / 2 + cardW / 2;
    const cy = 300;

    choices.forEach((u, i) => {
      const cx = startX + i * (cardW + gap);
      const card = this.add.rectangle(cx, cy, cardW, cardH, 0x2b1d12, 1)
        .setStrokeStyle(4, 0xffd166).setInteractive({ useHandCursor: true });

      this.add.text(cx, cy - 55, (i + 1) + '. ' + u.name, {
        fontFamily: 'monospace', fontSize: '20px', color: '#ffe2b0',
        align: 'center', wordWrap: { width: cardW - 20 },
      }).setOrigin(0.5);
      this.add.text(cx, cy + 10, u.desc, {
        fontFamily: 'monospace', fontSize: '16px', color: '#fff7e8',
        align: 'center', lineSpacing: 4, wordWrap: { width: cardW - 24 },
      }).setOrigin(0.5);
      if (!u.rep) {
        this.add.text(cx, cy + 65, '★ ABILITA', {
          fontFamily: 'monospace', fontSize: '13px', color: '#9fe6a0',
        }).setOrigin(0.5);
      }

      card.on('pointerover', () => card.setFillStyle(0x4a3320, 1));
      card.on('pointerout', () => card.setFillStyle(0x2b1d12, 1));
      card.on('pointerdown', () => this.choose(u));
    });

    // Scelta da tastiera
    this.input.keyboard.on('keydown-ONE', () => { if (choices[0]) this.choose(choices[0]); });
    this.input.keyboard.on('keydown-TWO', () => { if (choices[1]) this.choose(choices[1]); });
    this.input.keyboard.on('keydown-THREE', () => { if (choices[2]) this.choose(choices[2]); });

    // Riepilogo statistiche
    const stats = [
      'Cerume raccolto: ' + window.GameState.wax,
      'Danno: ' + p.damage + '   HP max: ' + p.maxHp + '   Velocita: ' + p.moveSpeed,
      'Arma: ' + (p.weapon === 'hammer' ? 'Martello di Cerume' : 'Cotton fioc'),
    ];
    this.add.text(W / 2, H - 70, stats.join('\n'), {
      fontFamily: 'monospace', fontSize: '15px', color: '#ffeccb', align: 'center', lineSpacing: 4,
    }).setOrigin(0.5);
  }

  choose(u) {
    if (this._chosen) return;
    this._chosen = true;
    window.Sfx.pick();
    u.apply(window.GameState.player);
    if (u.ability && window.GameState.ownedAbilities.indexOf(u.ability) === -1) {
      window.GameState.ownedAbilities.push(u.ability);
    }
    window.GameState.level += 1;
    this.scene.start('GameScene');
  }
}
window.UpgradeScene = UpgradeScene;
