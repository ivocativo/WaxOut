// DoorScene: SCELTA DEL PERCORSO (round A, A.3) — compare tra la carta di potenziamento
// (UpgradeScene) e il livello vero e proprio, per ogni livello NON-boss (i boss restano
// fissi: niente porta, vedi UpgradeScene.choose). Due opzioni CONTRAPPOSTE — una piu' sicura
// e povera, una piu' rischiosa e ricca — cosi' quello che oggi era un sorteggio (tipo di
// livello + modificatore decisi da levelNum % 5) diventa una decisione del giocatore. Non
// serve contenuto nuovo: riusa tipi di livello e mutatori gia' esistenti.
//
// La scelta scrive window.GameState.prossimoLivello = { kind, mutator, waxMult }; GameScene.
// create() la legge e la CONSUMA (la azzera subito) per decidere tipo di livello e modificatore
// al posto del sorteggio a levelNum % 5.
class DoorScene extends Phaser.Scene {
  constructor() { super('DoorScene'); }

  create() {
    const W = window.CONFIG.WIDTH, H = window.CONFIG.HEIGHT, C = window.CONFIG.COLORS;
    const T = window.I18n;

    // La scena Phaser viene riusata: azzera la "scelta gia' fatta" a ogni apertura (stesso
    // motivo di UpgradeScene: altrimenti dal 2o livello in poi i click verrebbero ignorati).
    this._chosen = false;

    const g = this.add.graphics();
    g.fillStyle(C.bgBottom, 1); g.fillRect(0, 0, W, H);
    g.fillStyle(0x000000, 0.35); g.fillRect(0, 0, W, H);

    this.add.text(W / 2, 60, T.t('door_title'), {
      fontFamily: 'monospace', fontSize: '40px', color: '#ffd166',
      stroke: '#14161f', strokeThickness: 7,
    }).setOrigin(0.5);
    this.add.text(W / 2, 106, T.t('door_hint'), {
      fontFamily: 'monospace', fontSize: '18px', color: '#fff7e8',
      stroke: '#14161f', strokeThickness: 3,
    }).setOrigin(0.5);

    // Due porte CONTRAPPOSTE. 'bonanza' e' escluso apposta dal pool dei mutatori della porta
    // rischiosa: raddoppierebbe il cerume IN SILENZIO sopra al bonus gia' promesso dalla porta
    // (waxMult), e l'anteprima ("cerume x2") diventerebbe bugiarda per difetto.
    // Lato SICURO per lo piu' Normale, la Corsa solo ogni tanto (playtest utente 2026-07-25: le
    // missioni a tempo erano troppo frequenti).
    const safeKind = Math.random() < 0.75 ? 'normal' : 'rush';
    const RISKY_KINDS = ['siege', 'swarm'];
    // 'ironwax'/'bonanza' NON qui: toccano il moltiplicatore cerume e renderebbero bugiara
    // l'anteprima "cerume x2" della porta (restano nel pool casuale dei livelli).
    const RISKY_MUTATORS = ['haste', 'armored', 'horde', 'thickwax', 'quake', 'lowgrav', 'glass', 'frenzy', 'berserk'];

    // Salvate su `this` (non solo variabili locali): servono al click handler E ai controlli
    // automatici, che verificano la porta generata chiamando direttamente choose() su una di
    // queste (vedi tools/checks.js).
    this.doors = [
      { kind: safeKind, mutator: null, waxMult: 1, tag: 'safe' },
      { kind: Phaser.Utils.Array.GetRandom(RISKY_KINDS), mutator: Phaser.Utils.Array.GetRandom(RISKY_MUTATORS), waxMult: 2, tag: 'risky' },
    ];

    const cardW = 340, cardH = 260, gap = 50;
    const totalW = this.doors.length * cardW + (this.doors.length - 1) * gap;
    const startX = (W - totalW) / 2 + cardW / 2;
    const cy = 300;

    const TAG_STYLE = {
      safe:  { fill: 0x16283a, hover: 0x1f3c52, border: 0x4fd1ff, title: '#bfeeff', tag: '#8fe0ff' },
      risky: { fill: 0x3a1618, hover: 0x522024, border: 0xff6b5a, title: '#ffd0c8', tag: '#ff9a8a' },
    };

    this.doors.forEach((d, i) => {
      const cx = startX + i * (cardW + gap);
      const style = TAG_STYLE[d.tag];

      const card = this.add.rectangle(cx, cy, cardW, cardH, style.fill, 1)
        .setStrokeStyle(4, style.border).setInteractive({ useHandCursor: true });

      this.add.text(cx, cy - 100, (i + 1) + '. ' + T.t('door_tag_' + d.tag), {
        fontFamily: 'monospace', fontSize: '17px', color: style.tag,
      }).setOrigin(0.5);
      this.add.text(cx, cy - 58, T.t('door_kind_' + d.kind), {
        fontFamily: 'monospace', fontSize: '27px', color: style.title,
      }).setOrigin(0.5);
      this.add.text(cx, cy - 8, d.mutator ? T.t('mut_' + d.mutator) : T.t('door_mod_none'), {
        fontFamily: 'monospace', fontSize: '15px', color: '#fff7e8', align: 'center',
        wordWrap: { width: cardW - 30 }, lineSpacing: 3,
      }).setOrigin(0.5);
      this.add.text(cx, cy + 75, d.waxMult > 1 ? T.t('door_reward_bonus', { mult: d.waxMult }) : T.t('door_reward_normal'), {
        fontFamily: 'monospace', fontSize: '16px', color: '#ffd166',
      }).setOrigin(0.5);

      card.on('pointerover', () => card.setFillStyle(style.hover, 1));
      card.on('pointerout', () => card.setFillStyle(style.fill, 1));
      card.on('pointerdown', () => this.choose(d));
    });

    // Scelta da tastiera
    this.input.keyboard.on('keydown-ONE', () => { if (this.doors[0]) this.choose(this.doors[0]); });
    this.input.keyboard.on('keydown-TWO', () => { if (this.doors[1]) this.choose(this.doors[1]); });
  }

  choose(door) {
    if (this._chosen) return;
    this._chosen = true;
    window.Sfx.pick();
    window.GameState.prossimoLivello = { kind: door.kind, mutator: door.mutator, waxMult: door.waxMult };
    this.scene.start('GameScene');
  }
}
window.DoorScene = DoorScene;
