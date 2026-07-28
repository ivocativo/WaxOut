// PauseScene: overlay di pausa mostrato sopra il gioco.
// Viene avviata con this.scene.launch('PauseScene', { from: 'GameScene' })
// mentre la scena di gioco resta in pausa sotto di essa.
class PauseScene extends Phaser.Scene {
  constructor() { super('PauseScene'); }

  create(data) {
    const W = window.CONFIG.WIDTH, H = window.CONFIG.HEIGHT;
    this.fromKey = (data && data.from) || 'GameScene';

    // Velo scuro sopra il gioco congelato (non troppo: altrimenti il pavimento,
    // color sabbia, si confonde con le pareti e sembra sparito).
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.45).setScrollFactor(0);

    const T = window.I18n;

    this.add.text(W / 2, H / 2 - 120, T.t('pause_title'), {
      fontFamily: 'monospace', fontSize: '46px', color: '#ffd166',
      stroke: '#14161f', strokeThickness: 7,
    }).setOrigin(0.5);

    this.add.text(W / 2, H / 2 - 74, T.t('pause_hint'), {
      fontFamily: 'monospace', fontSize: '15px', color: '#fff7e8',
      stroke: '#14161f', strokeThickness: 3,
    }).setOrigin(0.5);

    this.mkButton(W / 2, H / 2 - 18, T.t('pause_resume'), () => this.resumeGame());
    this.mkButton(W / 2, H / 2 + 42, T.t('pause_restart'), () => this.restartLevel());
    this.mkButton(W / 2, H / 2 + 102, T.t('pause_menu'), () => this.toMenu());

    // PANNELLO DI PROVA (⚠️ da togliere prima di pubblicare, vedi src/taratura.js). Qui e non
    // solo nel menu perche' i numeri si giudicano mentre si gioca: la pausa DORME sotto e la
    // partita riprende da dove stava. Piccolo e in un angolo: non e' roba da giocatore.
    const tar = this.add.text(W - 12, H - 10, T.t('tar_open'), {
      fontFamily: 'monospace', fontSize: '11px', color: '#ffd9d9',
      backgroundColor: '#6a3030', padding: { x: 8, y: 5 },
    }).setOrigin(1, 1).setScrollFactor(0).setInteractive({ useHandCursor: true });
    tar.on('pointerdown', () => {
      window.Sfx.pick();
      this.scene.launch('TaraturaScene', { from: 'PauseScene' });
      this.scene.sleep();
    });

    // Controlli audio: volume (cicla pieno/basso/muto) e musica on/off.
    window.Sfx.addAudioButton(this, W / 2 - 26, H / 2 + 162);
    window.Sfx.addMusicButton(this, W / 2 + 26, H / 2 + 162);

    // Scorciatoie da tastiera
    this.input.keyboard.on('keydown-ESC', () => this.resumeGame());
    this.input.keyboard.on('keydown-P', () => this.resumeGame());

    window.Sfx.pick();
  }

  mkButton(x, y, label, onTap) {
    const t = this.add.text(x, y, label, {
      fontFamily: 'monospace', fontSize: '22px', color: '#14161f',
      backgroundColor: '#ffd166', padding: { x: 22, y: 11 }, align: 'center',
    }).setOrigin(0.5).setScrollFactor(0).setInteractive({ useHandCursor: true });
    t.on('pointerover', () => t.setStyle({ backgroundColor: '#ffe199' }));
    t.on('pointerout', () => t.setStyle({ backgroundColor: '#ffd166' }));
    t.on('pointerdown', () => { window.Sfx.pick(); onTap(); });
    return t;
  }

  resumeGame() {
    window.Sfx.unlock();
    this.scene.resume(this.fromKey);
    this.scene.stop();
  }

  restartLevel() {
    const g = this.scene.get(this.fromKey);
    this.scene.stop();
    g.scene.restart();
  }

  toMenu() {
    const g = this.scene.get(this.fromKey);
    g.scene.stop();
    // Abbandonare la run incassa comunque il cerume raccolto finora.
    if (window.Meta) window.Meta.bankRun(window.GameState.wax, window.GameState.level);
    window.GameState.reset();
    this.scene.start('MenuScene');
  }
}
window.PauseScene = PauseScene;
