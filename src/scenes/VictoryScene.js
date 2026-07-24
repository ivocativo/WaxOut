// VictoryScene: schermata di VITTORIA (round A, A.1) — si arriva qui SOLO completando
// window.CONFIG.RUN_LEVELS livelli in una run (vedi UpgradeScene.choose). Prima d'ora una
// partita poteva finire solo con la morte: e' il buco piu' grande individuato nella ricerca
// sulle best practice del genere (vedi HANDOFF.md §Principi di design) — senza un finale non
// e' possibile nemmeno la meccanica di ritenzione piu' forte del genere (difficolta' crescente
// sbloccata dalla vittoria, round A, A.5, non ancora fatta).
class VictoryScene extends Phaser.Scene {
  constructor() { super('VictoryScene'); }

  // Dati passati da UpgradeScene.choose(): { earned, bank, levels }.
  init(data) { this.runResult = data || {}; }

  create() {
    const W = window.CONFIG.WIDTH, H = window.CONFIG.HEIGHT;
    const T = window.I18n;

    // Stesso fondale pixel-art usato da MenuScene (drawBackground ha gia' un ripiego se il
    // set di sfondo a strati non e' disponibile, quindi e' sicuro riusarlo qui).
    window.GameGfx.drawBackground(this);
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.4).setDepth(-13);

    this.add.rectangle(W / 2, H / 2 - 30, 560, 220, 0x000000, 0.35).setStrokeStyle(2, 0xffd166, 0.4);

    const title = this.add.text(W / 2, H / 2 - 110, T.t('victory_title'), {
      fontFamily: 'monospace', fontSize: '38px', color: '#ffd166',
      stroke: '#14161f', strokeThickness: 7, align: 'center',
    }).setOrigin(0.5);
    this.tweens.add({ targets: title, y: '-=6', duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

    const levels = this.runResult.levels || window.CONFIG.RUN_LEVELS;
    this.add.text(W / 2, H / 2 - 62, T.t('victory_sub', { n: levels }), {
      fontFamily: 'monospace', fontSize: '19px', color: '#fff7e8',
      stroke: '#14161f', strokeThickness: 4,
    }).setOrigin(0.5);

    const earned = this.runResult.earned || 0;
    const bank = (this.runResult.bank != null) ? this.runResult.bank : window.Meta.get().bank;
    this.add.text(W / 2, H / 2 - 20, T.t('victory_stat_wax', { earned: earned, bank: bank }), {
      fontFamily: 'monospace', fontSize: '16px', color: '#ffd166',
      stroke: '#14161f', strokeThickness: 3,
    }).setOrigin(0.5);

    // Tempo REALE della run (orologio di sistema, non quello di gioco): mm:ss.
    const elapsedMs = Math.max(0, Date.now() - (window.GameState.runStartAt || Date.now()));
    const totS = Math.floor(elapsedMs / 1000);
    const mm = Math.floor(totS / 60), ss = totS % 60;
    const timeStr = mm + ':' + (ss < 10 ? '0' : '') + ss;
    this.add.text(W / 2, H / 2 + 16, T.t('victory_stat_time', { time: timeStr }), {
      fontFamily: 'monospace', fontSize: '16px', color: '#fff7e8',
      stroke: '#14161f', strokeThickness: 3,
    }).setOrigin(0.5);

    // Grado di INFEZIONE sbloccato con questa vittoria (round A, A.5): l'invito a rigiocare piu'
    // duro. Solo se `sbloccato` (un grado nuovo raggiunto, sotto il tetto): lo si sceglie dal menu.
    if (this.runResult.sbloccato) {
      this.add.text(W / 2, H / 2 + 48, T.t('victory_inf_unlocked', { n: this.runResult.sbloccato }), {
        fontFamily: 'monospace', fontSize: '16px', color: '#ff9a8a',
        stroke: '#14161f', strokeThickness: 3, align: 'center',
      }).setOrigin(0.5);
    }

    // Pulsanti (stesso linguaggio di MenuScene/gameOver).
    const mkBtn = (x, y, label, onTap, w) => {
      w = w || 190;
      const shadow = this.add.rectangle(x + 3, y + 4, w, 46, 0x000000, 0.35);
      const panel = this.add.rectangle(x, y, w, 46, 0xffd166, 1).setStrokeStyle(3, 0x8a5a1a, 0.9);
      const label_ = this.add.text(x, y, label, {
        fontFamily: 'monospace', fontSize: '19px', color: '#14161f',
      }).setOrigin(0.5);
      const hit = this.add.rectangle(x, y, w, 46, 0xffffff, 0).setInteractive({ useHandCursor: true });
      hit.on('pointerover', () => panel.setFillStyle(0xffe199, 1));
      hit.on('pointerout', () => panel.setFillStyle(0xffd166, 1));
      hit.on('pointerdown', onTap);
      return { shadow, panel, label: label_, hit };
    };

    const newRun = () => { window.Sfx.unlock(); window.GameState.reset(); this.scene.start('GameScene'); };
    const toMenu = () => { window.Sfx.unlock(); window.GameState.reset(); this.scene.start('MenuScene'); };

    mkBtn(W / 2 - 110, H / 2 + 110, T.t('victory_newrun'), newRun, 200);
    mkBtn(W / 2 + 110, H / 2 + 110, T.t('victory_menu'), toMenu, 200);

    this.input.keyboard.once('keydown-ENTER', newRun);
    this.input.keyboard.once('keydown-SPACE', newRun);

    window.Sfx.win();
    window.Sfx.setMusic('menu');
  }
}
window.VictoryScene = VictoryScene;
