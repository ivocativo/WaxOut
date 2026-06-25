// ShopScene: negozio tra una run e l'altra. Si spende il cerume in banca per
// potenziamenti PERMANENTI che valgono per tutte le run future.
class ShopScene extends Phaser.Scene {
  constructor() { super('ShopScene'); }

  create() {
    const W = window.CONFIG.WIDTH, H = window.CONFIG.HEIGHT, C = window.CONFIG.COLORS;

    // Sfondo
    const g = this.add.graphics();
    g.fillStyle(C.bgBottom, 1); g.fillRect(0, 0, W, H);
    g.fillStyle(0x000000, 0.35); g.fillRect(0, 0, W, H);

    this.add.text(W / 2, 46, 'NEGOZIO DEL CERUME', {
      fontFamily: 'monospace', fontSize: '40px', color: '#ffd166',
      stroke: '#14161f', strokeThickness: 7,
    }).setOrigin(0.5);

    const meta = window.Meta.get();
    this.bankText = this.add.text(W / 2, 88, '', {
      fontFamily: 'monospace', fontSize: '20px', color: '#fff7e8',
      stroke: '#14161f', strokeThickness: 4,
    }).setOrigin(0.5);

    // Righe potenziamenti
    const ids = ['hp', 'dmg', 'speed', 'djump'];
    const U = window.UNLOCKS;
    const rowH = 78, startY = 150, rowW = 720, x = W / 2;

    ids.forEach((id, i) => {
      const item = U[id];
      const y = startY + i * rowH;
      const lv = window.Meta.unlockLevel(id);
      const maxed = lv >= item.max;
      const cost = item.base + item.step * lv;

      // pannello
      this.add.rectangle(x, y, rowW, rowH - 14, 0x2b1d12, 1)
        .setStrokeStyle(3, 0xffd166);

      // nome + effetto (sinistra)
      this.add.text(x - rowW / 2 + 18, y - 16, (i + 1) + '. ' + item.name, {
        fontFamily: 'monospace', fontSize: '20px', color: '#ffe2b0',
      }).setOrigin(0, 0.5);
      this.add.text(x - rowW / 2 + 18, y + 12, item.effect, {
        fontFamily: 'monospace', fontSize: '15px', color: '#fff7e8',
      }).setOrigin(0, 0.5);

      // livello (centro-destra)
      const lvLabel = item.max > 1 ? ('Liv. ' + lv + '/' + item.max) : (lv > 0 ? 'Acquistato' : 'Non posseduto');
      this.add.text(x + rowW / 2 - 220, y, lvLabel, {
        fontFamily: 'monospace', fontSize: '15px', color: '#ffeccb',
      }).setOrigin(0.5);

      // pulsante acquisto (destra)
      this.makeBuyButton(x + rowW / 2 - 90, y, id, item, lv, cost, maxed);
    });

    // Pulsante indietro
    const back = this.add.text(W / 2, H - 40, 'INDIETRO (ESC)', {
      fontFamily: 'monospace', fontSize: '22px', color: '#14161f',
      backgroundColor: '#ffd166', padding: { x: 22, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    back.on('pointerover', () => back.setStyle({ backgroundColor: '#ffe199' }));
    back.on('pointerout', () => back.setStyle({ backgroundColor: '#ffd166' }));
    back.on('pointerdown', () => this.toMenu());

    // Tastiera: 1-4 per comprare, ESC per uscire
    this.input.keyboard.on('keydown-ONE', () => this.buy('hp'));
    this.input.keyboard.on('keydown-TWO', () => this.buy('dmg'));
    this.input.keyboard.on('keydown-THREE', () => this.buy('speed'));
    this.input.keyboard.on('keydown-FOUR', () => this.buy('djump'));
    this.input.keyboard.on('keydown-ESC', () => this.toMenu());

    this.refreshBank();
  }

  makeBuyButton(x, y, id, item, lv, cost, maxed) {
    const enough = window.Meta.get().bank >= cost;
    let label, bg, fg;
    if (maxed) { label = 'MAX'; bg = '#5a4a2a'; fg = '#cabfa0'; }
    else if (enough) { label = 'COMPRA\n' + cost; bg = '#ffd166'; fg = '#14161f'; }
    else { label = cost + ' cerume'; bg = '#6a3030'; fg = '#ffd9d9'; }

    const btn = this.add.text(x, y, label, {
      fontFamily: 'monospace', fontSize: '15px', color: fg, align: 'center',
      backgroundColor: bg, padding: { x: 14, y: 8 },
    }).setOrigin(0.5);

    if (!maxed && enough) {
      btn.setInteractive({ useHandCursor: true });
      btn.on('pointerover', () => btn.setStyle({ backgroundColor: '#ffe199' }));
      btn.on('pointerout', () => btn.setStyle({ backgroundColor: '#ffd166' }));
      btn.on('pointerdown', () => this.buy(id));
    }
  }

  buy(id) {
    const item = window.UNLOCKS[id];
    const lv = window.Meta.unlockLevel(id);
    if (lv >= item.max) { window.Sfx.hurt(); return; }   // gia al massimo
    const cost = item.base + item.step * lv;
    if (!window.Meta.spend(cost)) { window.Sfx.hurt(); return; }  // cerume insufficiente
    window.Meta.setUnlock(id, lv + 1);
    window.Sfx.pick();
    this.scene.restart();   // ridisegna con i nuovi valori
  }

  refreshBank() {
    const meta = window.Meta.get();
    this.bankText.setText('Cerume in banca: ' + meta.bank + '   |   Miglior livello: ' + meta.bestLevel);
  }

  toMenu() {
    window.Sfx.unlock();
    this.scene.start('MenuScene');
  }
}
window.ShopScene = ShopScene;
