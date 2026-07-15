// ShopScene: negozio tra una run e l'altra. Si spende il cerume in banca in DUE colonne:
// - POTENZIAMENTI (sinistra): bonus di statistica permanenti, ripetibili (window.UNLOCKS).
// - PROGETTI (destra): sblocchi una-tantum che aggiungono ABILITA' NUOVE al mazzo delle
//   run (window.BLUEPRINTS) — danno CONTENUTO nuovo, non solo numeri.
class ShopScene extends Phaser.Scene {
  constructor() { super('ShopScene'); }

  create() {
    const W = window.CONFIG.WIDTH, H = window.CONFIG.HEIGHT, C = window.CONFIG.COLORS;
    const T = window.I18n;

    // Sfondo
    const g = this.add.graphics();
    g.fillStyle(C.bgBottom, 1); g.fillRect(0, 0, W, H);
    g.fillStyle(0x000000, 0.4); g.fillRect(0, 0, W, H);

    this.add.text(W / 2, 36, T.t('shop_title'), {
      fontFamily: 'monospace', fontSize: '34px', color: '#ffd166',
      stroke: '#14161f', strokeThickness: 6,
    }).setOrigin(0.5);

    this.bankText = this.add.text(W / 2, 72, '', {
      fontFamily: 'monospace', fontSize: '18px', color: '#fff7e8',
      stroke: '#14161f', strokeThickness: 4,
    }).setOrigin(0.5);

    // Due colonne
    const colW = 440;
    const leftX = W / 2 - 232, rightX = W / 2 + 232;

    // Intestazioni di colonna
    this.add.text(leftX, 106, T.t('shop_stats_title'), {
      fontFamily: 'monospace', fontSize: '20px', color: '#ffe2b0', stroke: '#14161f', strokeThickness: 4,
    }).setOrigin(0.5);
    this.add.text(rightX, 106, T.t('shop_bp_title'), {
      fontFamily: 'monospace', fontSize: '20px', color: '#9fe6a0', stroke: '#14161f', strokeThickness: 4,
    }).setOrigin(0.5);
    this.add.text(rightX, 126, T.t('shop_bp_hint'), {
      fontFamily: 'monospace', fontSize: '12px', color: '#cdeccb',
    }).setOrigin(0.5);

    const startY = 168, rowH = 72;

    // --- Colonna POTENZIAMENTI (stat ripetibili) ---
    const statIds = ['hp', 'dmg', 'speed', 'djump'];
    const U = window.UNLOCKS;
    statIds.forEach((id, i) => {
      const item = U[id];
      const lv = window.Meta.unlockLevel(id);
      const maxed = lv >= item.max;
      const cost = item.base + item.step * lv;
      const lvLabel = item.max > 1 ? T.t('shop_lv', { lv: lv, max: item.max })
        : (lv > 0 ? T.t('shop_owned') : T.t('shop_notowned'));
      this.makeRow(leftX, startY + i * rowH, colW, {
        name: T.t('unlock_' + id + '_name'),
        sub: T.t('unlock_' + id + '_eff', { n: item.per }) + '  ·  ' + lvLabel,
        done: maxed,
        doneLabel: T.t('shop_max'),
        cost: cost,
        buyLabel: T.t('shop_buy', { cost: cost }),
        onBuy: () => this.buyStat(id),
      });
    });

    // --- Colonna PROGETTI (blueprint: sblocchi una-tantum di abilità) ---
    // Sono 8 (F.1c ne ha aggiunti 4 ai 4 originali): righe piu' basse/compatte di quelle a
    // sinistra (solo 4) per starci tutte senza scorrimento, che qui non esiste.
    const bpIds = ['magnet', 'blast', 'splash', 'companion', 'backshot', 'rage', 'stunshot', 'slam'];
    const BP = window.BLUEPRINTS;
    const bpStartY = 152, bpRowH = 44;
    bpIds.forEach((id, i) => {
      const item = BP[id];
      const owned = window.Meta.unlockLevel(id) > 0;
      this.makeRow(rightX, bpStartY + i * bpRowH, colW, {
        name: T.t('bp_' + id + '_name'),
        sub: T.t('bp_' + id + '_desc'),
        accent: '#9fe6a0',
        done: owned,
        doneLabel: T.t('shop_bp_done'),
        cost: item.cost,
        buyLabel: T.t('shop_unlock', { cost: item.cost }),
        onBuy: () => this.buyBlueprint(id),
        panelH: 38, nameSize: 13, subSize: 10,
      });
    });

    // Pulsante indietro
    const back = this.add.text(W / 2, H - 30, T.t('shop_back'), {
      fontFamily: 'monospace', fontSize: '20px', color: '#14161f',
      backgroundColor: '#ffd166', padding: { x: 20, y: 9 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    back.on('pointerover', () => back.setStyle({ backgroundColor: '#ffe199' }));
    back.on('pointerout', () => back.setStyle({ backgroundColor: '#ffd166' }));
    back.on('pointerdown', () => this.toMenu());

    // Pulsante AZZERA PROGRESSI (in basso a destra) con conferma a DUE tocchi, cosi' non si
    // cancella per sbaglio: 1o tocco arma ("Sicuro?"), 2o tocco entro 3s azzera davvero.
    this._resetArmed = false;
    const reset = this.add.text(W - 120, H - 30, T.t('shop_reset'), {
      fontFamily: 'monospace', fontSize: '15px', color: '#ffd9d9',
      backgroundColor: '#6a3030', padding: { x: 12, y: 8 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    reset.on('pointerdown', () => {
      if (!this._resetArmed) {
        this._resetArmed = true;
        reset.setText(T.t('shop_reset_confirm')).setStyle({ backgroundColor: '#b03030', color: '#ffffff' });
        this._resetTimer = this.time.delayedCall(3000, () => {
          this._resetArmed = false;
          if (reset.active) reset.setText(T.t('shop_reset')).setStyle({ backgroundColor: '#6a3030', color: '#ffd9d9' });
        });
      } else {
        if (this._resetTimer) this._resetTimer.remove();
        window.Meta.resetAll();
        window.Sfx.unlock();
        this.scene.restart();   // ridisegna il negozio azzerato (banca 0, sblocchi vuoti)
      }
    });

    // Tastiera: 1-4 comprano i potenziamenti; ESC esce. (I progetti sono solo cliccabili.)
    this.input.keyboard.on('keydown-ONE', () => this.buyStat('hp'));
    this.input.keyboard.on('keydown-TWO', () => this.buyStat('dmg'));
    this.input.keyboard.on('keydown-THREE', () => this.buyStat('speed'));
    this.input.keyboard.on('keydown-FOUR', () => this.buyStat('djump'));
    this.input.keyboard.on('keydown-ESC', () => this.toMenu());

    this.refreshBank();
  }

  // Una riga di negozio (potenziamento o progetto): pannello + nome + sottotitolo + pulsante.
  // panelH/nameSize/subSize opzionali (default = colonna POTENZIAMENTI): la colonna PROGETTI,
  // che ha piu' voci, passa valori piu' compatti per starci senza scorrimento.
  makeRow(x, y, w, o) {
    const T = window.I18n;
    const panelW = w - 16, panelH = o.panelH || 58;
    const nameSize = o.nameSize || 18, subSize = o.subSize || 12;
    const lineGap = Math.min(13, panelH * 0.22);
    this.add.rectangle(x, y, panelW, panelH, 0x2b1d12, 1).setStrokeStyle(3, o.accent === '#9fe6a0' ? 0x6fbf6f : 0xffd166);

    const textX = x - panelW / 2 + 14;
    this.add.text(textX, y - lineGap, o.name, {
      fontFamily: 'monospace', fontSize: nameSize + 'px', color: o.accent || '#ffe2b0',
      wordWrap: { width: panelW - 130 },
    }).setOrigin(0, 0.5);
    this.add.text(textX, y + lineGap, o.sub, {
      fontFamily: 'monospace', fontSize: subSize + 'px', color: '#fff7e8',
      wordWrap: { width: panelW - 130 },
    }).setOrigin(0, 0.5);

    // Pulsante / stato a destra
    const bx = x + panelW / 2 - 62;
    const enough = window.Meta.get().bank >= o.cost;
    let label, bg, fg, clickable = false;
    if (o.done) { label = o.doneLabel; bg = '#5a4a2a'; fg = '#cabfa0'; }
    else if (enough) { label = o.buyLabel; bg = '#ffd166'; fg = '#14161f'; clickable = true; }
    else { label = T.t('shop_need', { cost: o.cost }); bg = '#6a3030'; fg = '#ffd9d9'; }

    const btn = this.add.text(bx, y, label, {
      fontFamily: 'monospace', fontSize: (o.panelH ? 11 : 14) + 'px', color: fg, align: 'center',
      backgroundColor: bg, padding: { x: o.panelH ? 8 : 12, y: o.panelH ? 4 : 7 },
    }).setOrigin(0.5);

    if (clickable) {
      btn.setInteractive({ useHandCursor: true });
      btn.on('pointerover', () => btn.setStyle({ backgroundColor: '#ffe199' }));
      btn.on('pointerout', () => btn.setStyle({ backgroundColor: '#ffd166' }));
      btn.on('pointerdown', o.onBuy);
    }
  }

  buyStat(id) {
    const item = window.UNLOCKS[id];
    const lv = window.Meta.unlockLevel(id);
    if (lv >= item.max) { window.Sfx.hurt(); return; }   // gia al massimo
    const cost = item.base + item.step * lv;
    if (!window.Meta.spend(cost)) { window.Sfx.hurt(); return; }  // cerume insufficiente
    window.Meta.setUnlock(id, lv + 1);
    window.Sfx.pick();
    this.scene.restart();   // ridisegna con i nuovi valori
  }

  buyBlueprint(id) {
    const item = window.BLUEPRINTS[id];
    if (window.Meta.unlockLevel(id) > 0) { window.Sfx.hurt(); return; }   // gia sbloccato
    if (!window.Meta.spend(item.cost)) { window.Sfx.hurt(); return; }     // cerume insufficiente
    window.Meta.setUnlock(id, 1);
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
window.ShopScene = ShopScene;
