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

    window.GameGfx.paintSceneBg(this);
    window.GameGfx.sceneTitle(this, T.t('door_title'), 56);
    this.add.text(W / 2, 100, T.t('door_hint'), {
      fontFamily: 'monospace', fontSize: '15px', color: '#c9a6b2',
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
    // ⚠️ TIPO E MUTATORE NON SI PESCANO IN MODO INDIPENDENTE. Prima si sceglievano separatamente,
    // e usciva la coppia SCIAME + BERSERK: "tanti nemici" promesso dal tipo e "pochi ma feroci"
    // promesso dal mutatore, sulla stessa porta (segnalato dall'utente). Si sceglie prima il tipo,
    // poi il mutatore FRA QUELLI CHE CI STANNO — regola nei dati, la stessa che usa GameScene.
    const riskyKind = Phaser.Utils.Array.GetRandom(RISKY_KINDS);
    const mutAmmessi = RISKY_MUTATORS.filter((id) => window.mutatoreVaCon(id, riskyKind));
    this.doors = [
      { kind: safeKind, mutator: null, waxMult: 1, tag: 'safe' },
      { kind: riskyKind, mutator: Phaser.Utils.Array.GetRandom(mutAmmessi), waxMult: 2, tag: 'risky' },
    ];

    const cardW = 360, cardH = 340, gap = 40;
    const totalW = this.doors.length * cardW + (this.doors.length - 1) * gap;
    const startX = (W - totalW) / 2 + cardW / 2;
    const cy = 320;

    const TAG_STYLE = {
      safe:  { fill: 0x16283a, hover: 0x1f3c52, border: 0x4fd1ff, title: '#bfeeff', tag: '#8fe0ff' },
      risky: { fill: 0x3a1618, hover: 0x522024, border: 0xff6b5a, title: '#ffd0c8', tag: '#ff9a8a' },
    };

    // Colore del modificatore: lo stesso del banner a inizio livello, cosi' il giocatore
    // collega la riga "REGOLA SPECIALE" della porta con la scritta che vedra' in partita.
    const mutColor = (id) => {
      const m = (window.MUTATORS || []).find((x) => x.id === id);
      return (m && m.color) || '#fff7e8';
    };

    this.doors.forEach((d, i) => {
      const cx = startX + i * (cardW + gap);
      const style = TAG_STYLE[d.tag];
      const top = cy - cardH / 2;
      const wrap = cardW - 34;

      const card = this.add.rectangle(cx, cy, cardW, cardH, style.fill, 1)
        .setStrokeStyle(4, style.border).setInteractive({ useHandCursor: true });

      // Linea separatrice fra una sezione e l'altra: senza, le tre voci sembravano
      // un elenco unico e il giocatore non capiva cosa fosse cosa.
      const sep = (y) => {
        const l = this.add.graphics();
        l.fillStyle(style.border, 0.35);
        l.fillRect(cx - cardW / 2 + 16, y, cardW - 32, 2);
      };
      // Etichetta piccola e spenta + contenuto grande e acceso: si legge "OBIETTIVO: Normale".
      const label = (y, key) => this.add.text(cx - cardW / 2 + 16, y, T.t(key), {
        fontFamily: 'monospace', fontSize: '13px', color: style.tag,
      }).setOrigin(0, 0);

      this.add.text(cx, top + 20, (i + 1) + '. ' + T.t('door_tag_' + d.tag), {
        fontFamily: 'monospace', fontSize: '18px', color: style.tag,
      }).setOrigin(0.5, 0);

      // --- OBIETTIVO: che cosa devo fare per superare il livello
      sep(top + 50);
      label(top + 60, 'door_lbl_obj');
      this.add.text(cx, top + 80, T.t('door_kind_' + d.kind), {
        fontFamily: 'monospace', fontSize: '26px', color: style.title,
      }).setOrigin(0.5, 0);
      this.add.text(cx, top + 114, T.t('door_obj_' + d.kind), {
        fontFamily: 'monospace', fontSize: '14px', color: '#dfe6f0', align: 'center',
        wordWrap: { width: wrap }, lineSpacing: 3,
      }).setOrigin(0.5, 0);

      // --- REGOLA SPECIALE: come cambiano le regole del livello (il modificatore)
      sep(top + 168);
      label(top + 178, 'door_lbl_rule');
      this.add.text(cx, top + 200, d.mutator ? T.t('mut_' + d.mutator) : T.t('door_mod_none'), {
        fontFamily: 'monospace', fontSize: '15px',
        color: d.mutator ? mutColor(d.mutator) : '#9aa4b2', align: 'center',
        wordWrap: { width: wrap }, lineSpacing: 3,
      }).setOrigin(0.5, 0);

      // --- PREMIO
      sep(top + 262);
      label(top + 272, 'door_lbl_reward');
      this.add.text(cx, top + 294, d.waxMult > 1 ? T.t('door_reward_bonus', { mult: d.waxMult }) : T.t('door_reward_normal'), {
        fontFamily: 'monospace', fontSize: '19px', color: '#ffd166',
      }).setOrigin(0.5, 0);

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
