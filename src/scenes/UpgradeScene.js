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
      // Ventaglio: ora IMPILABILE — ogni pesca aggiunge una pallina al getto.
      { id: 'spread', rep: false, stack: true, ability: 'spread', apply: (s) => { s.jetPellets += 1; } },
      { id: 'pierce', rep: false, ability: 'pierce', apply: (s) => { s.jetPierce = true; } },
      { id: 'lifesteal', rep: false, ability: 'lifesteal', apply: (s) => { s.lifesteal = true; } },
      { id: 'shield', rep: false, ability: 'shield', apply: (s) => { s.shield = true; } },
      // Nuove abilità del pool di run (non richiedono sblocco al negozio):
      { id: 'homing', rep: false, ability: 'homing', apply: (s) => { s.homing = true; } },
      { id: 'secondlife', rep: false, ability: 'secondlife', apply: (s) => { s.secondLife = true; } },
      { id: 'greed', rep: false, stack: true, ability: 'greed', apply: (s) => { s.waxMult += 0.5; } },
      { id: 'dashstrike', rep: false, ability: 'dashstrike', apply: (s) => { s.dashStrike = true; if (!s.dash) s.dash = true; } },
      { id: 'corrosive', rep: false, ability: 'corrosive', apply: (s) => { s.corrosive = true; } },
      // Rimbalzo: IMPILABILE — ogni pesca aggiunge un rimbalzo alle palline.
      { id: 'bounce', rep: false, stack: true, ability: 'bounce', apply: (s) => { s.bounce += 1; } },
      // Abilità NUOVE sbloccabili dai PROGETTI del negozio (locked: compaiono qui solo
      // dopo essere state sbloccate — vedi window.BLUEPRINTS / ShopScene).
      { id: 'magnet', rep: false, ability: 'magnet', locked: true, apply: (s) => { s.magnet = true; } },
      { id: 'blast',  rep: false, ability: 'blast',  locked: true, apply: (s) => { s.meleeBlast = true; } },
      { id: 'splash', rep: false, ability: 'splash', locked: true, apply: (s) => { s.jetSplash = true; } },
      // Bolla-aiutante: IMPILABILE — ogni pesca aggiunge una bolla (richiede il Progetto sbloccato).
      { id: 'companion', rep: false, stack: true, ability: 'companion', locked: true, apply: (s) => { s.companions += 1; } },
    ];

    // Disponibili: gli stat ripetibili sempre; le "stack" (impilabili) ri-pescabili all'infinito;
    // le abilità una-tantum solo se non gia' possedute (ownedAbilities le traccia tutte). Le
    // abilità "locked" compaiono solo se il Progetto e' sbloccato al negozio (Meta.unlockLevel>0).
    const owned = window.GameState.ownedAbilities;
    const avail = ALL.filter((u) => {
      if (u.rep) return true;
      if (u.locked && window.Meta.unlockLevel(u.id) <= 0) return false;
      if (u.stack) return true;
      return owned.indexOf(u.ability) === -1;
    });
    Phaser.Utils.Array.Shuffle(avail);

    // EVOLUZIONI disponibili: possiedi entrambe le abilità richieste e non l'hai ancora fusa.
    // Hanno PRIORITA' (compaiono davanti) e il tag speciale "EVOLUZIONE".
    const evoAvail = (window.EVOLUTIONS || []).filter((r) =>
      r.needs.every((n) => owned.indexOf(n) !== -1) && owned.indexOf(r.id) === -1
    ).map((r) => ({ id: r.id, evo: true, ability: r.id, apply: r.apply }));
    Phaser.Utils.Array.Shuffle(evoAvail);

    // Le carte: al massimo 1 evoluzione in evidenza + riempi fino a 3 con le normali.
    const choices = [...evoAvail.slice(0, 1), ...avail].slice(0, 3);

    // Carte
    const cardW = 240, cardH = 170, gap = 30;
    const totalW = choices.length * cardW + (choices.length - 1) * gap;
    const startX = (W - totalW) / 2 + cardW / 2;
    const cy = 300;

    choices.forEach((u, i) => {
      const cx = startX + i * (cardW + gap);
      const card = this.add.rectangle(cx, cy, cardW, cardH, u.evo ? 0x3a2140 : 0x2b1d12, 1)
        .setStrokeStyle(4, u.evo ? 0xff9ff3 : 0xffd166).setInteractive({ useHandCursor: true });

      this.add.text(cx, cy - 55, (i + 1) + '. ' + T.t('up_' + u.id + '_name'), {
        fontFamily: 'monospace', fontSize: '20px', color: u.evo ? '#ffd6ff' : '#ffe2b0',
        align: 'center', wordWrap: { width: cardW - 20 },
      }).setOrigin(0.5);
      this.add.text(cx, cy + 10, T.t('up_' + u.id + '_desc'), {
        fontFamily: 'monospace', fontSize: '16px', color: '#fff7e8',
        align: 'center', lineSpacing: 4, wordWrap: { width: cardW - 24 },
      }).setOrigin(0.5);
      if (u.evo) {
        this.add.text(cx, cy + 65, T.t('up_evo_tag'), {
          fontFamily: 'monospace', fontSize: '13px', color: '#ff9ff3',
        }).setOrigin(0.5);
      } else if (!u.rep) {
        this.add.text(cx, cy + 65, T.t('up_ability_tag'), {
          fontFamily: 'monospace', fontSize: '13px', color: '#9fe6a0',
        }).setOrigin(0.5);
      }

      const baseFill = u.evo ? 0x3a2140 : 0x2b1d12, hoverFill = u.evo ? 0x5a3562 : 0x4a3320;
      card.on('pointerover', () => card.setFillStyle(hoverFill, 1));
      card.on('pointerout', () => card.setFillStyle(baseFill, 1));
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
