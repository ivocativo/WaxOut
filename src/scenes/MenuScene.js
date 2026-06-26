// MenuScene: titolo, istruzioni, avvio partita.
class MenuScene extends Phaser.Scene {
  constructor() { super('MenuScene'); }

  create() {
    const W = window.CONFIG.WIDTH;
    const H = window.CONFIG.HEIGHT;
    const C = window.CONFIG.COLORS;

    // Sfondo "condotto uditivo"
    this.drawBackground();

    this.add.text(W / 2, 96, 'EARWAX WAR', {
      fontFamily: 'monospace', fontSize: '64px', color: '#fdf0d5',
      stroke: '#14161f', strokeThickness: 8,
    }).setOrigin(0.5);

    const T = window.I18n;

    this.add.text(W / 2, 150, T.t('menu_subtitle'), {
      fontFamily: 'monospace', fontSize: '22px', color: '#ffe2b0',
      stroke: '#14161f', strokeThickness: 4,
    }).setOrigin(0.5);

    // Banca permanente (roguelike): cerume accumulato + record
    const meta = window.Meta.get();
    this.add.text(W / 2, 184, T.t('menu_bank', { bank: meta.bank, best: meta.bestLevel }), {
      fontFamily: 'monospace', fontSize: '16px', color: '#ffd166',
      stroke: '#14161f', strokeThickness: 3,
    }).setOrigin(0.5);

    // Mascotte
    const guy = this.add.sprite(W / 2 - 150, 320, 'player_a').setScale(2.4);
    this.tweens.add({ targets: guy, y: '-=10', duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    const blob = this.add.sprite(W / 2 + 150, 330, 'enemy_blob').setScale(2.4);
    this.tweens.add({ targets: blob, scaleY: 2.1, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

    const controls = [
      T.t('menu_ctrl_title'),
      T.t('menu_ctrl_move'),
      T.t('menu_ctrl_jump'),
      T.t('menu_ctrl_attack'),
      T.t('menu_ctrl_dash'),
      T.t('menu_ctrl_touch'),
      '',
      T.t('menu_goal_1'),
      T.t('menu_goal_2'),
    ];
    this.add.text(W / 2, 386, controls.join('\n'), {
      fontFamily: 'monospace', fontSize: '17px', color: '#fff7e8', align: 'center',
      stroke: '#14161f', strokeThickness: 3, lineSpacing: 2,
    }).setOrigin(0.5);

    const mkBtn = (x, label, onTap) => {
      const t = this.add.text(x, 508, label, {
        fontFamily: 'monospace', fontSize: '20px', color: '#14161f',
        backgroundColor: '#ffd166', padding: { x: 18, y: 10 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      t.on('pointerover', () => t.setStyle({ backgroundColor: '#ffe199' }));
      t.on('pointerout', () => t.setStyle({ backgroundColor: '#ffd166' }));
      t.on('pointerdown', onTap);
      return t;
    };

    const begin = () => { window.Sfx.unlock(); window.GameState.reset(); this.scene.start('GameScene'); };
    const openShop = () => { window.Sfx.unlock(); this.scene.start('ShopScene'); };

    const startBtn = mkBtn(W / 2 - 110, T.t('menu_start'), begin);
    this.tweens.add({ targets: startBtn, alpha: 0.55, duration: 650, yoyo: true, repeat: -1 });
    mkBtn(W / 2 + 110, T.t('menu_shop'), openShop);

    // Selettore lingua: in alto a destra; toccarlo cambia lingua e ridisegna.
    const langBtn = this.add.text(W - 16, 16, T.t('menu_lang', { lang: T.nativeName(T.lang) }), {
      fontFamily: 'monospace', fontSize: '15px', color: '#14161f',
      backgroundColor: '#ffd166', padding: { x: 12, y: 7 },
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    langBtn.on('pointerover', () => langBtn.setStyle({ backgroundColor: '#ffe199' }));
    langBtn.on('pointerout', () => langBtn.setStyle({ backgroundColor: '#ffd166' }));
    langBtn.on('pointerdown', () => { window.Sfx.unlock(); T.next(); this.scene.restart(); });

    this.input.keyboard.once('keydown-ENTER', begin);
    this.input.keyboard.once('keydown-SPACE', begin);
    this.input.keyboard.once('keydown-N', openShop);
  }

  drawBackground() {
    const W = window.CONFIG.WIDTH;
    const H = window.CONFIG.HEIGHT;
    const C = window.CONFIG.COLORS;
    const g = this.add.graphics();
    const steps = 24;
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      const col = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.IntegerToColor(C.bgTop),
        Phaser.Display.Color.IntegerToColor(C.bgBottom), steps - 1, i);
      g.fillStyle(Phaser.Display.Color.GetColor(col.r, col.g, col.b), 1);
      g.fillRect(0, Math.floor(t * H), W, Math.ceil(H / steps) + 1);
    }
    // pieghe del condotto
    g.fillStyle(C.canalShade, 0.18);
    for (let i = 0; i < 5; i++) g.fillEllipse(W / 2, 120 + i * 90, W * (1 - i * 0.12), 60);
  }
}
window.MenuScene = MenuScene;
