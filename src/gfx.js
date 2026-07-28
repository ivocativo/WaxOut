// GameGfx: rendering ed effetti visivi del gioco, SEPARATI dalla logica di gameplay
// (che resta in GameScene.js). Ogni funzione riceve la scena come primo argomento e
// disegna usando le sue API (scene.add, scene.tweens, ...). Tenere la grafica qui e il
// gameplay in GameScene permette di lavorarci in parallelo da due sessioni senza
// pestarsi i piedi: la sessione "grafica" tocca questo file, quella "gameplay" l'altro.
//
// GameScene mantiene piccoli metodi-richiamo di una riga (es. drawWax() ->
// GameGfx.drawWax(this)) cosi' i punti di chiamata nel gameplay restano invariati.
window.GameGfx = {

  // ---------- Sfondo ----------

  // Sfondo del condotto: FONDALE dipinto (immagine generata, parete di carne) che
  // riempie lo schermo e scorre lento (parallax). updateBackground() (da
  // GameScene.update) lo fa scorrere con la telecamera.
  // Manopola dello ZOOM (regolabile al volo in preview via window.__BG_ZOOM): quanto
  // zoomare dentro il fondale. >1 mostra solo un SETTORE dell'immagine, cosi' ogni
  // livello inquadra una zona diversa della stessa immagine (piu' sfondi con 1 file).
  // La GRANA (pixel + colori ridotti) e' gia' "cotta" nel PNG da tools/bake_bg_pixel.ps1.
  BG_ZOOM: 2.0,

  // ---------- SET DI SFONDO a 3 strati (pittorici) ----------
  // Un set = 3 immagini (assets/backgrounds/<N>/, preparate da tools/bake_background_set.ps1)
  // montate come strati di PARALLAX: lontano/medio/vicino scorrono a velocita' crescenti, e la
  // differenza di velocita' e' cio' che da' la sensazione di profondita'. Stanno tutti DIETRO a
  // soffitto e terreno (disegnati a depth 4 e 4.3): lo sfondo scorre TRA di essi.
  // Gli strati sono ancorati allo SCHERMO (scrollFactor 0) e si muovono spostando la texture
  // (tilePositionX in updateBackground), cosi' si ripetono all'infinito su livelli di qualunque
  // lunghezza senza dover essere larghi quanto il mondo.
  // Il set cambia a FASCE di 5 livelli, cioe' dopo ogni boss (i boss sono i multipli di 5).
  //
  // Manopole per strato: y = bordo alto sullo schermo, f = velocita' di parallax, scale =
  // ingrandimento della texture. NOTA su 'near': le colate pendono dal BORDO ALTO
  // dell'immagine, quindi lo strato va abbassato (y positivo) o finiscono nascoste dietro al
  // soffitto invece di sporgere dentro il condotto.
  // alpha/tint servono a dare la PROSPETTIVA ATMOSFERICA: piu' uno strato e' lontano, piu' e'
  // smorzato e tende al colore della foschia. Senza questo i tre strati hanno lo stesso
  // contrasto, sembrano tutti alla stessa distanza e l'insieme risulta solo "affollato".
  // NB: le immagini del set sono SPECCHIATE dallo script ([originale|riflesso]), cosi' quando lo
  // strato si ripete scorrendo non si vede la riga verticale della giuntura. Questo raddoppia la
  // larghezza e abbassa l'altezza a parita' di peso: le 'scale' qui sotto tengono conto di quello.
  BG_LAYERS: [
    { role: 'far',  y: -40, f: 0.10, scale: 1.02, depth: -15, alpha: 1.00, tint: 0xffffff },
    { role: 'mid',  y: -40, f: 0.22, scale: 1.38, depth: -14, alpha: 0.96, tint: 0xefe2ea },
    { role: 'near', y: -60, f: 0.40, scale: 1.32, depth: -13, alpha: 1.00, tint: 0xffffff },
  ],

  // ---------- MASSA ORGANICA (terreno e soffitto) ----------
  // Terreno e soffitto erano due lastroni di colore piatto marrone: con lo sfondo pittorico
  // dietro erano diventati la cosa piu' fuori posto dell'inquadratura. Qui vengono disegnati
  // via codice (nessun asset) come una SEZIONE DI TESSUTO: massa profonda scura, corpo, crosta
  // vicino alla superficie e un filo di luce sul bordo — cioe' gli stessi toni del fondale.
  // NB: e' solo aspetto. La FORMA resta quella generata dal gameplay (colline, cunette,
  // strettoie) e la collisione non viene toccata.
  CARNE: {
    profondo: 0x2b0f18,   // in fondo alla massa (quasi buio)
    crosta:   0xc2455f,   // appena sotto la superficie, satura come il fondale
    bordo:    0xe89aad,   // filo di luce sul bordo
  },

  // profilo(x) -> y del bordo della massa.
  // verso: +1 la massa sta SOTTO il bordo (terreno), -1 sta SOPRA (soffitto).
  // lontano: y dove la massa "finisce" fuori schermo.
  paintOrganicMass(scene, profilo, opts) {
    const verso = opts.verso, lontano = opts.lontano;
    // PASSO 16 e non 8: ogni velatura e' un poligono lungo tutto il livello, quindi raddoppiare i
    // punti raddoppia il costo di costruzione del livello (misurato: si era piu' che raddoppiato).
    // A 16px la silhouette e' identica a vedersi.
    const W = scene.worldW, PASSO = 16;
    const P = this.CARNE;
    const g = scene.add.graphics().setDepth(opts.depth);

    const bordo = [];
    for (let x = 0; x <= W; x += PASSO) bordo.push({ x, y: profilo(x) });
    bordo.push({ x: W, y: profilo(W) });

    // Fascia di massa tra due profondita' (a = piu' vicina al bordo, b = piu' dentro).
    // Il confine interno ONDEGGIA: se fosse dritto la sfumatura sembrerebbe una fascia
    // orizzontale dipinta sopra, invece cosi' la massa respira come tessuto vero.
    const fase = Phaser.Math.FloatBetween(0, 6.28);
    const onda = (x, d) => d * (0.78 + 0.44 * Math.sin(x * 0.0085 + fase));
    const banda = (a, b) => bordo.map((p) => ({ x: p.x, y: p.y + verso * a }))
      .concat(bordo.slice().reverse().map((p) => ({ x: p.x, y: p.y + verso * onda(p.x, b) })));

    // 1) massa profonda fino a fuori schermo
    g.fillStyle(P.profondo, 1);
    g.fillPoints(bordo.map((p) => ({ x: p.x, y: p.y }))
      .concat([{ x: W, y: lontano }, { x: 0, y: lontano }]), true);

    // 2) SFUMATURA verso la superficie, fatta con VELATURE trasparenti sovrapposte invece che con
    // tinte piene: ogni fascia aggiunge un velo di crosta, e piu' ci si avvicina al bordo piu'
    // veli si accumulano. Con le tinte piene si vedevano i GRADINI paralleli alla superficie;
    // cosi' la transizione e' continua.
    // La profondita' deve stare DENTRO l'altezza visibile (~180px sotto la superficie): con 230
    // il buio restava fuori schermo e il terreno sembrava una tinta unita slavata.
    const VELI = 10, PROFONDITA = 120;
    for (let k = VELI; k >= 1; k--) {
      g.fillStyle(P.crosta, 0.16);
      g.fillPoints(banda(0, k * (PROFONDITA / VELI)), true);
    }

    // 4) macchie: bolle piu' chiare/scure dentro la massa, per togliere l'effetto tinta unita
    // Macchie appena percettibili: prima erano scure e tonde e sembravano buchi/chiazze.
    for (let x = 20; x < W; x += Phaser.Math.Between(38, 74)) {
      const prof = Phaser.Math.Between(24, 150);
      const r = Phaser.Math.Between(14, 30);
      const chiara = Math.random() < 0.6;
      g.fillStyle(chiara ? P.crosta : P.profondo, chiara ? 0.16 : 0.14);
      g.fillEllipse(x, profilo(x) + verso * prof, r * 2.6, r * 1.1);
    }
    // 5) grumi sul bordo: spezzano la linea netta. Sul TERRENO restano sotto la superficie (se
    //    sporgessero il PG sembrerebbe camminare sospeso); sul SOFFITTO possono pendere.
    for (let x = 16; x < W; x += Phaser.Math.Between(34, 78)) {
      const r = Phaser.Math.Between(7, 17);
      const dentro = verso > 0 ? r * 0.75 : -r * 0.15;   // terreno: dentro / soffitto: sporge
      g.fillStyle(P.bordo, 0.28);                        // appena accennati: piu' marcati
      g.fillEllipse(x, profilo(x) + verso * dentro, r * 2.8, r * 1.3);   // sembravano bollicine
    }
    // 6) filo di luce sul bordo (dove batte la luce del condotto)
    g.lineStyle(3, P.bordo, 0.75);
    g.beginPath();
    bordo.forEach((p, i) => { if (i === 0) g.moveTo(p.x, p.y); else g.lineTo(p.x, p.y); });
    g.strokePath();
    return g;
  },

  // PEDANA: mensola di tessuto, stessa tavolozza e stesso trattamento della massa (velature dal
  // piano d'appoggio verso il basso). Il rettangolo fisico resta invariato e invisibile: qui si
  // disegna solo l'aspetto, quindi la collisione e la quota d'appoggio non cambiano di un pixel.
  paintLedge(scene, x, y, w, h) {
    const P = this.CARNE;
    const g = scene.add.graphics().setDepth(4.35);
    const sx = x - w / 2, top = y - h / 2;
    const SPESSORE = 24;                       // quanto scende sotto il piano d'appoggio
    const ang = { tl: 5, tr: 5, bl: 11, br: 11 };

    g.fillStyle(P.profondo, 1);
    g.fillRoundedRect(sx, top, w, SPESSORE, ang);
    // velature: piu' si sta in alto piu' se ne accumulano -> il piano d'appoggio e' illuminato,
    // il sottopancia resta scuro (e' da li' che si capisce che e' una sporgenza e non una riga)
    for (let k = 6; k >= 1; k--) {
      g.fillStyle(P.crosta, 0.2);
      g.fillRoundedRect(sx, top, w, SPESSORE * (k / 6), ang);
    }
    // qualche grumo sul bordo superiore: toglie l'aria di rettangolo
    for (let i = 0; i < Math.max(2, Math.round(w / 34)); i++) {
      const bx = sx + Phaser.Math.Between(6, Math.max(7, w - 6));
      const r = Phaser.Math.Between(5, 10);
      g.fillStyle(P.crosta, 0.85);
      g.fillEllipse(bx, top + 2, r * 2.1, r * 1.1);
    }
    // filo di luce sul piano dove si atterra
    g.fillStyle(P.bordo, 0.8);
    g.fillRect(sx + 2, top, w - 4, 2);
    // una o due gocce appese sotto
    for (let i = 0; i < Phaser.Math.Between(1, 2); i++) {
      const dx = sx + Phaser.Math.Between(8, Math.max(9, w - 8));
      const dr = Phaser.Math.Between(3, 5);
      g.fillStyle(P.profondo, 0.9);
      g.fillEllipse(dx, top + SPESSORE + dr, dr * 1.6, dr * 2.6);
    }
    return g;
  },

  // POZZA SCIVOLOSA. Prima era una barra dritta color senape: su un terreno in pendenza non lo
  // seguiva, e soprattutto quel giallo si confondeva col CERUME da raccogliere. Ora e' una
  // patina bagnata FREDDA (verde-acqua) che segue il profilo del terreno: contro il rosa della
  // carne salta all'occhio, e non somiglia a niente altro nel gioco. La forma e' a lente
  // (sottile ai bordi) perche' una pozza non ha spigoli.
  SCIVOLO: { film: 0x45b8a6, lucido: 0xe4fffa },

  paintSlick(scene, x1, x2, profilo) {
    const S = this.SCIVOLO;
    const g = scene.add.graphics().setDepth(4.5);
    const PASSO = 6, SPESSORE = 17, larg = Math.max(1, x2 - x1);
    const spess = (x) => Math.max(2, SPESSORE * Math.sin(Math.PI * (x - x1) / larg));

    const sopra = [], sotto = [];
    for (let x = x1; x <= x2; x += PASSO) {
      const y = profilo(x);
      sopra.push({ x, y: y - spess(x) });
      sotto.push({ x, y: y + 2 });
    }
    g.fillStyle(S.film, 0.78);
    g.fillPoints(sopra.concat(sotto.reverse()), true);
    // riflesso: filo chiaro lungo il bordo alto = superficie bagnata che riflette
    g.lineStyle(2.5, S.lucido, 0.8);
    g.beginPath();
    sopra.forEach((p, i) => { if (i === 0) g.moveTo(p.x, p.y); else g.lineTo(p.x, p.y); });
    g.strokePath();

    // due o tre luccichii che pulsano: e' il segnale "qui si scivola"
    for (let i = 0; i < Phaser.Math.Between(2, 3); i++) {
      const gx = Phaser.Math.Between(x1 + 12, x2 - 12);
      const e = scene.add.ellipse(gx, profilo(gx) - 5, Phaser.Math.Between(14, 26), 4, S.lucido, 0.75)
        .setDepth(4.55);
      scene.tweens.add({
        targets: e, alpha: 0.15, scaleX: 1.5, yoyo: true, repeat: -1,
        duration: Phaser.Math.Between(700, 1100), ease: 'Sine.inOut',
        delay: Phaser.Math.Between(0, 500),
      });
    }
    return g;
  },

  // (Il timpano non e' piu' disegnato via codice: dal round B.1 e' un'immagine AI scontornata,
  // caricata in BootScene come 'eardrum' e piazzata da GameScene.buildGoal.)

  // ---------- INCASSO DEL TIMPANO (playtest 2026-07-25: «il timpano sembra scollegato») ----------
  // L'immagine del timpano e' un OVALE ritagliato: appesa in mezzo al condotto sembrava un quadro
  // appoggiato al fondale, non la fine del condotto. Qui si disegna DIETRO di essa la carne che lo
  // tiene: (1) una massa che si addensa verso il centro = il condotto che finisce, (2) un labbro
  // saturo tutt'intorno = il bordo della membrana incastonato nel tessuto, (3) i vasi che partono
  // dal timpano e proseguono nella carne intorno.
  // Tutto ASPETTO: nessuna fisica, nessun cambiamento al traguardo (che dipende da `goalX`).
  // Sta a depth 2.6, cioe' DIETRO al timpano (3) e dietro a soffitto (4) e terreno (4.3): quelli
  // gli passano sopra e ritagliano da soli l'incasso nell'altezza del condotto.
  // Il vaso deve STACCARE dalla carne (0xc2455f): un rosso vicino al suo si perdeva del tutto.
  VASO: { scuro: 0x5c1226, chiaro: 0xe0788f },

  paintEardrumSocket(scene, cx, cy, rx, ry) {
    const P = this.CARNE, V = this.VASO;
    const g = scene.add.graphics().setDepth(2.6);
    const fase = Phaser.Math.FloatBetween(0, 6.28);

    // Ovale MOSSO: le ellissi perfette, sovrapposte, si leggevano come i cerchi di un bersaglio
    // disegnato col compasso. Il raggio ondeggia con l'angolo (due sinusoidi sfasate) e ogni anello
    // ha una fase diversa: cosi' i contorni non sono mai concentrici e la carne sembra tessuto.
    const ovale = (f, wob) => {
      const pts = [];
      for (let i = 0; i <= 48; i++) {
        const a = (i / 48) * Math.PI * 2;
        const m = f * (1 + wob * (Math.sin(a * 3 + f * 5.1 + fase) * 0.6 + Math.sin(a * 5 - f * 2.3) * 0.4));
        pts.push({ x: cx + Math.cos(a) * rx * m, y: cy + Math.sin(a) * ry * m });
      }
      return pts;
    };

    // 1) MASSA: veli concentrici sempre piu' stretti. Accumulandosi fanno buio verso il centro
    // (il condotto sprofonda e finisce li') e sfumano verso l'esterno SENZA bordo netto — un
    // poligono a tinta piena si sarebbe visto come una macchia rettangolare incollata sul fondale.
    const VELI = 9;
    for (let k = VELI; k >= 1; k--) {
      const f = 1.15 + (k / VELI) * 2.35;
      g.fillStyle(P.profondo, 0.17);
      g.fillPoints(ovale(f, 0.07), true);
    }
    // 2) macchie appena accennate: tolgono l'aria di tinta unita (stesso trucco della massa organica)
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 + fase;
      const d = 1.2 + Math.abs(Math.sin(i * 2.3)) * 1.7;
      const r = Phaser.Math.Between(10, 26);
      g.fillStyle(i % 3 === 0 ? P.crosta : P.profondo, 0.15);
      g.fillEllipse(cx + Math.cos(a) * rx * d, cy + Math.sin(a) * ry * d, r * 2.4, r * 1.2);
    }
    // 3) LABBRO: il tessuto si fa piu' saturo avvicinandosi alla membrana. Di nuovo a VELATURE e
    // non a due tinte piene: con due sole ellissi si vedeva il bordo netto e sembrava un bersaglio.
    // Sono ellissi PIENE dietro al timpano, non anelli: cosi' quando il timpano "respira" (tween
    // di scala) non scopre mai il fondale.
    for (let k = 10; k >= 1; k--) {
      const f = 1.05 + (k / 10) * 0.45;
      g.fillStyle(P.crosta, 0.10);
      g.fillPoints(ovale(f, 0.045), true);
    }
    // OMBRA DI CONTATTO: la crepa scura appiccicata al bordo della membrana. E' il pezzo che fa
    // davvero leggere "incastonato": qualunque cosa posata su un fondo, senza un'ombra che la
    // tocca, sembra incollata sopra. Va PRIMA del filo di luce, che sta appena piu' fuori.
    g.lineStyle(10, P.profondo, 0.30); g.strokeEllipse(cx, cy, rx * 2 * 1.03, ry * 2 * 1.03);
    g.lineStyle(20, P.profondo, 0.16); g.strokeEllipse(cx, cy, rx * 2 * 1.09, ry * 2 * 1.08);
    // filo di luce sul labbro rialzato, appena fuori dall'ombra (mosso, non un anello perfetto)
    g.lineStyle(3, P.bordo, 0.45);
    g.strokePoints(ovale(1.15, 0.035), true);

    // 4) VASI che continuano dal timpano nella carne: partono dal labbro e si allontanano
    // ramificandosi. Sono la ragione per cui l'occhio legge "attaccato" invece di "appoggiato".
    // Disegnati a segmenti che si assottigliano e si smorzano: una linea di spessore e opacita'
    // costanti sembrava un RAGGIO di ruota, non un vaso (primo tentativo, bocciato a schermo).
    const vaso = (a, lung, spess, col, alpha) => {
      const PASSI = 9;
      let px = cx + Math.cos(a) * rx * 1.03, py = cy + Math.sin(a) * ry * 1.02;
      for (let s = 1; s <= PASSI; s++) {
        const t = s / PASSI;
        const curva = Math.sin(t * 3.4 + a * 3.1) * 24 * t;   // serpeggia
        const nx = cx + Math.cos(a) * rx * (1.03 + lung * t) - Math.sin(a) * curva;
        const ny = cy + Math.sin(a) * ry * (1.02 + lung * t) + Math.cos(a) * curva;
        g.lineStyle(Math.max(0.8, spess * (1 - t * 0.85)), col, alpha * (1 - t * 0.85));
        g.beginPath(); g.moveTo(px, py); g.lineTo(nx, ny); g.strokePath();
        px = nx; py = ny;
      }
    };
    const N = 11;
    for (let i = 0; i < N; i++) {
      // angoli IRREGOLARI: a passo fisso tornavano a sembrare i raggi di una ruota
      const a = (i / N) * Math.PI * 2 + fase * 0.3 + Phaser.Math.FloatBetween(-0.22, 0.22);
      const lung = Phaser.Math.FloatBetween(0.35, 1.25);
      vaso(a, lung, Phaser.Math.FloatBetween(5, 8), V.scuro, 0.95);
      vaso(a + Phaser.Math.FloatBetween(0.1, 0.3), lung * 0.5, 3, V.scuro, 0.7);      // ramo
      if (i % 5 === 0) vaso(a - 0.12, lung * 0.7, 1.6, V.chiaro, 0.22);               // in luce
    }
    // capillari cortissimi tutt'intorno al bordo: cuciono la membrana al tessuto
    for (let i = 0; i < 40; i++) {
      const a = Phaser.Math.FloatBetween(0, Math.PI * 2);
      vaso(a, Phaser.Math.FloatBetween(0.05, 0.15), 2.4, V.scuro, 0.6);
    }
    return g;
  },

  // ---------- SCHERMATE DI CONTORNO (negozio, potenziamenti, arsenale, pausa, game over) ----------
  // Erano rettangoli marroni piatti con bordo giallo: la vecchia palette, rimasta indietro mentre
  // tutto il resto diventava carne e cerume. Qui c'e' UN linguaggio solo, usato da tutte, cosi'
  // passare dal gioco al negozio non sembra cambiare gioco.
  // Regole: fondo = tessuto profondo con bolle di carne appena accennate (lo stesso fondale visto
  // "da dentro", non un colore inventato); pannelli = plum scuro con un filo di luce in alto;
  // accento = l'AMBRA del cerume, che nel gioco vuol dire "questa e' la risorsa".
  UI: {
    fondo:     0x1c0a12,
    fondo2:    0x3a1424,
    pannello:  0x2a1220,
    pannelloIn:0x3a1a2c,
    bordo:     0x8a4258,
    ambra:     0xffd166,
    ambraScura:0xc98a12,
    verde:     0x9fe6a0,
    testo:     '#fff2e6',
    testoSoft: '#c9a6b2',
  },

  // Fondo comune a tutte le schermate: sfumatura + bolle di tessuto + vignettatura.
  // `scene` deve chiamarlo per PRIMO (sta a depth -50, sotto a tutto il resto).
  paintSceneBg(scene) {
    const W = window.CONFIG.WIDTH, H = window.CONFIG.HEIGHT, U = this.UI;
    const g = scene.add.graphics().setDepth(-50).setScrollFactor(0);
    // Sfumatura verticale a fasce (Graphics non ha gradienti veri): 40 bande = transizione liscia.
    const BANDE = 40;
    const c1 = Phaser.Display.Color.IntegerToColor(U.fondo2);
    const c2 = Phaser.Display.Color.IntegerToColor(U.fondo);
    for (let i = 0; i < BANDE; i++) {
      const t = i / (BANDE - 1);
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(c1, c2, 1, t);
      g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1);
      g.fillRect(0, Math.floor(H * i / BANDE), W, Math.ceil(H / BANDE) + 1);
    }
    // Bolle di tessuto: grandi, molto smorzate. Deterministiche (stesso disegno a ogni apertura:
    // se saltellassero a ogni ridisegno della scena si noterebbe, il negozio si ricarica spesso).
    const h = (n) => { const x = Math.abs(Math.sin(n) * 43758.5453); return x - Math.floor(x); };
    for (let i = 0; i < 16; i++) {
      const x = h(i * 1.7) * W, y = h(i * 3.1 + 5) * H;
      const r = 40 + h(i * 5.3) * 130;
      g.fillStyle(U.fondo2, 0.30);
      g.fillEllipse(x, y, r * 2.3, r * 1.5);
    }
    // Vignettatura: bordi piu' scuri, cosi' l'occhio va al centro dove stanno i pannelli.
    for (let i = 0; i < 9; i++) {
      g.fillStyle(0x000000, 0.055);
      g.fillRect(0, 0, W, 12 + i * 9);
      g.fillRect(0, H - (12 + i * 9), W, 12 + i * 9);
      g.fillRect(0, 0, 12 + i * 9, H);
      g.fillRect(W - (12 + i * 9), 0, 12 + i * 9, H);
    }
    return g;
  },

  // Pannello/riga: rettangolo arrotondato con filo di luce in alto (da' volume senza immagini).
  // opts: { accento (colore del bordo), soft (piu' scuro, per le righe di elenco), depth }
  panel(scene, x, y, w, h, opts) {
    const U = this.UI;
    const o = opts || {};
    const r = Math.min(10, h / 3);
    const g = scene.add.graphics().setDepth(o.depth === undefined ? 0 : o.depth);
    g.fillStyle(o.soft ? U.pannello : U.pannelloIn, o.alpha === undefined ? 1 : o.alpha);
    g.fillRoundedRect(x - w / 2, y - h / 2, w, h, r);
    g.lineStyle(2, o.accento === undefined ? U.bordo : o.accento, 0.9);
    g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, r);
    // filo di luce lungo il bordo alto
    g.fillStyle(0xffffff, 0.07);
    g.fillRoundedRect(x - w / 2 + 3, y - h / 2 + 2, w - 6, Math.min(10, h / 2), { tl: r, tr: r, bl: 0, br: 0 });
    return g;
  },

  // Titolo di schermata: scritta ambra con una riga sottile sotto (stessa in tutte le schermate).
  sceneTitle(scene, testo, y) {
    const W = window.CONFIG.WIDTH, U = this.UI;
    const t = scene.add.text(W / 2, y, testo, {
      fontFamily: 'monospace', fontSize: '30px', color: '#ffd166',
      stroke: '#1c0a12', strokeThickness: 6,
    }).setOrigin(0.5);
    const g = scene.add.graphics();
    g.fillStyle(U.ambraScura, 0.75);
    g.fillRect(W / 2 - t.width / 2 - 10, y + 20, t.width + 20, 2);
    return t;
  },

  // Pulsante comune: pannello + scritta, con stati sopra/premuto. Ritorna { zona, label }.
  uiButton(scene, x, y, testo, onTap, opts) {
    const U = this.UI;
    const o = opts || {};
    const w = o.w || 190, h = o.h || 44;
    const acc = o.accento === undefined ? U.ambra : o.accento;
    const sfondo = scene.add.graphics();
    const disegna = (dentro) => {
      sfondo.clear();
      sfondo.fillStyle(dentro ? U.ambra : U.pannelloIn, 1);
      sfondo.fillRoundedRect(x - w / 2, y - h / 2, w, h, 8);
      sfondo.lineStyle(2, acc, dentro ? 1 : 0.85);
      sfondo.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 8);
      if (!dentro) { sfondo.fillStyle(0xffffff, 0.06); sfondo.fillRoundedRect(x - w / 2 + 3, y - h / 2 + 2, w - 6, 9, { tl: 8, tr: 8, bl: 0, br: 0 }); }
    };
    disegna(false);
    const label = scene.add.text(x, y, testo, {
      fontFamily: 'monospace', fontSize: (o.size || 17) + 'px', color: U.testo, align: 'center',
    }).setOrigin(0.5);
    const zona = scene.add.rectangle(x, y, w, h, 0xffffff, 0).setInteractive({ useHandCursor: true });
    zona.on('pointerover', () => { disegna(true); label.setColor('#1c0a12'); });
    zona.on('pointerout', () => { disegna(false); label.setColor(U.testo); });
    zona.on('pointerdown', () => { window.Sfx.pick(); onTap(); });
    return { zona: zona, label: label, sfondo: sfondo };
  },

  bgSetFor(level) {
    const sets = (window.BG_SETS && window.BG_SETS.length) ? window.BG_SETS : null;
    if (!sets) return null;
    return sets[Math.floor((Math.max(1, level) - 1) / 5) % sets.length];
  },

  drawBackground(scene) {
    const W = window.CONFIG.WIDTH, H = window.CONFIG.HEIGHT;
    const lvl0 = (window.GameState && window.GameState.level) || 1;
    const set = this.bgSetFor(lvl0);
    const keys = set != null ? this.BG_LAYERS.map((L) => 'bg' + set + '_' + L.role) : [];
    if (keys.length && keys.every((k) => scene.textures.exists(k))) {
      // Sfasamento orizzontale diverso per livello (stesso livello -> stesso sfondo): con gli
      // strati che si ripetono basta questo per non rivedere la stessa inquadratura.
      scene.bgBaseX = ((lvl0 * 137) % 997) / 997 * 800;
      scene.bgBaseY = 0;
      scene.bgLayers = this.BG_LAYERS.map((L, i) => {
        const key = keys[i];
        const h = scene.textures.get(key).getSourceImage().height * L.scale;
        const ts = scene.add.tileSprite(0, L.y, W, h, key)
          .setOrigin(0, 0).setScrollFactor(0).setDepth(L.depth);
        ts.tileScaleX = L.scale; ts.tileScaleY = L.scale;
        if (L.alpha != null) ts.setAlpha(L.alpha);
        if (L.tint && L.tint !== 0xffffff) ts.setTint(L.tint);
        return { s: ts, f: L.f };
      });
      this.updateBackground(scene);
      return;
    }
    // --- RIPIEGO: vecchio fondale unico (se il set non e' disponibile) ---
    const ZOOM = window.__BG_ZOOM || this.BG_ZOOM;
    // Fondale gia' pixelato+posterizzato: si usa direttamente a pixel netti (NEAREST),
    // niente canvas/getImageData a runtime (che da file:// si romperebbero).
    const tex = scene.textures.get('bg_flesh_px');
    tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
    const low = tex.getSourceImage();
    const lowW = low.width, lowH = low.height;

    const scale = (H / lowH) * ZOOM;              // riempi l'altezza, poi zooma
    const bg = scene.add.tileSprite(0, 0, W, H, 'bg_flesh_px').setOrigin(0, 0).setScrollFactor(0).setDepth(-14);
    bg.tileScaleX = scale; bg.tileScaleY = scale;

    // Settore diverso per livello: offset deterministico dal numero di livello (stesso
    // livello -> stesso sfondo). Verticale entro la banda non visibile lasciata dallo zoom.
    const lvl = (window.GameState && window.GameState.level) || 1;
    const freeY = Math.max(0, lowH - H / scale);
    scene.bgBaseX = ((lvl * 137) % 997) / 997 * lowW;
    scene.bgBaseY = ((lvl * 311) % 997) / 997 * freeY;
    bg.tilePositionY = scene.bgBaseY;

    scene.bgLayers = [{ s: bg, f: 0.25 }];        // parallax lento
    this.updateBackground(scene);
  },

  // Scorre il fondale in base alla telecamera (effetto parallax), partendo dal settore
  // scelto per il livello (scene.bgBaseX).
  updateBackground(scene) {
    if (!scene.bgLayers) return;
    const sx = scene.cameras.main.scrollX;
    for (let i = 0; i < scene.bgLayers.length; i++) {
      const L = scene.bgLayers[i];
      L.s.tilePositionX = (scene.bgBaseX || 0) + (sx * L.f) / L.s.tileScaleX;
    }
  },

  // ---------- Protuberanze (scenografia di SFONDO) ----------

  // Immagini AI usabili come protuberanze, divise per superficie. Per aggiungerne:
  // ritaglia il PNG (tools/cutout_protuberance.ps1), incorporalo (tools/embed_assets.ps1),
  // caricalo in BootScene e aggiungi la chiave qui. Le immagini di SOFFITTO vanno
  // generate gia' orientate per pendere dall'alto (niente flip verticale nel codice).
  PROTUBERANCES: {
    floor:   ['prot_coral_stalk', 'prot_coral_branch'],
    ceiling: ['prot_web', 'prot_drip'],
  },

  // Sparge escrescenze organiche ancorate a PAVIMENTO e SOFFITTO lungo tutto il
  // condotto. Sono SCENOGRAFIA DI SFONDO (secondo/terzo piano): depth 2 = davanti solo
  // al fondale lontano (-14) ma DIETRO a tutto il gameplay (timpano 3, pavimento 4,
  // cerume/membrane 5-6, raccolte/nemici 7-9, personaggio 10) -> non coprono mai gli
  // oggetti di gioco. Niente collisioni. Scorrono col mondo (scrollFactor 1), quindi
  // rispetto al fondale (parallax 0.25) sembrano piu' vicine = effetto profondita'.
  // Quantita' e posizioni variano a ogni livello. Chiamata da GameScene.buildLevel.
  drawProtuberances(scene) {
    const H = window.CONFIG.HEIGHT;
    const groundTop = scene.groundTop != null ? scene.groundTop : H - window.CONFIG.GROUND_H;
    const worldW = scene.worldW || window.CONFIG.WIDTH;
    const lvl = (window.GameState && window.GameState.level) || 1;
    const P = this.PROTUBERANCES;

    scene.protuberances = [];
    const floorN = Phaser.Math.Clamp(4 + Math.floor(lvl * 0.8), 4, 14);
    const ceilN = Phaser.Math.Clamp(3 + Math.floor(lvl * 0.6), 3, 11);

    // Due PIANI di sfondo a velocita' di scorrimento diverse -> parallasse TRA le
    // protuberanze stesse (non solo verso il fondale lontano). Entrambi restano dietro
    // al gameplay (depth 1 e 2 < timpano 3). Il piano lontano scorre piu' lento, e' piu'
    // piccolo e smorzato (tinta verso il fondale = profondita' atmosferica); il vicino e'
    // piu' grande, pieno e quasi radicato al terreno.
    const PLANES = [
      { sf: 0.50, depth: 1, sizeMul: 0.72, alpha: 0.82, tint: 0xcf9d9d },  // lontano
      { sf: 0.85, depth: 2, sizeMul: 1.00, alpha: 1.00, tint: 0xffffff },  // vicino
    ];
    const W = window.CONFIG.WIDTH;
    const maxScroll = Math.max(1, worldW - W);

    const place = (key, anchor) => {
      const plane = PLANES[Phaser.Math.Between(0, PLANES.length - 1)];
      // Posiziono in "spazio-scroll": scelgo a che punto dell'attraversamento (s) e dove
      // sullo schermo comparira', poi ricavo la x nel mondo (con scrollFactor sf<1 vale
      // xMondo = xSchermo + s*sf). Cosi' anche il piano lento copre tutto il livello.
      const s = Phaser.Math.Between(0, maxScroll);
      const x = Phaser.Math.Between(40, W - 40) + s * plane.sf;
      // floor: appoggia in basso (un filo dentro al pavimento); ceiling: pende dall'alto.
      const y = anchor === 'floor' ? groundTop + 6 : -6;
      const img = scene.add.image(x, y, key).setDepth(plane.depth);
      img.setScrollFactor(plane.sf, 1);                     // sf<1 = parallasse orizzontale
      img.setOrigin(0.5, anchor === 'floor' ? 1 : 0);
      // Scala mirata a un'ALTEZZA a schermo (px) * fattore del piano: cosi' funziona sia
      // per le bozze piccole sia per le immagini AI grandi, e i piani lontani sono piu' piccoli.
      const srcH = scene.textures.get(key).getSourceImage().height || 64;
      const targetH = (anchor === 'floor' ? Phaser.Math.Between(150, 300) : Phaser.Math.Between(120, 230)) * plane.sizeMul;
      img.setScale(targetH / srcH);
      img.setAlpha(plane.alpha);
      if (plane.tint !== 0xffffff) img.setTint(plane.tint);
      if (Math.random() < 0.5) img.setFlipX(true);          // varieta' (solo orizzontale)
      // NB: le immagini di soffitto (prot_web/prot_drip...) sono gia' orientate per pendere
      // dall'alto (origin 0.5,0), quindi NON si ribaltano verticalmente.
      scene.protuberances.push(img);
    };

    for (let i = 0; i < floorN; i++) place(Phaser.Utils.Array.GetRandom(P.floor), 'floor');
    for (let i = 0; i < ceilN; i++) place(Phaser.Utils.Array.GetRandom(P.ceiling), 'ceiling');
  },

  // ---------- Muro di cerume ----------

  // Disegna il muro come UN'UNICA massa di cerume gommosa e lucida, sovrapponendo
  // blob arrotondati ai blocchi (cosi i bordi si fondono e non si vede piu il reticolo).
  // Richiamata a ogni colpo per "erodere" la massa col muro.
  drawWax(scene) {
    const g = scene.waxGfx;
    if (!g) return;
    const C = window.CONFIG.COLORS;
    const B = window.CONFIG.BLOCK;
    g.clear();
    const blocks = scene.blocks.getChildren().filter((b) => b.active);
    if (!blocks.length) return;

    const occ = new Set(blocks.map((b) => b.col + ',' + b.row));
    const has = (col, row) => occ.has(col + ',' + row);
    const PAL = {
      soft: [C.waxSoft, C.waxSoftLight, C.waxSoftDark],
      hard: [C.waxHard, C.waxHardLight, C.waxHardDark],
      dirt: [C.dirt, C.dirtLight, C.dirtDark],
    };

    // 1) Ombra/base: blob scuri spostati in basso, danno spessore alla massa.
    blocks.forEach((b) => {
      g.fillStyle(PAL[b.waxType][2], 1);
      g.fillCircle(b.x + 2, b.y + 4, B * 0.80);
    });

    // 2) Gocce che colano dagli sporti (blocco senza nulla sotto).
    blocks.forEach((b) => {
      if (b.row > 0 && !has(b.col, b.row - 1) && b.dripLen > 0) {
        const x = b.x, y0 = b.y + B * 0.40, len = b.dripLen, w = 5;
        g.fillStyle(PAL[b.waxType][2], 1);
        g.fillRect(x - w / 2, y0, w, len);
        g.fillCircle(x, y0 + len, w * 0.9);
        g.fillStyle(PAL[b.waxType][0], 1);
        g.fillRect(x - w / 2 + 1, y0, w - 2, len * 0.7);
      }
    });

    // 3) Corpo principale a colore pieno; piu scuro dove e danneggiato ("livido").
    blocks.forEach((b) => {
      g.fillStyle(PAL[b.waxType][0], 1);
      g.fillCircle(b.x, b.y, B * 0.76);
    });
    blocks.forEach((b) => {
      const t = Phaser.Math.Clamp(b.hp / b.maxHp, 0, 1);
      if (t < 0.98) {
        g.fillStyle(PAL[b.waxType][2], (1 - t) * 0.55);
        g.fillCircle(b.x, b.y, B * 0.70);
      }
    });

    // 4) Riflessi lucidi: bordo superiore e faccia esposta + puntini speculari.
    blocks.forEach((b) => {
      const light = PAL[b.waxType][1];
      if (!has(b.col, b.row + 1)) {           // niente blocco sopra = cresta
        g.fillStyle(light, 0.6);
        g.fillEllipse(b.x - 4, b.y - B * 0.34, B * 0.70, B * 0.34);
      }
      if (!has(b.col + 1, b.row)) {            // niente blocco a sinistra = faccia verso il giocatore
        g.fillStyle(light, 0.28);
        g.fillEllipse(b.x - B * 0.32, b.y, B * 0.26, B * 0.62);
      }
    });
    blocks.forEach((b) => {
      if (!has(b.col, b.row + 1) && !has(b.col + 1, b.row)) {
        g.fillStyle(0xffffff, 0.5);
        g.fillCircle(b.x - B * 0.22, b.y - B * 0.26, 2.6);
      }
    });
  },

  // ---------- Effetti / particelle ----------

  // Piccolo "splat" di feedback quando un pezzo di cerume si stacca.
  splat(scene, x, y, type) {
    const C = window.CONFIG.COLORS;
    const col = { soft: C.waxSoftLight, hard: C.waxHardLight, dirt: C.dirtLight }[type] || C.waxSoftLight;
    const ring = scene.add.circle(x, y, 6, col, 0.7).setDepth(7);
    scene.tweens.add({ targets: ring, scale: 3.4, alpha: 0, duration: 260, ease: 'Quad.out', onComplete: () => ring.destroy() });
  },

  // Esplosione di particelle (briciole di cerume/sporco).
  burst(scene, key, x, y, n) {
    const e = scene.add.particles(x, y, key, {
      speed: { min: 60, max: 210 }, angle: { min: 0, max: 360 },
      lifespan: 450, scale: { start: 1, end: 0 }, gravityY: 520, emitting: false,
    });
    e.setDepth(15);
    e.explode(n, x, y);
    scene.time.delayedCall(700, () => e.destroy());
  },

  // Sbuffo di terriccio/cerume quando qualcosa emerge dal pavimento.
  groundPuff(scene, x, groundTop, big) {
    this.burst(scene, 'bit_dirt', x, groundTop - 4, big ? 18 : 9);
    const C = window.CONFIG.COLORS;
    const mound = scene.add.ellipse(x, groundTop - 2, big ? 70 : 44, big ? 26 : 16, C.dirtDark, 0.8).setDepth(7);
    scene.tweens.add({ targets: mound, scaleX: 1.6, scaleY: 0.2, alpha: 0, duration: 360, ease: 'Quad.out', onComplete: () => mound.destroy() });
  },

  // Filo di cerume che cola dal soffitto sopra al volante mentre scende.
  ceilingDrip(scene, x, restY) {
    const C = window.CONFIG.COLORS;
    const strand = scene.add.rectangle(x, 0, 5, restY + 20, C.waxSoftDark, 0.85).setOrigin(0.5, 0).setDepth(7);
    const blob = scene.add.circle(x, 6, 6, C.waxSoft, 0.9).setDepth(7);
    scene.tweens.add({ targets: [strand], scaleY: 0, alpha: 0, duration: 540, ease: 'Quad.in', onComplete: () => strand.destroy() });
    scene.tweens.add({ targets: [blob], y: 0, scale: 0, alpha: 0, duration: 300, onComplete: () => blob.destroy() });
  },

  // ---------- UI a schermo (effetti) ----------


  // Cartello a schermo per annunciare i livelli speciali (boss / sciame).
  showBanner(scene, text, color, yPos) {
    const W = window.CONFIG.WIDTH;
    const y = yPos || 118;
    const col = color || '#ffd166';
    const t = scene.add.text(W / 2, y, text, {
      fontFamily: 'monospace', fontSize: '34px', color: col,
      stroke: '#14161f', strokeThickness: 8, align: 'center',
    }).setOrigin(0.5).setDepth(121).setScrollFactor(0);
    // Pannello scuro dietro al testo: stacca il banner dallo sfondo carnoso (leggibilita').
    const strokeCol = Phaser.Display.Color.HexStringToColor(col).color;
    const bg = scene.add.rectangle(W / 2, y, t.width + 52, t.height + 26, 0x14161f, 0.74)
      .setOrigin(0.5).setDepth(120).setScrollFactor(0).setStrokeStyle(3, strokeCol, 0.95);
    const group = [bg, t];
    group.forEach((o) => { o.setAlpha(0); o.setScale(0.85); });
    // "Pop" d'entrata + permanenza lunga + dissolvenza.
    scene.tweens.add({ targets: group, alpha: 1, scaleX: 1, scaleY: 1, duration: 320, ease: 'Back.out' });
    scene.time.delayedCall(2600, () => {
      scene.tweens.add({ targets: group, alpha: 0, duration: 550, ease: 'Quad.in', onComplete: () => { bg.destroy(); t.destroy(); } });
    });
  },

  // Fumetto/battuta comica: piccola scritta che spunta sopra la testa del personaggio, sale un
  // po' e sfuma. Posizione fissata al momento della comparsa (effetto breve, non insegue il
  // movimento). Usata per dare carattere al personaggio (vedi window.SPEECH in state.js e
  // GameScene.maybeSpeech/showSpeech).
  showSpeech(scene, x, y, text) {
    const t = scene.add.text(x, y, text, {
      fontFamily: 'monospace', fontSize: '15px', color: '#fff7e8',
      stroke: '#14161f', strokeThickness: 4, align: 'center',
      wordWrap: { width: 150 },
    }).setOrigin(0.5, 1).setDepth(50);
    const bg = scene.add.rectangle(x, y - t.height / 2, t.width + 18, t.height + 12, 0x14161f, 0.68)
      .setOrigin(0.5, 0.5).setDepth(49).setStrokeStyle(2, 0xffd166, 0.85);
    const group = [bg, t];
    group.forEach((o) => { o.setAlpha(0); o.setScale(0.7); });
    scene.tweens.add({ targets: group, alpha: 1, scaleX: 1, scaleY: 1, y: '-=6', duration: 200, ease: 'Back.out' });
    scene.time.delayedCall(1400, () => {
      scene.tweens.add({ targets: group, alpha: 0, y: '-=14', duration: 400, ease: 'Quad.in', onComplete: () => { bg.destroy(); t.destroy(); } });
    });
  },
};
