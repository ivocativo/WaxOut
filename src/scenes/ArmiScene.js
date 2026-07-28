// ArmiScene — ARSENALE (2026-07-27). Qui si SBLOCCANO le armi col cerume in banca e si SCEGLIE
// quale portarsi nella prossima run. Due cose nella stessa schermata apposta: sbloccare un'arma e
// non poterla scegliere da nessuna parte sarebbe un giro a vuoto.
//
// Scena separata e non una terza colonna del negozio perche' il negozio e' gia' pieno (due colonne,
// otto progetti a destra) e non c'e' scorrimento: una terza colonna sarebbe illeggibile sul telefono.
//
// Le armi vere e proprie stanno in window.ARMI (state.js): qui c'e' solo l'interfaccia.
class ArmiScene extends Phaser.Scene {
  constructor() { super('ArmiScene'); }

  create() {
    const W = window.CONFIG.WIDTH, H = window.CONFIG.HEIGHT, C = window.CONFIG.COLORS;
    const T = window.I18n;

    window.GameGfx.paintSceneBg(this);
    window.GameGfx.sceneTitle(this, T.t('armi_title'), 32);
    this.add.text(W / 2, 66, T.t('armi_hint'), {
      fontFamily: 'monospace', fontSize: '13px', color: '#cdeccb',
    }).setOrigin(0.5);
    this.bankText = this.add.text(W / 2, 88, '', {
      fontFamily: 'monospace', fontSize: '16px', color: '#fff7e8',
      stroke: '#14161f', strokeThickness: 4,
    }).setOrigin(0.5);

    const inUso = window.Meta.get().arma || 'fioc';
    const startY = 132, rowH = 78;
    window.ARMI.forEach((a, i) => this.riga(W / 2, startY + i * rowH, a, a.id === inUso));

    window.GameGfx.uiButton(this, W / 2, H - 26, T.t('shop_back'), () => this.toMenu(), { w: 210, h: 38 });
    this.input.keyboard.on('keydown-ESC', () => this.toMenu());

    this.refreshBank();
  }

  // Una riga: anteprima dell'arma + nome + effetto + pulsante (sblocca / equipaggia / in uso).
  riga(cx, cy, arma, inUso) {
    const T = window.I18n;
    const w = 800, h = 68;
    const posseduta = window.Meta.armaPosseduta(arma.id);
    const bordo = inUso ? 0x9fe6a0 : (posseduta ? window.GameGfx.UI.ambraScura : window.GameGfx.UI.bordo);
    window.GameGfx.panel(this, cx, cy, w, h, { soft: !inUso, accento: bordo });

    // Anteprima: la texture del corpo a corpo del kit (l'arte definitiva arrivera' dopo, oggi
    // sono ancora le vecchie texture disegnate a codice).
    const ico = this.add.image(cx - w / 2 + 34, cy, arma.mischia.tex).setScale(1.4);
    if (ico.height > 30) ico.setScale(30 / ico.height * 1.4);

    const tx = cx - w / 2 + 64;
    this.add.text(tx, cy - 13, T.t('arma_' + arma.id + '_name'), {
      fontFamily: 'monospace', fontSize: '17px', color: inUso ? '#9fe6a0' : '#ffe2b0',
    }).setOrigin(0, 0.5);
    this.add.text(tx, cy + 12, T.t('arma_' + arma.id + '_desc'), {
      fontFamily: 'monospace', fontSize: '12px', color: '#fff7e8',
      wordWrap: { width: w - 210 }, lineSpacing: 2,
    }).setOrigin(0, 0.5);

    const bx = cx + w / 2 - 76;
    let label, bg, fg, azione = null;
    if (inUso) { label = T.t('armi_inuso'); bg = '#3f5a3f'; fg = '#cfe9cf'; }
    else if (posseduta) { label = T.t('armi_equip'); bg = '#ffd166'; fg = '#14161f'; azione = () => this.equipaggia(arma.id); }
    else if (window.Meta.get().bank >= arma.cost) {
      label = T.t('shop_unlock', { cost: arma.cost }); bg = '#ffd166'; fg = '#14161f';
      azione = () => this.sblocca(arma);
    } else { label = T.t('shop_need', { cost: arma.cost }); bg = '#6a3030'; fg = '#ffd9d9'; }

    const btn = this.add.text(bx, cy, label, {
      fontFamily: 'monospace', fontSize: '12px', color: fg, align: 'center',
      backgroundColor: bg, padding: { x: 10, y: 6 },
    }).setOrigin(0.5);
    if (azione) {
      btn.setInteractive({ useHandCursor: true });
      btn.on('pointerover', () => btn.setStyle({ backgroundColor: '#ffe199' }));
      btn.on('pointerout', () => btn.setStyle({ backgroundColor: '#ffd166' }));
      btn.on('pointerdown', azione);
    }
  }

  sblocca(arma) {
    if (!window.Meta.spend(arma.cost)) { window.Sfx.hurt(); return; }
    window.Meta.setUnlock('arma_' + arma.id, 1);
    window.Meta.setArma(arma.id);      // appena comprata la si vuole provare: gia' equipaggiata
    window.Sfx.unlock();
    this.scene.restart();
  }

  equipaggia(id) {
    if (!window.Meta.setArma(id)) { window.Sfx.hurt(); return; }
    window.Sfx.pick();
    this.scene.restart();
  }

  refreshBank() {
    const meta = window.Meta.get();
    this.bankText.setText(window.I18n.t('shop_bank', { bank: meta.bank, best: meta.bestLevel }));
  }

  toMenu() {
    window.Sfx.unlock();
    this.scene.start('MenuScene');
  }
}
window.ArmiScene = ArmiScene;
