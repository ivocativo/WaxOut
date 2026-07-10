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
    scene: [BootScene, MenuScene, GameScene, UpgradeScene, PauseScene, ShopScene],
  };

  window.game = new Phaser.Game(config);

  // Ridimensionamento su ROTAZIONE del telefono: al cambio orientamento il browser
  // mobile riporta le dimensioni "vecchie" per un istante, quindi Phaser adatta il
  // canvas alla misura sbagliata e la schermata resta tagliata. Forziamo un nuovo
  // "fit" subito E dopo brevi ritardi, quando le dimensioni reali si sono assestate.
  function refit() {
    if (window.game && window.game.scale) window.game.scale.refresh();
  }
  window.addEventListener('resize', function () { refit(); setTimeout(refit, 250); });
  window.addEventListener('orientationchange', function () {
    refit(); setTimeout(refit, 250); setTimeout(refit, 600);
  });
  if (window.visualViewport) window.visualViewport.addEventListener('resize', refit);
});
