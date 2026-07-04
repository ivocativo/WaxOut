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

    const T = window.I18n;

    this.add.text(W / 2, 60, T.t('up_title'), {
      fontFamily: 'monospace', fontSize: '44px', color: '#ffd166',
      stroke: '#14161f', strokeThickness: 7,
    }).setOrigin(0.5);
    this.add.text(W / 2, 108, T.t('up_hint'), {
      fontFamily: 'monospace', fontSize: '18px', color: '#fff7e8',
      stroke: '#14161f', strokeThickness: 3,
    }).setOrigin(0.5);

    // Pool di potenziamenti. Nome/descrizione vengono dal dizionario (up_<id>_name
    // / up_<id>_desc). Per le abilita 'ability' e' un id stabile, tradotto a parte.
    const ALL = [
      { id: 'damage', rep: true, apply: (s) => { s.damage += 8; } },
      { id: 'hp', rep: true, apply: (s) => { s.maxHp += 25; s.hp = s.maxHp; } },
      { id: 'attspd', rep: true, apply: (s) => { s.attackCooldown = Math.max(150, s.attackCooldown - 45); } },
      { id: 'speed', rep: true, apply: (s) => { s.moveSpeed += 30; } },
      { id: 'range', rep: true, apply: (s) => { s.attackRange += 0.25; } },
      { id: 'doublejump', rep: false, ability: 'doublejump', apply: (s) => { s.doubleJump = true; } },
      { id: 'dash', rep: false, ability: 'dash', apply: (s) => { s.dash = true; } },
      { id: 'hammer', rep: false, ability: 'hammer', apply: (s) => { s.weapon = 'hammer'; s.damage += 6; } },
      // Abilità che cambiano lo stile di gioco (una volta sola ciascuna):
      { id: 'spread', rep: false, ability: 'spread', apply: (s) => { s.jetSpread = true; } },
      { id: 'pierce', rep: false, ability: 'pierce', apply: (s) => { s.jetPierce = true; } },
      { id: 'lifesteal', rep: false, ability: 'lifesteal', apply: (s) => { s.lifesteal = true; } },
      { id: 'shield', rep: false, ability: 'shield', apply: (s) => { s.shield = true; } },
    ];

    // Disponibili: gli stat ripetibili sempre; le abilità solo se non gia' possedute
    // (ownedAbilities le traccia tutte, comprese doublejump/dash/hammer).
    const owned = window.GameState.ownedAbilities;
    const avail = ALL.filter((u) => u.rep || (u.ability ? owned.indexOf(u.ability) === -1 : true));
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

      this.add.text(cx, cy - 55, (i + 1) + '. ' + T.t('up_' + u.id + '_name'), {
        fontFamily: 'monospace', fontSize: '20px', color: '#ffe2b0',
        align: 'center', wordWrap: { width: cardW - 20 },
      }).setOrigin(0.5);
      this.add.text(cx, cy + 10, T.t('up_' + u.id + '_desc'), {
        fontFamily: 'monospace', fontSize: '16px', color: '#fff7e8',
        align: 'center', lineSpacing: 4, wordWrap: { width: cardW - 24 },
      }).setOrigin(0.5);
      if (!u.rep) {
        this.add.text(cx, cy + 65, T.t('up_ability_tag'), {
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
    const weaponName = T.t(p.weapon === 'hammer' ? 'weapon_hammer' : 'weapon_swab');
    const stats = [
      T.t('up_stat_wax', { wax: window.GameState.wax }),
      T.t('up_stat_line', { dmg: p.damage, hp: p.maxHp, spd: p.moveSpeed }),
      T.t('up_stat_weapon', { weapon: weaponName }),
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
