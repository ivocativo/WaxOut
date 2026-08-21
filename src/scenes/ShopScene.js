// ShopScene: negozio tra una run e l'altra. Si spende il cerume in banca in DUE colonne:
// - POTENZIAMENTI (sinistra): bonus di statistica permanenti, ripetibili (window.UNLOCKS).
// - PROGETTI (destra): sblocchi una-tantum che aggiungono ABILITA' NUOVE al mazzo delle
//   run (window.BLUEPRINTS) — danno CONTENUTO nuovo, non solo numeri.
class ShopScene extends Phaser.Scene {
  constructor() { super('ShopScene'); }

  // Quale delle tre schermate mostrare. Arriva da un restart della scena: si puo' fare perche'
  // in create() non si tocca nessuno stato del giocatore.
  init(data) {
    this.pagina = Math.max(0, Math.min(2, (data && data.pagina) | 0));
  }

  // Cambio schermata, con i bordi CHIUSI (non circolari): scorrendo oltre l'ultima non si torna
  // alla prima. Girare in tondo fa perdere il senso di "dove sono" quando le schermate sono poche.
  vaiA(n) {
    const dove = Math.max(0, Math.min(2, n));
    if (dove === this.pagina) return;
    this.scene.restart({ pagina: dove });
  }

  create() {
    const W = window.CONFIG.WIDTH, H = window.CONFIG.HEIGHT, C = window.CONFIG.COLORS;
    const T = window.I18n;

    // Sfondo e titolo comuni a tutte le schermate di contorno (GameGfx.paintSceneBg/sceneTitle):
    // prima era un rettangolo marrone piatto della vecchia palette.
    window.GameGfx.paintSceneBg(this);
    window.GameGfx.sceneTitle(this, T.t('shop_title'), 34);

    this.bankText = this.add.text(W / 2, 72, '', {
      fontFamily: 'monospace', fontSize: '17px', color: '#ffe2b0',
    }).setOrigin(0.5);

    // ⚠️ TRE SCHERMATE, NON DUE COLONNE (2026-08-19, richiesta dell'utente). Con due colonne
    // strette ogni riga aveva meta' larghezza, e le etichette lunghe uscivano dal riquadro — e'
    // successo con "MAX · Infezione 0". A pagina intera lo spazio c'e', le righe respirano, e
    // soprattutto AGGIUNGERE UNA CATEGORIA IN FUTURO E' UNA VOCE IN PIU' IN QUESTO ELENCO,
    // non un rifacimento del layout. Si passa da una all'altra scorrendo il dito.
    // Su `this` perche' servono anche a disegnaPagina() e a vaiA(). Aggiungere una quarta
    // categoria domani e' una voce qui dentro, non un rifacimento.
    this.PAGINE = [
      { id: 'potenziamenti', titolo: T.t('shop_stats_title'), colore: '#ffd166' },
      { id: 'progetti',      titolo: T.t('shop_bp_title'),    colore: '#9fe6a0' },
      { id: 'leggendari',    titolo: T.t('shop_leg_title'),   colore: '#ffb347' },
    ];
    const PAGINE = this.PAGINE;
    // I pallini di posizione NON scorrono col contenuto: sono navigazione, devono stare fermi.
    this._pallini = PAGINE.map((v, i) => {
      const d = this.add.circle(W / 2 - (PAGINE.length - 1) * 9 + i * 18, 128, 5,
        0xfff7e8, i === this.pagina ? 0.95 : 0.28).setInteractive({ useHandCursor: true });
      d.on('pointerdown', () => { if (i !== this.pagina) { window.Sfx.pick(); this.vaiA(i); } });
      return d;
    });
    // La pagina si disegna dentro un CONTENITORE, cosi' la si puo' far scorrere via intera.
    this.contenitore = this.disegnaPagina(this.pagina);

    // SCORRIMENTO COL DITO. ⚠️ Si guarda anche lo spostamento VERTICALE: senza quel controllo un
    // tocco storto su un pulsante diventava un cambio pagina, e comprare qualcosa diventava un
    // terno al lotto. E la soglia e' generosa (70px) perche' un tocco fermo non e' mai perfetto.
    this.input.on('pointerdown', (pt) => { this._tocco = { x: pt.x, y: pt.y }; });
    this.input.on('pointerup', (pt) => {
      const t0 = this._tocco; this._tocco = null;
      if (!t0) return;
      const dx = pt.x - t0.x, dy = pt.y - t0.y;
      if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.6) return;
      this.vaiA(this.pagina + (dx < 0 ? 1 : -1));
    });

    // Pulsante indietro
    window.GameGfx.uiButton(this, W / 2, H - 28, T.t('shop_back'), () => this.toMenu(), { w: 210, h: 40 });

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
    const T = window.I18n, U = window.GameGfx.UI;
    const panelW = w - 16, panelH = o.panelH || 58;
    const nameSize = o.nameSize || 18, subSize = o.subSize || 12;
    const lineGap = Math.min(13, panelH * 0.22);
    const verde = o.accent === '#9fe6a0';
    // Riga GIA' PRESA = spenta e senza bordo acceso: si distingue a colpo d'occhio da quelle
    // ancora da comprare, che e' l'unica cosa che si cerca scorrendo l'elenco.
    window.GameGfx.panel(this, x, y, panelW, panelH, {
      soft: true,
      accento: o.done ? U.bordo : (verde ? 0x6fbf6f : U.ambraScura),
    });

    const textX = x - panelW / 2 + 14;
    this.add.text(textX, y - lineGap, o.name, {
      fontFamily: 'monospace', fontSize: nameSize + 'px',
      color: o.done ? '#a58b96' : (o.accent || '#ffe2b0'),
      wordWrap: { width: panelW - 130 },
    }).setOrigin(0, 0.5);
    this.add.text(textX, y + lineGap, o.sub, {
      fontFamily: 'monospace', fontSize: subSize + 'px', color: o.done ? '#8d7280' : U.testo,
      wordWrap: { width: panelW - 130 },
    }).setOrigin(0, 0.5);

    // Pulsante / stato a destra
    const bx = x + panelW / 2 - 62;
    const enough = window.Meta.get().bank >= o.cost;
    let label, bg, fg, clickable = false;
    if (o.done) { label = o.doneLabel; bg = '#3a2430'; fg = '#a58b96'; }
    else if (enough) { label = o.buyLabel; bg = '#ffd166'; fg = '#1c0a12'; clickable = true; }
    else { label = T.t('shop_need', { cost: o.cost }); bg = '#4a1f2a'; fg = '#d9a3b0'; }

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
    if (lv >= window.Meta.tettoSblocco(id)) { window.Sfx.hurt(); return; }   // gia al massimo per il grado raggiunto
    const cost = item.base + item.step * lv;
    if (!window.Meta.spend(cost)) { window.Sfx.hurt(); return; }  // cerume insufficiente
    window.Meta.setUnlock(id, lv + 1);
    window.Sfx.pick();
    // ⚠️ Si resta sulla schermata in cui si stava: un restart nudo riporterebbe alla prima,
    // e comprando un progetto ci si ritroverebbe fra i potenziamenti.
    this.scene.restart({ pagina: this.pagina });   // ridisegna con i nuovi valori
  }

  // Acquisto di un LEGGENDARIO. ⚠️ Si ricontrolla il grado di infezione anche QUI e non solo al
  // disegno: la schermata resta ferma fra il disegno e il tocco, ma fidarsi di un controllo fatto
  // altrove e' il genere di cosa che un giorno lascia comprare a chi non ha diritto.
  // Disegna UNA pagina e la restituisce dentro un contenitore, pronta da far scorrere.
  // ⚠️ Il contenitore si costruisce DOPO aver disegnato, raccogliendo quello che e' comparso nella
  // scena: cosi' makeRow e uiButton continuano a lavorare come sempre (aggiungono alla scena) e
  // non serve riscriverli per farli disegnare "dentro" a qualcosa. Gli oggetti interattivi
  // funzionano lo stesso dentro a un contenitore: Phaser tiene conto della trasformazione.
  disegnaPagina(indice) {
    const W = window.CONFIG.WIDTH, H = window.CONFIG.HEIGHT;
    const T = window.I18n;
    const PAGINE = this.PAGINE;
    const pag = PAGINE[indice] || PAGINE[0];
    const prima = this.children.list.slice();
    const colW = 700;
    const cx = W / 2;

    // Titolo della sezione + pallini di posizione: dicono a colpo d'occhio dove sei e quante
    // schermate ci sono. I pallini sono anche cliccabili, perche' su un PC non si scorre.
    this.add.text(cx, 106, pag.titolo, {
      fontFamily: 'monospace', fontSize: '15px', color: pag.colore,
    }).setOrigin(0.5);

    // SCORRIMENTO COL DITO. ⚠️ Si guarda anche lo spostamento VERTICALE: senza quel controllo un
    // tocco storto su un pulsante diventava un cambio pagina, e comprare qualcosa diventava un
    // terno al lotto. E la soglia e' generosa (70px) perche' un tocco fermo non e' mai perfetto.
    this.input.on('pointerdown', (pt) => { this._tocco = { x: pt.x, y: pt.y }; });
    this.input.on('pointerup', (pt) => {
      const t0 = this._tocco; this._tocco = null;
      if (!t0) return;
      const dx = pt.x - t0.x, dy = pt.y - t0.y;
      if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.6) return;
      this.vaiA(this.pagina + (dx < 0 ? 1 : -1));
    });

    const startY = 172;

    // --- POTENZIAMENTI (statistiche permanenti, ripetibili) ---
    const U = window.UNLOCKS;
    // ⚠️ L'ELENCO SI RICAVA DAI DATI. Prima era scritto a mano e l'Ugello Potenziato, che pure
    // esisteva in tutto e per tutto, non compariva nel negozio.
    const statIds = pag.id === 'potenziamenti' ? Object.keys(U) : [];
    statIds.forEach((id, i) => {
      const item = U[id];
      const lv = window.Meta.unlockLevel(id);
      // Il tetto vero cresce coi gradi di infezione superati (vedi Meta.tettoSblocco).
      const tetto = window.Meta.tettoSblocco(id);
      const tettoMax = window.Meta.tettoMassimo(id);
      const maxed = lv >= tetto;
      const cost = item.base + item.step * lv;
      const lvLabel = tetto > 1 ? T.t('shop_lv', { lv: lv, max: tetto })
        : (lv > 0 ? T.t('shop_owned') : T.t('shop_notowned'));
      this.makeRow(cx, startY + i * 64, colW, {
        name: T.t('unlock_' + id + '_name'),
        // `per` puo' essere una FRAZIONE (l'Ugello vale 0,08 = +8%): stampata cosi' com'e' il
        // negozio direbbe "+0.08%", una bugia di due ordini di grandezza.
        sub: T.t('unlock_' + id + '_eff', { n: item.per < 1 ? Math.round(item.per * 100) : item.per })
          + '  ·  ' + lvLabel
          // Il "come si alza" sta nella riga, ora che c'e' spazio: sul pulsante usciva dal bordo.
          + ((maxed && tettoMax > tetto) ? '  ·  ' + T.t('shop_lv_serve', { n: window.Meta.gradiSuperati() }) : ''),
        done: maxed,
        doneLabel: T.t('shop_max'),
        cost: cost,
        buyLabel: T.t('shop_buy', { cost: cost }),
        onBuy: () => this.buyStat(id),
      });
    });

    // --- PROGETTI (sblocchi una-tantum che aggiungono abilita' alle run) ---
    const BP = window.BLUEPRINTS;
    const bpIds = pag.id === 'progetti' ? Object.keys(BP) : [];
    bpIds.forEach((id, i) => {
      const item = BP[id];
      const owned = window.Meta.unlockLevel(id) > 0;
      this.makeRow(cx, startY + i * 42, colW, {
        name: T.t('bp_' + id + '_name'),
        sub: T.t('bp_' + id + '_desc'),
        accent: '#9fe6a0',
        done: owned,
        doneLabel: T.t('shop_bp_done'),
        cost: item.cost,
        buyLabel: T.t('shop_unlock', { cost: item.cost }),
        onBuy: () => this.buyBlueprint(id),
        panelH: 36, nameSize: 13, subSize: 10,
      });
    });

    // --- LEGGENDARI: carissimi, e chiusi dietro ai gradi di infezione ---
    // ⚠️ IL PUNTO INTERROGATIVO E' IL MECCANISMO, non un ripiego grafico: finche' non hai battuto
    // il grado richiesto non vedi cosa c'e' — ma vedi CHE c'e' qualcosa e QUALE grado ti serve.
    // Un mistero completo incuriosisce una volta; un obiettivo con un numero sopra si insegue.
    const LEG = window.LEGGENDARI || {};
    const legIds = pag.id === 'leggendari' ? Object.keys(LEG) : [];
    legIds.forEach((id, i) => {
      const item = LEG[id];
      const svelato = window.Meta.gradiSuperati() > (item.infezione | 0);
      const posseduto = window.Meta.unlockLevel(id) > 0;
      this.makeRow(cx, startY + i * 64, colW, {
        name: svelato ? T.t('leg_' + id + '_name') : '? ? ?',
        sub: svelato ? T.t('leg_' + id + '_desc') : T.t('shop_leg_chiuso', { n: item.infezione | 0 }),
        accent: '#ffb347',
        done: posseduto || !svelato,
        doneLabel: posseduto ? T.t('shop_bp_done') : T.t('shop_leg_serve', { n: item.infezione | 0 }),
        cost: item.cost,
        buyLabel: T.t('shop_unlock', { cost: item.cost }),
        onBuy: () => this.buyLeggendario(id),
      });
    });


    const nuovi = this.children.list.filter((o) => prima.indexOf(o) === -1);
    return this.add.container(0, 0, nuovi);
  }

  // Cambio schermata con lo SCORRIMENTO: la pagina vecchia esce dal lato verso cui hai
  // trascinato e la nuova entra dall'altro. ⚠️ Non si usa piu' scene.restart(): ridisegnare tutto
  // di colpo era il "salto" che l'utente ha trovato poco fluido. Bordi CHIUSI (non circolari):
  // scorrendo oltre l'ultima non si torna alla prima, o si perde il senso di dove si e'.
  vaiA(n) {
    const dove = Math.max(0, Math.min(this.PAGINE.length - 1, n));
    if (dove === this.pagina || this._inTransizione) return;
    const W = window.CONFIG.WIDTH;
    const verso = dove > this.pagina ? -1 : 1;   // -1 = la vecchia esce a sinistra
    this._inTransizione = true;
    const vecchia = this.contenitore;
    this.pagina = dove;
    this.aggiornaPallini();
    const nuova = this.disegnaPagina(dove);
    nuova.x = -verso * W;
    this.contenitore = nuova;
    this.tweens.add({ targets: vecchia, x: verso * W, duration: 220, ease: 'Cubic.out',
      onComplete: () => vecchia.destroy() });
    this.tweens.add({ targets: nuova, x: 0, duration: 220, ease: 'Cubic.out',
      onComplete: () => { this._inTransizione = false; } });
  }

  // I pallini stanno fuori dal contenitore (non scorrono), quindi si riaccendono a mano.
  aggiornaPallini() {
    (this._pallini || []).forEach((d, i) => d.setFillStyle(0xfff7e8, i === this.pagina ? 0.95 : 0.28));
  }

  buyLeggendario(id) {
    const item = (window.LEGGENDARI || {})[id];
    if (!item) return;
    if (window.Meta.unlockLevel(id) > 0) { window.Sfx.hurt(); return; }
    if (window.Meta.gradiSuperati() <= (item.infezione | 0)) { window.Sfx.hurt(); return; }
    if (!window.Meta.spend(item.cost)) { window.Sfx.hurt(); return; }
    window.Meta.setUnlock(id, 1);
    window.Sfx.pick();
    this.scene.restart({ pagina: this.pagina });
  }

  buyBlueprint(id) {
    const item = window.BLUEPRINTS[id];
    if (window.Meta.unlockLevel(id) > 0) { window.Sfx.hurt(); return; }   // gia sbloccato
    if (!window.Meta.spend(item.cost)) { window.Sfx.hurt(); return; }     // cerume insufficiente
    window.Meta.setUnlock(id, 1);
    window.Sfx.pick();
    this.scene.restart({ pagina: this.pagina });
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
