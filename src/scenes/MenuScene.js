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

    this.add.text(W / 2, 150, 'La Guerra del Cerume', {
      fontFamily: 'monospace', fontSize: '22px', color: '#ffe2b0',
      stroke: '#14161f', strokeThickness: 4,
    }).setOrigin(0.5);

    // Mascotte
    const guy = this.add.sprite(W / 2 - 150, 320, 'player_a').setScale(2.4);
    this.tweens.add({ targets: guy, y: '-=10', duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    const blob = this.add.sprite(W / 2 + 150, 330, 'enemy_blob').setScale(2.4);
    this.tweens.add({ targets: blob, scaleY: 2.1, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

    const controls = [
      'COMANDI',
      'Muoviti:  A / D  o  frecce',
      'Salta:    W / Spazio / Su',
      'Attacca:  J  o  click sinistro',
      'Scatto:   Shift  (se sbloccato)',
      '',
      'Demolisci tutto il muro di cerume per vincere il livello.',
      'A fine livello sblocchi una nuova abilita o arma.',
    ];
    this.add.text(W / 2, 408, controls.join('\n'), {
      fontFamily: 'monospace', fontSize: '17px', color: '#fff7e8', align: 'center',
      stroke: '#14161f', strokeThickness: 3, lineSpacing: 4,
    }).setOrigin(0.5);

    const start = this.add.text(W / 2, 510, '» PREMI INVIO O CLICCA PER INIZIARE «', {
      fontFamily: 'monospace', fontSize: '20px', color: '#ffd166',
      stroke: '#14161f', strokeThickness: 4,
    }).setOrigin(0.5);
    this.tweens.add({ targets: start, alpha: 0.3, duration: 600, yoyo: true, repeat: -1 });

    const begin = () => {
      window.Sfx.unlock();
      window.GameState.reset();
      this.scene.start('GameScene');
    };
    this.input.keyboard.once('keydown-ENTER', begin);
    this.input.keyboard.once('keydown-SPACE', begin);
    this.input.once('pointerdown', begin);
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
