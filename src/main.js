// Configurazione Phaser e avvio del gioco.
window.addEventListener('load', function () {
  const config = {
    type: Phaser.AUTO,
    width: window.CONFIG.WIDTH,
    height: window.CONFIG.HEIGHT,
    parent: 'game',
    backgroundColor: '#c6876a',
    pixelArt: true,
    roundPixels: true,
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { y: window.CONFIG.GRAVITY },
        debug: false,
      },
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [BootScene, MenuScene, GameScene, UpgradeScene],
  };

  window.game = new Phaser.Game(config);
});
