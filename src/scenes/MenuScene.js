// MenuScene: titolo, avvio partita. RIDISEGNATA nel round 2 (H.1): prima la schermata
// principale era affollata (titolo+sottotitolo+banca+2 mascotte+9 righe di comandi/obiettivo
// tutti insieme) e lo sfondo era un gradiente+ellissi disegnati a mano, poco coerente col resto
// del gioco. Ora: sfondo VERO (stesso fondale carnoso pixel-art usato in partita), schermata
// principale alleggerita (comandi/obiettivo spostati in un pannello "?" a comparsa), pulsanti
// piu' curati (bordo + ombra, stesso linguaggio del negozio ma un po' piu' rifinito).
class MenuScene extends Phaser.Scene {
  constructor() { super('MenuScene'); }

  create() {
    const W = window.CONFIG.WIDTH;
    const H = window.CONFIG.HEIGHT;
    const T = window.I18n;

    // Sfondo VERO del condotto (lo stesso fondale pixel-art usato in GameScene), + un velo
    // scuro per far risaltare i testi sopra — stessa tecnica gia' usata in UpgradeScene.
    window.GameGfx.drawBackground(this);
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.32).setDepth(-13);

    // Pannello dietro a titolo/sottotitolo/banca: li raggruppa visivamente e aiuta la leggibilita'
    // sul fondale ora "vero" (piu' movimentato del vecchio gradiente piatto).
    this.add.rectangle(W / 2, 108, 620, 168, 0x000000, 0.3).setStrokeStyle(2, 0xffd166, 0.35).setDepth(-1);

    const title = this.add.text(W / 2, 66, 'EARWAX WAR', {
      fontFamily: 'monospace', fontSize: '60px', color: '#fdf0d5',
      stroke: '#14161f', strokeThickness: 8,
    }).setOrigin(0.5);
    this.tweens.add({ targets: title, y: '-=6', duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

    this.add.text(W / 2, 118, T.t('menu_subtitle'), {
      fontFamily: 'monospace', fontSize: '22px', color: '#ffe2b0',
      stroke: '#14161f', strokeThickness: 4,
    }).setOrigin(0.5);

    // Banca permanente (roguelike): cerume accumulato + record
    const meta = window.Meta.get();
    this.add.text(W / 2, 154, T.t('menu_bank', { bank: meta.bank, best: meta.bestLevel }), {
      fontFamily: 'monospace', fontSize: '16px', color: '#ffd166',
      stroke: '#14161f', strokeThickness: 3,
    }).setOrigin(0.5);

    // Mascotte (spazio libero adesso: non piu' schiacciate contro il blocco comandi)
    const guy = this.add.sprite(W / 2 - 150, 300, 'player_a').setScale(2.6);
    this.tweens.add({ targets: guy, y: '-=12', duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    // Mascotte nemico: scala calcolata dalla texture (l'immagine AI e' molto piu' grande della
    // vecchia texture pixel — a scala fissa 2.6 sarebbe gigantesca). ~150px di altezza.
    const blob = this.add.sprite(W / 2 + 150, 320, 'enemy_blob');
    const bs = 150 / blob.height;
    blob.setScale(bs);
    // Striscia anche nel menu (l'animazione e' registrata da BootScene ed e' globale). Lo
    // schiacciamento a tween resta: da solo il ciclo e' volutamente sottile.
    if (this.anims.exists('blob_crawl')) blob.play('blob_crawl');
    this.tweens.add({ targets: blob, scaleY: bs * 0.9, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

    // Pulsante: rettangolo con bordo + ombra leggera (stesso linguaggio del negozio, un po'
    // piu' rifinito) invece del vecchio testo piatto su sfondo giallo pieno.
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

    const begin = () => { window.Sfx.unlock(); window.GameState.reset(); this.scene.start('GameScene'); };
    const openShop = () => { window.Sfx.unlock(); this.scene.start('ShopScene'); };

    const openArmi = () => { window.Sfx.unlock(); this.scene.start('ArmiScene'); };

    // Tre pulsanti invece di due (ARSENALE aggiunto il 2026-07-27): larghi 190 e distanziati 200
    // per restare comodi da toccare sul telefono senza uscire dai 960px.
    const startBtn = mkBtn(W / 2 - 200, 430, T.t('menu_start'), begin, 190);
    this.tweens.add({ targets: [startBtn.panel, startBtn.label], alpha: 0.6, duration: 650, yoyo: true, repeat: -1 });
    mkBtn(W / 2, 430, T.t('menu_armi'), openArmi, 190);
    mkBtn(W / 2 + 200, 430, T.t('menu_shop'), openShop, 190);

    // SELETTORE INFEZIONE (round A, A.5): compare solo dopo aver vinto almeno una volta (prima
    // infezioneUnlocked() vale 0 = solo il grado base, niente da scegliere). Frecce ◄ ►, tocco
    // ampio per il telefono. La scelta vive in window.GameState.infezione e NON viene azzerata da
    // reset(): begin() la conserva.
    const unlocked = window.Meta.infezioneUnlocked();
    if (unlocked >= 1) {
      // Clamp: se un reset dei progressi ha abbassato lo sblocco sotto il valore memorizzato.
      window.GameState.infezione = Phaser.Math.Clamp(window.GameState.infezione || 0, 0, unlocked);
      const iy = 384;
      const label = this.add.text(W / 2, iy, '', {
        fontFamily: 'monospace', fontSize: '18px', color: '#ff9a8a',
        stroke: '#14161f', strokeThickness: 3,
      }).setOrigin(0.5);
      const refresh = () => label.setText(T.t('menu_infezione', { n: window.GameState.infezione }));
      refresh();
      const arrow = (dx, chr) => {
        const a = this.add.text(W / 2 + dx, iy, chr, {
          fontFamily: 'monospace', fontSize: '22px', color: '#14161f',
          backgroundColor: '#ffd166', padding: { x: 12, y: 6 },
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        a.on('pointerover', () => a.setStyle({ backgroundColor: '#ffe199' }));
        a.on('pointerout', () => a.setStyle({ backgroundColor: '#ffd166' }));
        a.on('pointerdown', () => {
          window.Sfx.unlock();
          window.GameState.infezione = Phaser.Math.Clamp((window.GameState.infezione || 0) + dx / Math.abs(dx), 0, unlocked);
          refresh();
        });
        return a;
      };
      arrow(-96, '<');
      arrow(96, '>');
    } else {
      window.GameState.infezione = 0;   // non ancora sbloccato: sempre base
    }

    // PANNELLO DI PROVA (⚠️ da togliere prima di pubblicare, vedi src/taratura.js): in un angolo,
    // piccolo. Se una manopola e' stata girata lo dice, se no ci si dimentica di averlo fatto e
    // si giudica il gioco con numeri finti.
    const tarLabel = () => T.t('tar_open') + (window.Taratura.modificata() ? ' *' : '');
    const tarBtn = this.add.text(12, H - 10, tarLabel(), {
      fontFamily: 'monospace', fontSize: '11px',
      color: window.Taratura.modificata() ? '#ffffff' : '#ffd9d9',
      backgroundColor: window.Taratura.modificata() ? '#b03030' : '#6a3030',
      padding: { x: 8, y: 5 },
    }).setOrigin(0, 1).setInteractive({ useHandCursor: true });
    tarBtn.on('pointerdown', () => { window.Sfx.pick(); this.scene.start('TaraturaScene', { from: 'MenuScene' }); });

    // Pannello "?" con comandi/obiettivo, a comparsa (round 2, H.1): prima stava sempre in
    // vista (9 righe fisse), affollando la schermata principale — i comandi touch sono gia'
    // a schermo ed evidenti IN PARTITA, qui basta poterli ricontrollare a richiesta.
    const helpBtn = this.add.circle(W / 2, 486, 16, 0x000000, 0.35).setStrokeStyle(2, 0xffd166, 0.8)
      .setInteractive({ useHandCursor: true });
    this.add.text(W / 2, 486, '?', {
      fontFamily: 'monospace', fontSize: '18px', color: '#ffd166',
    }).setOrigin(0.5);
    let helpOpen = null;
    const closeHelp = () => { if (helpOpen) { helpOpen.destroy(); helpOpen = null; } };
    const openHelp = () => {
      if (helpOpen) return;
      window.Sfx.unlock();
      const group = this.add.container(0, 0).setDepth(200);
      const backdrop = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.62).setInteractive();
      const panelBg = window.GameGfx.panel(this, W / 2, H / 2, 640, 452, { accento: window.GameGfx.UI.ambraScura });
      const lines = [
        T.t('menu_ctrl_title'), '',
        T.t('menu_ctrl_move'), T.t('menu_ctrl_jump'), T.t('menu_ctrl_attack'),
        T.t('menu_ctrl_dash'), T.t('menu_ctrl_touch'), '',
        T.t('menu_goal_1'), T.t('menu_goal_2'),
      ];
      const body = this.add.text(W / 2, H / 2 - 100, lines.join('\n'), {
        fontFamily: 'monospace', fontSize: '15px', color: '#fff7e8', align: 'center',
        stroke: '#14161f', strokeThickness: 3, lineSpacing: 3, wordWrap: { width: 560 },
      }).setOrigin(0.5);

      // CREDITI (2026-07-28). Tutti i brani sono CC0 e non OBBLIGANO a citare nessuno, ma
      // l'autore di quello del menu lo chiede esplicitamente sulla sua scheda ("you are committed
      // to mention Rob Bery"), e chi regala musica merita il suo nome. Gli altri tre sono qui per
      // correttezza. Testo piccolo e spento: si legge se lo cerchi, non ruba spazio ai comandi.
      const righe = [
        T.t('credits_music'),
        T.t('credits_m1'), T.t('credits_m2'), T.t('credits_m3'), T.t('credits_m4'),
        '', T.t('credits_engine'),
      ];
      const sep = this.add.graphics();
      sep.fillStyle(window.GameGfx.UI.bordo, 0.6);
      sep.fillRect(W / 2 - 240, H / 2 + 32, 480, 1);
      const titoloCr = this.add.text(W / 2, H / 2 + 50, T.t('credits_title'), {
        fontFamily: 'monospace', fontSize: '12px', color: '#ffd166',
      }).setOrigin(0.5);
      const crediti = this.add.text(W / 2, H / 2 + 116, righe.join('\n'), {
        fontFamily: 'monospace', fontSize: '11px', color: '#c9a6b2', align: 'center', lineSpacing: 3,
        wordWrap: { width: 580 },
      }).setOrigin(0.5);

      const hint = this.add.text(W / 2, H / 2 + 212, T.t('menu_help_close'), {
        fontFamily: 'monospace', fontSize: '12px', color: '#cabfa0',
      }).setOrigin(0.5);
      group.add([backdrop, panelBg, body, sep, titoloCr, crediti, hint]);
      backdrop.on('pointerdown', closeHelp);
      helpOpen = group;
    };
    helpBtn.on('pointerdown', openHelp);

    // Selettore lingua: in alto a destra; toccarlo cambia lingua e ridisegna.
    const langBtn = this.add.text(W - 16, 16, T.t('menu_lang', { lang: T.nativeName(T.lang) }), {
      fontFamily: 'monospace', fontSize: '15px', color: '#14161f',
      backgroundColor: '#ffd166', padding: { x: 12, y: 7 },
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    langBtn.on('pointerover', () => langBtn.setStyle({ backgroundColor: '#ffe199' }));
    langBtn.on('pointerout', () => langBtn.setStyle({ backgroundColor: '#ffd166' }));
    langBtn.on('pointerdown', () => { window.Sfx.unlock(); T.next(); this.scene.restart(); });

    // Controlli audio: volume (cicla pieno/basso/muto) e musica on/off, in alto a sinistra.
    window.Sfx.addAudioButton(this, 28, 26);
    window.Sfx.addMusicButton(this, 68, 26);

    // Atmosfera musicale del menu (parte davvero al primo tocco, via unlock).
    window.Sfx.setMusic('menu');

    this.input.keyboard.once('keydown-ENTER', begin);
    this.input.keyboard.once('keydown-SPACE', begin);
    this.input.keyboard.once('keydown-N', openShop);
  }
}
window.MenuScene = MenuScene;
