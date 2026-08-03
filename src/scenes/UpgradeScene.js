// UpgradeScene: a fine livello scegli 1 di 3 potenziamenti, poi si va al livello successivo.
class UpgradeScene extends Phaser.Scene {
  constructor() { super('UpgradeScene'); }

  create() {
    const W = window.CONFIG.WIDTH, H = window.CONFIG.HEIGHT, C = window.CONFIG.COLORS;
    const p = window.GameState.player;

    // La scena Phaser viene riusata: azzera la "scelta gia fatta" a ogni apertura,
    // altrimenti dal 2o potenziamento in poi i click verrebbero ignorati.
    this._chosen = false;

    // sfondo e titolo comuni alle schermate di contorno (vedi GameGfx.paintSceneBg)
    const T = window.I18n;
    window.GameGfx.paintSceneBg(this);
    window.GameGfx.sceneTitle(this, T.t('up_title'), 58);
    this.add.text(W / 2, 100, T.t('up_hint'), {
      fontFamily: 'monospace', fontSize: '15px', color: '#c9a6b2',
    }).setOrigin(0.5);

    // Pool di potenziamenti. Nome/descrizione vengono dal dizionario (up_<id>_name
    // / up_<id>_desc). Per le abilita 'ability' e' un id stabile, tradotto a parte.
    // rarity: comune (stat base) / rara (abilita' che cambia stile) / leggendaria
    // (abilita' da Progetto sbloccato). Decide peso di pesca e colore della carta.
    // Quanto pesa una carta di CORPO A CORPO rispetto a una qualsiasi altra della stessa fascia.
    // A 0,5 esce la meta' delle volte. Manopola unica: alzarla rimette il corpo a corpo dov'era.
    const PESO_MISCHIA = 0.5;
    const ALL = [
      { id: 'damage', rep: true, rarity: 'common', peso: PESO_MISCHIA, apply: (s) => { s.damage += 8; } },
      { id: 'hp', rep: true, rarity: 'common', apply: (s) => { s.maxHp += 25; s.hp = s.maxHp; } },
      { id: 'attspd', rep: true, rarity: 'common', peso: PESO_MISCHIA, apply: (s) => { s.attackCooldown = Math.max(150, s.attackCooldown - 45); } },
      { id: 'speed', rep: true, rarity: 'common', apply: (s) => { s.moveSpeed += 30; } },
      { id: 'range', rep: true, rarity: 'common', peso: PESO_MISCHIA, apply: (s) => { s.attackRange += 0.4; } },
      // Getto Rapido (round 2, G.2): parallelo di Riflessi ma per il getto a distanza (che
      // prima non aveva NESSUN comune a velocizzarlo).
      { id: 'jetspd', rep: true, rarity: 'common', apply: (s) => { s.shotCooldown = Math.max(120, s.shotCooldown - 40); } },
      // Getto Potente (2026-07-26): mancava un comune che alzasse il DANNO a distanza (c'era solo
      // 'damage' per il corpo a corpo e 'jetspd' per la cadenza). +5 sul getto (base 16).
      { id: 'jetdmg', rep: true, rarity: 'common', apply: (s) => { s.jetDamage += 5; } },
      { id: 'doublejump', rep: false, rarity: 'rare', ability: 'doublejump', apply: (s) => { s.doubleJump = true; } },
      { id: 'dash', rep: false, rarity: 'rare', ability: 'dash', apply: (s) => { s.dash = true; } },
      // TESTA PESANTE (2026-07-27) — ha preso il posto della vecchia carta "Martello di Cerume".
      // Il Martello e' diventato un'arma dell'ARSENALE (si compra e si sceglie a inizio run), quindi
      // una carta che "ti da' il martello" non avrebbe piu' senso: cambierebbe l'arma che hai
      // scelto tu. Questa invece potenzia il corpo a corpo QUALUNQUE kit tu stia usando.
      { id: 'heavyhead', rep: false, rarity: 'rare', peso: PESO_MISCHIA, ability: 'heavyhead', apply: (s) => { s.damage = Math.round(s.damage * 1.3); s.attackRange += 0.15; } },
      // Abilità che cambiano lo stile di gioco (una volta sola ciascuna):
      // Ventaglio: ora IMPILABILE — ogni pesca aggiunge una pallina al getto.
      { id: 'spread', rep: false, stack: true, rarity: 'rare', ability: 'spread', apply: (s) => { s.jetPellets += 1; } },
      { id: 'pierce', rep: false, rarity: 'rare', ability: 'pierce', apply: (s) => { s.jetPierce = true; } },
      { id: 'lifesteal', rep: false, rarity: 'rare', ability: 'lifesteal', apply: (s) => { s.lifesteal = true; } },
      { id: 'shield', rep: false, rarity: 'rare', ability: 'shield', apply: (s) => { s.shield = true; } },
      // Nuove abilità del pool di run (non richiedono sblocco al negozio):
      { id: 'homing', rep: false, rarity: 'rare', ability: 'homing', apply: (s) => { s.homing = true; } },
      { id: 'secondlife', rep: false, rarity: 'rare', ability: 'secondlife', apply: (s) => { s.secondLife = true; } },
      { id: 'greed', rep: false, stack: true, rarity: 'rare', ability: 'greed', apply: (s) => { s.waxMult += 0.5; } },
      { id: 'dashstrike', rep: false, rarity: 'rare', ability: 'dashstrike', needs: 'dash', apply: (s) => { s.dashStrike = true; } },
      { id: 'corrosive', rep: false, rarity: 'rare', ability: 'corrosive', apply: (s) => { s.corrosive = true; } },
      // Rimbalzo: IMPILABILE — ogni pesca aggiunge un rimbalzo alle palline.
      { id: 'bounce', rep: false, stack: true, rarity: 'rare', ability: 'bounce', apply: (s) => { s.bounce += 1; } },
      // Raffica Radiale (playtest round 5, idea dell'utente): IMPILABILE, ma ogni pesca
      // aggiunge DIREZIONI (4, poi 8, poi 12...) invece di ripetere lo stesso colpo. Cosi'
      // ogni carta allarga davvero la copertura attorno al personaggio.
      { id: 'radial', rep: false, stack: true, rarity: 'rare', ability: 'radial', apply: (s) => { s.radiale += window.CONFIG.RADIALE_PER_PESCA; } },
      // Abilità NUOVE sbloccabili dai PROGETTI del negozio (locked: compaiono qui solo
      // dopo essere state sbloccate — vedi window.BLUEPRINTS / ShopScene).
      { id: 'magnet', rep: false, rarity: 'legendary', ability: 'magnet', locked: true, apply: (s) => { s.magnet = true; } },
      { id: 'blast',  rep: false, rarity: 'legendary', peso: PESO_MISCHIA, ability: 'blast',  locked: true, apply: (s) => { s.meleeBlast = true; } },
      { id: 'splash', rep: false, rarity: 'legendary', ability: 'splash', locked: true, apply: (s) => { s.jetSplash = true; } },
      // Bolla-aiutante: IMPILABILE — ogni pesca aggiunge una bolla (richiede il Progetto sbloccato).
      { id: 'companion', rep: false, stack: true, rarity: 'legendary', ability: 'companion', locked: true, apply: (s) => { s.companions += 1; } },
      { id: 'backshot', rep: false, rarity: 'legendary', ability: 'backshot', locked: true, apply: (s) => { s.backShot = true; } },
      { id: 'rage',     rep: false, rarity: 'legendary', ability: 'rage',     locked: true, apply: (s) => { s.rage = true; } },
      { id: 'stunshot', rep: false, rarity: 'legendary', ability: 'stunshot', locked: true, apply: (s) => { s.stunShot = true; } },
      { id: 'slam',     rep: false, rarity: 'legendary', peso: PESO_MISCHIA, ability: 'slam',     locked: true, apply: (s) => { s.slam = true; } },
    ];

    // Peso di pesca per rarita' (piu' alto = piu' probabile) e stile della carta.
    const RARITY_WEIGHT = { common: 60, rare: 30, legendary: 10 };
    const RARITY_STYLE = {
      common:    { fill: 0x2b1d12, hover: 0x453322, border: 0xcfcfcf, title: '#e8e8e8' },
      rare:      { fill: 0x16283a, hover: 0x1f3c52, border: 0x4fd1ff, title: '#bfeeff' },
      legendary: { fill: 0x3a2a12, hover: 0x5a4020, border: 0xffd166, title: '#ffe9a8' },
    };

    // Pesca SENZA reinserimento, pesata per FASCIA di rarita' (non per singola voce): si
    // sceglie prima la fascia con le probabilita' 60/30/10, poi una voce a caso al suo
    // interno. Cosi' le probabilita' 60/30/10 restano quelle della fascia — altrimenti una
    // fascia con piu' voci nel pool (es. "rara" con 13 abilita' contro le 5 "comuni")
    // finirebbe per uscire piu' spesso, nonostante il peso minore.
    function weightedSample(pool, n) {
      const remaining = pool.slice();
      const picked = [];
      while (remaining.length && picked.length < n) {
        const tiers = Object.keys(RARITY_WEIGHT).filter((t) => remaining.some((u) => u.rarity === t));
        const total = tiers.reduce((sum, t) => sum + RARITY_WEIGHT[t], 0);
        let r = Math.random() * total;
        let tier = tiers[tiers.length - 1];
        for (const t of tiers) { r -= RARITY_WEIGHT[t]; if (r <= 0) { tier = t; break; } }
        const inTier = remaining.filter((u) => u.rarity === tier);
        // Dentro la fascia la pesca NON e' piu' uniforme: ogni carta ha un peso (1 se non
        // scritto). Serve per il CORPO A CORPO, che il playtest del 2026-08-02 ha giudicato
        // secondario rispetto ai colpi a distanza e che occupava troppo posto nel mazzo: le sue
        // carte hanno `peso: PESO_MISCHIA` e escono la meta' delle volte. Si abbassano di
        // frequenza senza toglierle dal gioco — chi vuole giocare di mazza le trova ancora.
        const pesi = inTier.map((u) => u.peso || 1);
        let rp = Math.random() * pesi.reduce((a, b) => a + b, 0);
        let chosen = inTier[inTier.length - 1];
        for (let i = 0; i < inTier.length; i++) { rp -= pesi[i]; if (rp <= 0) { chosen = inTier[i]; break; } }
        picked.push(remaining.splice(remaining.indexOf(chosen), 1)[0]);
      }
      return picked;
    }

    // Disponibili: gli stat ripetibili sempre; le "stack" (impilabili) ri-pescabili all'infinito;
    // le abilità una-tantum solo se non gia' possedute (ownedAbilities le traccia tutte). Le
    // abilità "locked" compaiono solo se il Progetto e' sbloccato al negozio (Meta.unlockLevel>0).
    // "needs" (round 2, A.4): PREREQUISITO — la carta non esce finche' non possiedi gia'
    // l'abilita' base collegata (es. Scatto Offensivo richiede lo Scatto normale).
    const owned = window.GameState.ownedAbilities;
    const avail = ALL.filter((u) => {
      if (u.needs && owned.indexOf(u.needs) === -1) return false;
      if (u.rep) return true;
      if (u.locked && window.Meta.unlockLevel(u.id) <= 0) return false;
      if (u.stack) return true;
      return owned.indexOf(u.ability) === -1;
    });

    // EVOLUZIONI disponibili: possiedi entrambe le abilità richieste e non l'hai ancora fusa.
    // Hanno PRIORITA' (compaiono davanti) e il tag speciale "EVOLUZIONE" (stile fucsia, sopra
    // al sistema di rarita': un'evoluzione e' sempre "speciale" a prescindere).
    const evoAvail = (window.EVOLUTIONS || []).filter((r) =>
      r.needs.every((n) => owned.indexOf(n) !== -1) && owned.indexOf(r.id) === -1
    ).map((r) => ({ id: r.id, evo: true, ability: r.id, apply: r.apply }));
    Phaser.Utils.Array.Shuffle(evoAvail);

    // Le carte: al massimo 1 evoluzione in evidenza + riempi fino a 3 pescando per rarita'.
    const evoSlice = evoAvail.slice(0, 1);
    const choices = [...evoSlice, ...weightedSample(avail, 3 - evoSlice.length)];

    // Carte
    const cardW = 240, cardH = 170, gap = 30;
    const totalW = choices.length * cardW + (choices.length - 1) * gap;
    const startX = (W - totalW) / 2 + cardW / 2;
    const cy = 300;

    choices.forEach((u, i) => {
      const cx = startX + i * (cardW + gap);
      // Stile per rarita' (comune/rara/leggendaria); le evoluzioni restano fucsia, sopra al sistema.
      const style = u.evo ? null : (RARITY_STYLE[u.rarity] || RARITY_STYLE.common);
      const baseFill = u.evo ? 0x3a2140 : style.fill;
      const hoverFill = u.evo ? 0x5a3562 : style.hover;
      const borderColor = u.evo ? 0xff9ff3 : style.border;
      const titleColor = u.evo ? '#ffd6ff' : style.title;

      // La carta e' un pannello ridisegnabile (serve per lo stato "sopra"): stesso linguaggio
      // delle altre schermate, ma il colore lo detta la RARITA' — e' l'informazione principale.
      const sfondo = this.add.graphics();
      const disegnaCarta = (dentro) => {
        sfondo.clear();
        sfondo.fillStyle(dentro ? hoverFill : baseFill, 1);
        sfondo.fillRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 12);
        sfondo.lineStyle(3, borderColor, dentro ? 1 : 0.85);
        sfondo.strokeRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 12);
        sfondo.fillStyle(0xffffff, dentro ? 0.10 : 0.06);
        sfondo.fillRoundedRect(cx - cardW / 2 + 4, cy - cardH / 2 + 3, cardW - 8, 14, { tl: 12, tr: 12, bl: 0, br: 0 });
      };
      disegnaCarta(false);
      const card = this.add.rectangle(cx, cy, cardW, cardH, 0xffffff, 0)
        .setInteractive({ useHandCursor: true });

      this.add.text(cx, cy - 55, (i + 1) + '. ' + T.t('up_' + u.id + '_name'), {
        fontFamily: 'monospace', fontSize: '20px', color: titleColor,
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
      } else {
        this.add.text(cx, cy + 65, T.t('up_rarity_' + u.rarity), {
          fontFamily: 'monospace', fontSize: '13px', color: titleColor,
        }).setOrigin(0.5);
      }

      card.on('pointerover', () => disegnaCarta(true));
      card.on('pointerout', () => disegnaCarta(false));
      card.on('pointerdown', () => this.choose(u));
    });

    // Scelta da tastiera
    this.input.keyboard.on('keydown-ONE', () => { if (choices[0]) this.choose(choices[0]); });
    this.input.keyboard.on('keydown-TWO', () => { if (choices[1]) this.choose(choices[1]); });
    this.input.keyboard.on('keydown-THREE', () => { if (choices[2]) this.choose(choices[2]); });

    // Riepilogo statistiche
    const weaponName = T.t('arma_' + (p.arma || 'fioc') + '_name');
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

    // (La fine della run NON passa piu' di qui: dal livello finale GameScene.levelComplete va
    // diritta a VictoryScene, senza far scegliere una carta che non si userebbe mai.)
    window.GameState.level += 1;
    // SCELTA DEL PERCORSO (round A, A.3): ogni livello NON-boss e' preceduto da una porta.
    // I livelli boss (multipli di 5, stessa regola di GameScene.create) restano fissi.
    if (window.GameState.level % 5 === 0) {
      this.scene.start('GameScene');
    } else {
      this.scene.start('DoorScene');
    }
  }
}
window.UpgradeScene = UpgradeScene;
