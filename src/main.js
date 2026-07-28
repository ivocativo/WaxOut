// Configurazione Phaser e avvio del gioco.
window.addEventListener('load', function () {
  // LARGHEZZA ADATTIVA allo schermo: il gioco resta alto 540 (fisso), ma la larghezza si
  // adegua alla proporzione del dispositivo, cosi' riempie tutto lo schermo — niente piu'
  // bande nere ai lati sui telefoni piu' larghi del 16:9 (mostra solo un po' piu' di
  // corridoio in orizzontale, ideale per uno sparatutto a scorrimento). Tutto il layout del
  // gioco usa CONFIG.WIDTH, quindi si riposiziona da solo. Va calcolata PRIMA di creare il
  // gioco. La proporzione e' sempre quella "orizzontale" (lato lungo/lato corto), cosi' non
  // dipende da come e' ruotato il telefono; con un limite per evitare estremi (da 3:2 a ~21.6:9).
  const longSide = Math.max(window.innerWidth, window.innerHeight);
  const shortSide = Math.min(window.innerWidth, window.innerHeight) || 1;
  const aspect = Math.min(Math.max(longSide / shortSide, 1.5), 2.4);
  window.CONFIG.WIDTH = Math.round(window.CONFIG.HEIGHT * aspect);

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
    scene: [BootScene, MenuScene, GameScene, UpgradeScene, DoorScene, VictoryScene, PauseScene, ShopScene, ArmiScene],
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
