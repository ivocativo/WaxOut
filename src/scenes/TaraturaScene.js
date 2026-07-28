// TaraturaScene — PANNELLO DI PROVA (2026-07-27). Le manopole stanno in src/taratura.js, qui
// c'e' solo l'interfaccia: una riga per manopola con "-" e "+" grandi (si usa dal telefono),
// piu' le scorciatoie che servono per provare (vita infinita, sblocca tutte le armi, cerume).
//
// Si apre dal MENU e dalla PAUSA. Dalla pausa le modifiche si vedono al livello dopo (o
// riavviando il livello): i numeri vengono letti quando il livello viene COSTRUITO.
//
// ⚠️ Da togliere prima di pubblicare: vedi il commento in cima a src/taratura.js.
class TaraturaScene extends Phaser.Scene {
  constructor() { super('TaraturaScene'); }

  init(data) { this.tornaA = (data && data.from) || 'MenuScene'; }

  create() {
    const W = window.CONFIG.WIDTH, H = window.CONFIG.HEIGHT, C = window.CONFIG.COLORS;
    const T = window.I18n, TA = window.Taratura;

    const g = this.add.graphics();
    g.fillStyle(C.bgBottom, 1); g.fillRect(0, 0, W, H);
    g.fillStyle(0x000000, 0.55); g.fillRect(0, 0, W, H);

    this.add.text(W / 2, 26, T.t('tar_title'), {
      fontFamily: 'monospace', fontSize: '26px', color: '#ffd166',
      stroke: '#14161f', strokeThickness: 5,
    }).setOrigin(0.5);
    this.add.text(W / 2, 50, T.t('tar_hint'), {
      fontFamily: 'monospace', fontSize: '11px', color: '#cdeccb',
    }).setOrigin(0.5);

    // Due colonne di manopole: dieci righe in una colonna sola non ci starebbero senza scorrimento.
    const ids = Object.keys(TA.CAMPI);
    const meta = Math.ceil(ids.length / 2);
    ids.forEach((id, i) => {
      const col = i < meta ? 0 : 1;
      const riga = i < meta ? i : i - meta;
      this.manopola(W / 2 + (col === 0 ? -238 : 238), 88 + riga * 44, id);
    });

    // --- Scorciatoie ---
    const by = 88 + meta * 44 + 6;
    this.interruttore(W / 2 - 238, by, 'tar_god', () => TA.godmode(), (v) => TA.setGodmode(v));

    this.pulsante(W / 2 + 238, by, T.t('tar_armi'), () => {
      (window.ARMI || []).forEach((a) => window.Meta.setUnlock('arma_' + a.id, 1));
      window.Sfx.unlock();
      this.msg(T.t('tar_armi_ok'));
    });
    this.pulsante(W / 2 - 238, by + 40, T.t('tar_cerume_btn'), () => {
      window.Meta.addBank(3000);
      window.Sfx.pick();
      this.msg(T.t('tar_cerume_ok'));
    });
    this.pulsante(W / 2 + 238, by + 40, T.t('tar_reset'), () => {
      TA.reset(); window.Sfx.hurt(); this.scene.restart({ from: this.tornaA });
    });

    this.msgText = this.add.text(W / 2, by + 74, '', {
      fontFamily: 'monospace', fontSize: '13px', color: '#9fe6a0',
    }).setOrigin(0.5);

    const back = this.add.text(W / 2, H - 22, T.t('shop_back'), {
      fontFamily: 'monospace', fontSize: '17px', color: '#14161f',
      backgroundColor: '#ffd166', padding: { x: 18, y: 7 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => this.esci());
    this.input.keyboard.on('keydown-ESC', () => this.esci());
  }

  // Una manopola: etichetta, valore, e due pulsanti grandi. Il passo lo decide taratura.js.
  manopola(cx, cy, id) {
    const T = window.I18n, TA = window.Taratura;
    const w = 452;
    this.add.rectangle(cx, cy, w, 38, 0x2b1d12, 1).setStrokeStyle(2, 0x6a5a3a);
    this.add.text(cx - w / 2 + 12, cy, T.t('tar_' + id), {
      fontFamily: 'monospace', fontSize: '13px', color: '#ffe2b0',
    }).setOrigin(0, 0.5);

    const val = this.add.text(cx + w / 2 - 108, cy, '', {
      fontFamily: 'monospace', fontSize: '15px', color: '#fff7e8',
    }).setOrigin(0.5);
    // fpsCerumino e' un numero vero (fotogrammi al secondo), le altre sono moltiplicatori:
    // mostrarle tutte con la "x" davanti sarebbe una bugia.
    const mostra = () => val.setText(id === 'fpsCerumino'
      ? String(Math.round(TA.v(id))) : 'x' + parseFloat(TA.v(id).toFixed(2)));
    mostra();

    const freccia = (dx, chr) => {
      const b = this.add.text(cx + w / 2 - 60 + dx, cy, chr, {
        fontFamily: 'monospace', fontSize: '17px', color: '#14161f',
        backgroundColor: '#ffd166', padding: { x: 11, y: 5 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      b.on('pointerdown', () => {
        TA.set(id, TA.v(id) + (dx < 0 ? -1 : 1) * TA.passo(id));
        mostra();
        window.Sfx.pick();
      });
      return b;
    };
    freccia(-4, '-');
    freccia(52, '+');
  }

  interruttore(cx, cy, chiave, leggi, scrivi) {
    const T = window.I18n;
    const b = this.add.text(cx, cy, '', {
      fontFamily: 'monospace', fontSize: '13px', color: '#14161f',
      backgroundColor: '#ffd166', padding: { x: 12, y: 7 }, fixedWidth: 452, align: 'center',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    const mostra = () => b.setText(T.t(chiave) + ': ' + T.t(leggi() ? 'tar_on' : 'tar_off'))
      .setStyle({ backgroundColor: leggi() ? '#9fe6a0' : '#ffd166' });
    mostra();
    b.on('pointerdown', () => { scrivi(!leggi()); mostra(); window.Sfx.pick(); });
    return b;
  }

  pulsante(cx, cy, label, onTap) {
    const b = this.add.text(cx, cy, label, {
      fontFamily: 'monospace', fontSize: '13px', color: '#14161f',
      backgroundColor: '#ffd166', padding: { x: 12, y: 7 }, fixedWidth: 452, align: 'center',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    b.on('pointerdown', onTap);
    return b;
  }

  msg(testo) {
    if (!this.msgText) return;
    this.msgText.setText(testo);
    this.time.delayedCall(2200, () => { if (this.msgText && this.msgText.active) this.msgText.setText(''); });
  }

  esci() {
    window.Sfx.unlock();
    // Dalla PAUSA si torna alla pausa (che dorme sotto) e la partita riprende da dove stava:
    // uscire al menu farebbe perdere la run, ed e' proprio mentre si gioca che si tara.
    if (this.tornaA === 'PauseScene') { this.scene.wake('PauseScene'); this.scene.stop(); }
    else this.scene.start('MenuScene');
  }
}
window.TaraturaScene = TaraturaScene;
