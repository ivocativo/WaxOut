// game_livello.js — COME NASCE UN LIVELLO: terreno, soffitto, cerume, pedane, membrane,
// pericoli e traguardo. Tutto quello che si costruisce UNA VOLTA all'inizio del livello e
// poi resta li'.
//
// Perche' sta in un file suo: erano 460 righe dentro a GameScene.js che non toccano ne' i
// nemici ne' il combattimento ne' i comandi. Separarle non cambia niente per il gioco, ma
// toglie di mezzo un decimo del file piu' grande del progetto.
//
// ⚠️ QUESTI SONO METODI DELLA SCENA, non funzioni indipendenti: vengono innestati sul
// prototipo di GameScene (`Object.assign` in fondo a GameScene.js), quindi dentro di loro
// `this` E' LA SCENA, come quando stavano nella classe. E' il motivo per cui i corpi hanno
// potuto essere spostati parola per parola, senza riscrivere un solo `this.`.
// ⚠️ Va caricato PRIMA di GameScene.js.
window.GameLivello = {

  // Costruisce il livello "da attraversare": piu' membrane di cerume (muri da
  // sfondare) lungo il corridoio, qualche pedana per saltare, e il timpano in fondo.
  buildLevel() {
    const H = window.CONFIG.HEIGHT;
    const gh = window.CONFIG.GROUND_H;
    const lvl = window.GameState.level;
    this.groundTop = H - gh;

    // Il PROFILO del terreno (colline + cunette) va generato PRIMA di tutto cio' che "sta sul
    // pavimento" (membrane, cumuli, pozze, comparse nemici), cosi' possono agganciarsi alla
    // superficie LOCALE `terrainTopAt(x)` invece che alla vecchia quota piatta 360.
    this.buildTerrain();         // round 4: colline a gradini camminabili sul pavimento

    // Riempimento continuo (base scura) DIETRO agli sprite di cerume: chiude i vuoti tra un
    // pezzo e l'altro così la massa sembra unica. Gli sprite-chunk (depth 6) ci vanno sopra.
    this.waxGfx = this.add.graphics().setDepth(5);   // base scura DIETRO (fuori dal livello metaball)
    // Livello dei globi di cerume + effetto METABALL (fonde i globi in una massa liquida con
    // bordi netti). Regolabile al volo: window.__WAX_THRESH (soglia) / window.__WAX_SPREAD (raggio).
    this.waxLayer = this.add.layer().setDepth(6);
    if (WaxMetaballFX && this.renderer.pipelines) {
      if (!this.game.__waxPipe) { this.renderer.pipelines.addPostPipeline('WaxMeta', WaxMetaballFX); this.game.__waxPipe = true; }
      this.waxLayer.setPostPipeline('WaxMeta');
    }

    // Quante membrane lungo il corridoio: cresce col livello.
    let count = Phaser.Math.Clamp(2 + Math.floor(lvl / 2), 2, 6);
    if (this.levelKind === 'swarm') count = Math.max(2, count - 1);
    // MENO CERUME AI LIVELLI ALTI (playtest 2026-07-29): i livelli crescono in lunghezza e con
    // essi le membrane da sfondare — pulire diventava una corvee invece che una sfida.
    const scalaCerume = Math.max(0.6, 1 - Math.max(0, lvl - window.CONFIG.MENO_CERUME_DA) * window.CONFIG.MENO_CERUME_PASSO);
    count = Math.max(2, Math.round(count * scalaCerume));

    const firstX = 620;
    const lastX = this.worldW - 520;              // ultima membrana prima del timpano
    const span = Math.max(1, lastX - firstX);

    this.membranes = [];                          // metadati (x, tipo) per pedane/guardiani
    this.membraneXs = [];
    this.pickups = this.physics.add.group({ allowGravity: false });
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0 : i / (count - 1);
      const mx = Math.round(firstX + span * t);
      // Varieta': la prima e' sempre "piena" (insegna a sfondare); poi si alternano
      // membrane PIENE (alte, da sfondare) e BASSE (scavalcabili con un salto).
      const type = (i % 2 === 1) ? 'short' : 'full';
      const info = this.buildMembrane(mx, lvl, i, type);
      this.membranes.push(info);
      this.membraneXs.push(mx);
    }
    this.buildMounds();          // cumuli di cerume su pavimento e soffitto (agganciati al terreno)
    this.buildPlatforms();
    this.ensureHealPickups();    // garantisce un minimo di cure (la vita non si ricarica piu' a fine livello)
    this.buildHazards();         // pozze scivolose + gocce dal soffitto
    this.buildGoal();
    // PROTUBERANZE DISATTIVATE (2026-07-20): le vecchie immagini (coralli/rovi) stonavano col
    // nuovo sfondo pittorico a 3 strati. Il meccanismo di piazzamento resta in
    // GameGfx.drawProtuberances: per riattivarle bastera' rimettere la chiamata qui dopo aver
    // rigenerato l'arte in stile con lo sfondo.
    // window.GameGfx.drawProtuberances(this);

    this.totalBlocks = this.blocks.countActive(true);
    this.blocksLeft = this.totalBlocks;
    // Cerume totale del livello (per la percentuale "pulito" — vedi HUD).
    this.totalWax = 0;
    this.blocks.getChildren().forEach((b) => { if (b.active) this.totalWax += b.waxValue; });
    this.cleanedWax = 0;
    this.buildWaxSprites();
  },

  // Una membrana di cerume: una colonna di blocchi dal pavimento verso l'alto che
  // sbarra il corridoio. Tipo 'full' = alta, da sfondare (varco in basso); tipo
  // 'short' = bassa, scavalcabile con un salto (o sfondabile, ha pochi HP).
  buildMembrane(mx, lvl, idx, type) {
    const B = window.CONFIG.BLOCK;
    const groundTop = this.groundTop;
    const baseCol = Math.round(mx / B);

    // Crea un blocco di cerume a (col, row) con tipo/HP giusti. La riga 0 poggia sulla superficie
    // LOCALE del terreno (terrainTopAt) cosi' la membrana segue colline/cunette invece di fluttuare.
    const mk = (col, row) => {
      const x = col * B + B / 2, y = this.terrainTopAt(x) - row * B - B / 2;
      let bt = 'soft';
      if (row === 0) bt = 'dirt';
      else if (type === 'full' && lvl >= 2 && (row + col) % 4 === 0) bt = 'hard';
      let key, hp, bitKey, wax;
      if (bt === 'hard') { key = 'block_hard'; hp = 60 + lvl * 10; bitKey = 'bit_hard'; wax = 6; }
      else if (bt === 'dirt') { key = 'block_dirt'; hp = 40 + lvl * 7; bitKey = 'bit_dirt'; wax = 4; }
      else { key = 'block_soft'; hp = 26 + lvl * 5; bitKey = 'bit_wax'; wax = 3; }
      hp = Math.max(1, Math.round(hp * window.CONFIG.VITA_CERUME));   // giro difficolta' 2026-07-29
      if (y < this.ceilingYAt(x) + B * 0.5) return;   // oltre il soffitto: non si piazza
      const b = this.blocks.create(x, y, key).setDepth(5).setVisible(false);
      b.hp = hp; b.maxHp = hp; b.bitKey = bitKey; b.waxValue = wax;
      b.col = col; b.row = row; b.waxType = bt;
      b.dripLen = Math.random() < 0.55 ? Phaser.Math.Between(8, 20) : 0;
      b.refreshBody();
    };

    let rows;
    if (type === 'short') {
      // Cumuletto basso scavalcabile: 1-2 colonne di 2-3 blocchi, con un pizzico di irregolarità.
      rows = Phaser.Math.Between(2, 3);
      for (let r = 0; r < rows; r++) mk(baseCol, r);
      if (Math.random() < 0.7) for (let r = 0; r < rows - (Math.random() < 0.5 ? 1 : 0); r++) mk(baseCol + 1, r);
    } else {
      // PROFILO ORGANICO: colonna centrale piena (barriera) + contrafforti laterali più
      // bassi -> base larga che si assottiglia verso l'alto (accumulo di cerume, non stecco).
      // Altezza calcolata sullo spazio VERO fra terreno e soffitto in QUESTO punto.
      const spazio = this.terrainTopAt(mx) - this.ceilingYAt(mx) - 12;
      const fullRows = Math.max(3, Math.floor(spazio / B));
      const topGap = Math.random() < 0.4 ? Phaser.Math.Between(1, 2) : 0;
      rows = Math.max(3, fullRows - topGap);
      const profile = {};
      profile[0] = rows;                                                    // guglia centrale (piena)
      profile[-1] = Math.round(rows * Phaser.Math.FloatBetween(0.35, 0.62));
      profile[1] = Math.round(rows * Phaser.Math.FloatBetween(0.35, 0.62));
      profile[-2] = Phaser.Math.Between(1, 2);                              // base che si allarga
      profile[2] = Phaser.Math.Between(1, 2);
      Object.keys(profile).forEach((off) => {
        const h = profile[off], col = baseCol + parseInt(off, 10);
        for (let r = 0; r < h; r++) mk(col, r);
      });
    }
    return { x: mx, type: type, rows: rows };
  },

  // Crea un singolo blocco di cerume alla colonna/riga date (riga 0 = pavimento, su = verso il soffitto).
  // baseY = quota della "riga 0": di default il pavimento fisso, ma i cumuli a terra passano la
  // superficie LOCALE del terreno (terrainTopAt) cosi' il cerume segue colline e cunette.
  addWaxBlock(col, row, lvl, type, baseY) {
    const B = window.CONFIG.BLOCK;
    const x = col * B + B / 2;
    const base = (baseY != null) ? baseY : this.groundTop;
    const y = base - row * B - B / 2;
    let key, hp, bitKey, wax;
    if (type === 'hard') { key = 'block_hard'; hp = 60 + lvl * 10; bitKey = 'bit_hard'; wax = 6; }
    else if (type === 'dirt') { key = 'block_dirt'; hp = 40 + lvl * 7; bitKey = 'bit_dirt'; wax = 4; }
    else { key = 'block_soft'; hp = 26 + lvl * 5; bitKey = 'bit_wax'; wax = 3; }
    hp = Math.max(1, Math.round(hp * (this.mutWaxHp || 1) * window.CONFIG.VITA_CERUME));   // MODIFICATORE "cerume ostinato" + giro difficolta'
    // Rete di sicurezza contro il cerume che sbuca oltre il soffitto: vale SOLO per le pile che
    // partono dal pavimento (quelle che passano `baseY`). I cumuli APPESI al soffitto stanno li'
    // apposta — applicare il controllo anche a loro li cancellava tutti.
    if (baseY != null && y < this.ceilingYAt(x) + B * 0.5) return null;
    const b = this.blocks.create(x, y, key).setDepth(5).setVisible(false);
    b.hp = hp; b.maxHp = hp; b.bitKey = bitKey; b.waxValue = wax;
    b.col = col; b.row = row; b.waxType = type;
    b.dripLen = Math.random() < 0.55 ? Phaser.Math.Between(8, 20) : 0;
    b.refreshBody();
    return b;
  },

  // Sparge cumuli di cerume lungo il condotto: pilette sul pavimento (da scavalcare o
  // pulire) e stalattiti appese al soffitto (si puliscono mirando il getto in alto).
  // La quantita' cresce col livello: piu' avanti = piu' sporco.
  buildMounds() {
    const lvl = window.GameState.level;
    const floorCount = Phaser.Math.Clamp(3 + lvl, 3, 14);
    const ceilCount = Phaser.Math.Clamp(2 + Math.floor(lvl * 0.8), 2, 12);
    const minX = 320, maxX = this.worldW - 360;
    for (let i = 0; i < floorCount; i++) this.buildFloorMound(Phaser.Math.Between(minX, maxX), lvl);
    for (let i = 0; i < ceilCount; i++) this.buildCeilingMound(Phaser.Math.Between(minX, maxX), lvl);
  },

  // Piletta sul pavimento: base larga che si restringe verso l'alto (scavalcabile).
  buildFloorMound(mx, lvl) {
    const B = window.CONFIG.BLOCK;
    const baseCol = Math.round(mx / B);
    const w = Phaser.Math.Between(2, 3);
    const h = Phaser.Math.Between(1, 2);
    for (let r = 0; r < h; r++) {
      const span = Math.max(1, w - r);
      for (let c = 0; c < span; c++) {
        const col = baseCol + c;
        const surf = this.terrainTopAt(col * B + B / 2);   // superficie LOCALE del terreno
        const type = (r === 0) ? 'dirt' : (lvl >= 4 && Math.random() < 0.2 ? 'hard' : 'soft');
        this.addWaxBlock(col, r, lvl, type, surf);
      }
    }
  },

  // Stalattite appesa al soffitto: larga in alto, a punta verso il basso.
  buildCeilingMound(mx, lvl) {
    const B = window.CONFIG.BLOCK;
    // Appeso al soffitto LOCALE (round 4: ondulato): la riga piu' alta del cumulo corrisponde al
    // bordo basso del soffitto in mx, cosi' il cerume pende da li' e non resta incastrato/sospeso.
    const topRow = Math.max(1, Math.round((this.groundTop - this.ceilingYAt(mx)) / B) - 1);
    const baseCol = Math.round(mx / B);
    const w = Phaser.Math.Between(2, 3);
    const depth = Phaser.Math.Between(1, 2 + Math.floor(lvl / 3));
    for (let d = 0; d < depth; d++) {
      const span = w - d;
      if (span <= 0) break;
      // ceiling = true: questi blocchi sono "appesi al soffitto" -> NON cadono con la gravità.
      for (let c = 0; c < span; c++) { const b = this.addWaxBlock(baseCol + c, topRow - d, lvl, 'soft'); if (b) b.ceiling = true; }
    }
  },

  // ---- CONDOTTO A LARGHEZZA VARIABILE (round 4) ----
  // Profilo IRREGOLARE del soffitto: punti di controllo a distanza variabile con y casuale,
  // interpolati a spezzata. Regola di sicurezza: il soffitto non scende mai oltre `maxY`
  // (apertura minima al pavimento) e resta alto vicino a partenza/goal.
  // (Il PAVIMENTO non ha piu' un profilo separato: la sua forma la fa `buildTerrain`.)
  buildCeilingProfile() {
    const floorY = window.CONFIG.HEIGHT - window.CONFIG.GROUND_H;   // 360
    this.MIN_OPEN = 96;                                             // apertura minima garantita
    const maxY = floorY - this.MIN_OPEN;                            // il soffitto non scende oltre
    this.CEIL_MIN = 8;                                              // punto piu' ALTO (quasi bordo schermo)
    // Componente LENTA (punti radi): crea ZONE ampie e strette sostenute, non jitter.
    // Escursione VOLUTAMENTE contenuta (2026-07-20): il soffitto resta ALTO e varia poco, cosi'
    // lascia vedere lo sfondo a 3 strati e non schiaccia il condotto. Prima arrivava a 150
    // (restringimenti marcati) e l'insieme risultava troppo mosso.
    const CEIL_LOW = 72;                                            // punto piu' BASSO del soffitto
    const slow = [];
    let sx = 0;
    while (sx <= this.worldW) { slow.push({ x: sx, y: Phaser.Math.Between(this.CEIL_MIN, CEIL_LOW) }); sx += Phaser.Math.Between(520, 900); }
    slow.push({ x: this.worldW, y: 50 });
    // Profilo fine = zona lenta + rugosita' piccola (stesso ritmo/carattere del pavimento).
    const pts = [];
    let x = 0;
    while (x <= this.worldW) {
      const base = this._sampleProfile(slow, x, 50);
      let y = base + Phaser.Math.Between(-8, 8);
      if (x < 640 || x > this.worldW - 460) y = Math.min(base, this.CEIL_Y);   // spawn/goal: mai piu' stretti del default
      pts.push({ x, y: Phaser.Math.Clamp(y, this.CEIL_MIN, maxY) });
      x += Phaser.Math.Between(70, 140);
    }
    pts.push({ x: this.worldW, y: 50 });
    this._ceilPts = pts;
  },

  ceilingYAt(x) { return this._sampleProfile(this._ceilPts, x, this.CEIL_Y); },

  // "Soffitto solido" = scaletta di rettangoli statici (uno ogni SEG px) che scendono dall'alto
  // fino al bordo basso locale `ceilingYAt`. Cosi' i corpi sbattono la testa al soffitto locale
  // (nei tratti bassi) e possono salire in alto nelle zone ampie. Pochi corpi statici = leggero.
  buildCeilingColliders() {
    const SEG = 60, TOP = -140;
    for (let x = 0; x < this.worldW; x += SEG) {
      const cx = Math.min(x + SEG / 2, this.worldW);
      const bottom = this.ceilingYAt(cx);
      const h = bottom - TOP;
      if (h <= 2) continue;
      const r = this.add.rectangle(cx, TOP + h / 2, SEG + 2, h).setVisible(false);
      this.physics.add.existing(r, true);
      this.ceilBlocks.add(r);
    }
  },

  // PROTOTIPO TERRENO (round 4): COLLINE a GRADINI camminabili sul pavimento (montagnole,
  // saliscendi). Fatte di blocchi statici solidi → "a terra"/salto restano quelli di sempre; un
  // piccolo "auto-gradino" in update() le fa SALIRE camminando (senza saltare a ogni gradino).
  // NB: per ora le colline salgono SOPRA il pavimento; le cunette SOTTO il pavimento sono la
  // versione completa (richiede togliere il pavimento piatto).
  buildTerrain() {
    this.TERR_STEP = 18;                        // altezza di un gradino
    this.TERR_MAXH = 132;                       // collina piu' alta (SOPRA il pavimento)
    this.TERR_DIP = 36;                         // cunetta piu' profonda (SOTTO il pavimento)
    const C = window.CONFIG.COLORS;
    const H = window.CONFIG.HEIGHT;
    // Profilo di ALTEZZA a punti di controllo, dislivello limitato (±70) = pendenze DOLCI (niente
    // muri verticali che il PG "scalerebbe"). POSITIVO = collina (sopra il pavimento), NEGATIVO =
    // cunetta (sotto). Quantizzato a gradini. Piatto vicino a spawn/goal.
    const pts = [];
    let x = 0, h = 40;
    while (x <= this.worldW) {
      if (x > 560 && x < this.worldW - 480) h = Phaser.Math.Clamp(h + Phaser.Math.Between(-70, 70), -this.TERR_DIP, this.TERR_MAXH);
      else h = 0;
      pts.push({ x, y: h });
      x += Phaser.Math.Between(150, 240);
    }
    pts.push({ x: this.worldW, y: 0 });
    this._terrainPts = pts;
    // DISEGNO del terreno seguendo `terrainTopAt` (colline + cunette). La COLLISIONE la fa la
    // "mappa di altezze" (heightmap-snap) nel update, non blocchi fisici → niente cuciture che
    // incastrano. L'ASPETTO lo fa GameGfx.paintOrganicMass (massa di tessuto disegnata via
    // codice, stessi toni del fondale); la FORMA resta questa, che e' gameplay.
    window.GameGfx.paintOrganicMass(this, (x) => this.terrainTopAt(x), { verso: 1, lontano: H + 200, depth: 4.3 });
  },

  // Altezza del terreno in x (POSITIVO = collina sopra il pavimento, NEGATIVO = cunetta sotto),
  // quantizzata a gradini di TERR_STEP.
  terrainHeightAt(x) {
    const raw = this._sampleProfile(this._terrainPts, x, 0);
    return Phaser.Math.Clamp(Math.round(raw / this.TERR_STEP) * this.TERR_STEP, -this.TERR_DIP, this.TERR_MAXH);
  },

  // y della SUPERFICIE del terreno in x (piu' in alto sulle colline, piu' in basso nelle cunette).
  terrainTopAt(x) { return this.groundTop - this.terrainHeightAt(x); },

  // Pedane sospese: una "rampa" davanti a ogni membrana bassa (per scavalcarla con un
  // salto) + piu' pedane (basse E alte) tra le membrane, quasi sempre con un bonus di
  // cerume sopra. Una volta a livello, sopra una pedana alta si nasconde uno SCRIGNO
  // segreto (un'altra pedana ancora piu' su, raggiungibile con un salto extra).
  buildPlatforms() {
    // Arena boss (parte destra vicino al timpano): nessuna pedana-riparo, per non rendere
    // banale il fight. this.goalX non e' ancora impostato qui (lo fa buildGoal, DOPO in
    // buildLevel), percio' usiamo una soglia su this.worldW.
    const bossArenaX = this.levelKind === 'boss' ? this.worldW - 800 : Infinity;

    // Dislivello massimo raggiungibile con UN SOLO salto (il doppio salto e' uno sblocco, non
    // garantito: le pedane devono restare a portata anche senza). Apice teorico del salto =
    // v^2/(2g) con la gravita' DI BASE (non quella eventualmente ridotta da un mutatore
    // "poca gravita'": cosi' il livello resta raggiungibile anche nel caso peggiore, e con
    // gravita' ridotta e' semplicemente piu' facile). Margine di sicurezza 0.82 (non l'apice
    // esatto: a fine salita il controllo orizzontale e' ridotto).
    const p = window.GameState.player;
    const MAXUP = (p.jumpVelocity * p.jumpVelocity) / (2 * window.CONFIG.GRAVITY) * 0.82;
    // TETTO (round 2 B.2 + round 4): nessuna pedana puo' salire cosi' tanto da entrare nel
    // SOFFITTO LOCALE (round 4: ondulato) o da non lasciare spazio a testa+salto sotto di esso —
    // altrimenti e' irraggiungibile / in conflitto col soffitto. Usa `ceilingYAt(px)` al posto del
    // vecchio `CEIL_Y` fisso. Corpo del PG ~40px + margine 16px. `px` = x della pedana.
    // 104 e non 56: il margine deve bastare al SOFFITTO PIU' IL PERSONAGGIO IN PIEDI SOPRA la
    // pedana. Con 56 restava lo spazio per la pedana ma non per starci sopra, e in un tratto
    // stretto (livello 10, vicino alla Regina) la pedana alta era irraggiungibile perche' il
    // soffitto bloccava il PG a mezz'aria — segnalato dall'utente 2026-07-29.
    const clampAbove = (refY, rawY, px) => Math.max(rawY, refY - MAXUP, (px != null ? this.ceilingYAt(px) : this.CEIL_Y) + 104);
    // ⚠️ L'appoggio da cui si salta e' la superficie LOCALE del terreno, non la vecchia linea
    // piatta 360 (bug trovato dai controlli automatici il 2026-07-20): usando 360 su una collina
    // la pedana finiva DENTRO il terreno, e dentro una cunetta restava troppo in alto per essere
    // raggiunta (misurate pedane a 161px contro un massimo saltabile di 117).
    const suolo = (px) => this.terrainTopAt(px);

    this.membranes.forEach((m) => {
      if (m.type !== 'short') return;
      const px = Math.max(200, m.x - 110);
      if (px >= bossArenaX) return;
      const py = clampAbove(suolo(px), suolo(px) - Phaser.Math.Between(72, 96), px);
      this.addPlatform(px, py, 110);
    });

    const xs = this.membraneXs;
    let secretPlaced = false;
    for (let i = 0; i < xs.length - 1; i++) {
      const gapW = xs[i + 1] - xs[i];
      let lowY = null, lowPx = null;   // pedana bassa: da li' si sale a quella alta (null = si sale dal terreno)
      // Pedana bassa: quasi sempre presente se il varco e' abbastanza largo.
      if (gapW > 260 && Math.random() < 0.7) {
        const lowX = Math.round(xs[i] + gapW * Phaser.Math.FloatBetween(0.25, 0.4));
        if (lowX < bossArenaX) {
          const py = clampAbove(suolo(lowX), suolo(lowX) - Phaser.Math.Between(90, 130), lowX);
          this.addPlatform(lowX, py, Phaser.Math.Between(90, 120));
          if (Math.random() < 0.7) this.addWaxPickup(lowX, py - 26, Math.random() < 0.35);   // a volte CURA
          lowY = py; lowPx = lowX;
        }
      }
      // Pedana alta: premia chi sale a cercarla.
      if (Math.random() < 0.55) {
        const midX = Math.round(xs[i] + gapW * Phaser.Math.FloatBetween(0.5, 0.75));
        if (midX < bossArenaX) {
          // Ci si puo' appoggiare alla pedana bassa SOLO se e' abbastanza vicina in orizzontale:
          // in un salto si copre ~175px, quindi una pedana bassa lontana non e' un vero appoggio
          // e la pedana alta risulterebbe irraggiungibile (trovato dai controlli il 2026-07-20).
          const vicina = (lowY != null && Math.abs(midX - lowPx) < 170);
          const rif = vicina ? lowY : suolo(midX);
          const py = clampAbove(rif, suolo(midX) - Phaser.Math.Between(150, 220), midX);
          this.addPlatform(midX, py, Phaser.Math.Between(90, 130));
          if (Math.random() < 0.75) this.addWaxPickup(midX, py - 26, Math.random() < 0.45);   // pedana alta: piu' spesso CURA
          // SEGRETO (non segnalato): a volte, sopra questa pedana, uno scrigno ancora piu'
          // in alto — un salto in piu' rispetto al percorso ovvio. Una sola volta a livello.
          if (!secretPlaced && Math.random() < 0.35) {
            secretPlaced = true;
            const sx = midX + Phaser.Math.Between(-20, 20);
            const sy = clampAbove(py, py - Phaser.Math.Between(74, 96), sx);   // raggiungibile con un salto dalla pedana alta
            this.addPlatform(sx, sy, 70);
            for (let k = -1; k <= 1; k++) this.addWaxPickup(sx + k * 20, sy - 28, k === 0);
          }
        }
      }
    }
    // Rampa d'avvio prima della prima membrana (stesso bug delle pedane: anche questa deve
    // restare a portata di un salto solo dal suolo).
    const rampX = Math.max(200, xs[0] - 240);
    this.addPlatform(rampX, clampAbove(suolo(rampX), suolo(rampX) - Phaser.Math.Between(110, 150), rampX), 120);
  },

  // Terreno accidentato: pozze di cerume scivoloso (rallentano se ci cammini sopra, dal
  // lvl 2) e ostacoli mobili che vanno avanti e indietro e feriscono al contatto (dal
  // lvl 3). Entrambi crescono di numero (e i mobili di velocita') col livello.
  buildHazards() {
    const lvl = window.GameState.level;
    this.slimeZones = [];
    const slimeCount = lvl >= 2 ? Phaser.Math.Clamp(1 + Math.floor(lvl / 3), 1, 4) : 0;
    for (let i = 0; i < slimeCount; i++) this.addSlimeZone();

    // Gocce dal soffitto (dal lvl 2): "movers" contiene le GOCCE che cadono (riusa l'overlap
    // col giocatore per il danno), "drips" sono gli emettitori fissi a soffitto.
    this.movers = this.physics.add.group({ allowGravity: false });
    this.drips = [];
    const dripCount = lvl >= 2 ? Phaser.Math.Clamp(Math.floor(lvl / 2), 1, 4) : 0;
    for (let i = 0; i < dripCount; i++) this.addDripHazard();
  },

  // Pozza di cerume scivoloso sul pavimento: solo visiva + una fascia x memorizzata in
  // this.slimeZones, letta in update() per rallentare il giocatore mentre e' a terra.
  // Terreno abbastanza PIATTO su [x, x+w]? La pozza segue il profilo del terreno, ma dove il
  // terreno e' ripido/spezzato (bordo di collina o cunetta) la patina si accartoccia e viene
  // brutta (segnalato utente 2026-07-25). Si accetta solo se il dislivello sotto la pozza e'
  // contenuto.
  terrainFlatEnough(x, w, maxDislivello) {
    let mn = Infinity, mx = -Infinity;
    for (let px = x; px <= x + w; px += 12) {
      const y = this.terrainTopAt(px);
      if (y < mn) mn = y; if (y > mx) mx = y;
    }
    return (mx - mn) <= maxDislivello;
  },

  addPlatform(x, y, w) {
    const h = 16;
    // Il rettangolo resta il CORPO FISICO (quota d'appoggio e collisione invariate) ma non si
    // vede: l'aspetto lo disegna GameGfx.paintLedge, in tinta col terreno e col soffitto.
    const r = this.add.rectangle(x, y, w, h).setVisible(false);
    this.physics.add.existing(r, true);
    this.platforms.add(r);
    window.GameGfx.paintLedge(this, x, y, w, h);
  },

  // Il timpano in fondo a destra: traguardo del livello. Raggiungerlo = vittoria.
  buildGoal() {
    const H = window.CONFIG.HEIGHT;
    const gh = window.CONFIG.GROUND_H;
    this.goalX = this.worldW - 150;
    // Il timpano stava a goalX+40 = worldW-110: con la telecamera bloccata al bordo del mondo il
    // suo lato destro finiva FUORI schermo, e proprio nell'istante della vittoria si vedeva
    // tagliato. Spostato appena a sinistra del traguardo: ci sta tutto, con un po' di margine.
    const cx = this.goalX - 10;
    const cy = (H - gh) * 0.5;
    const ah = (H - gh) * 0.92;

    // Timpano: immagine AI (round B, B.1) — sprite scontornato dal magenta, scalato all'altezza
    // del condotto, che "respira". Il traguardo (vittoria) dipende da `goalX`, non dallo sprite.
    const ed = this.add.image(cx, cy, 'eardrum').setDepth(3);
    const es = (ah * 0.95) / ed.height;
    ed.setScale(es);
    // Incasso nella carne DIETRO al timpano: senza, l'ovale ritagliato sembrava appeso in mezzo al
    // condotto (segnalato dal playtest 2026-07-25). Disegnato dopo aver saputo la scala vera.
    window.GameGfx.paintEardrumSocket(this, cx, cy, ed.displayWidth / 2, ed.displayHeight / 2);
    this.tweens.add({ targets: ed, scaleX: es * 1.04, scaleY: es * 1.03, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

    // Indizio "vai a destra" che fluttua davanti al timpano.
    const arrow = this.add.text(this.goalX - 70, cy, '>>', {
      fontFamily: 'monospace', fontSize: '40px', color: '#fff7e8', stroke: '#14161f', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(7).setAlpha(0.85);
    this.tweens.add({ targets: arrow, x: this.goalX - 36, alpha: 0.3, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  },

  // Colore del cerume per TIPO (ricolora lo sprite ambra) e scurito col danno (k = vita 0..1).
  _waxTint(type, k) {
    const base = { soft: 0xffffff, hard: 0xd59a2e, dirt: 0x9a7040 }[type] || 0xffffff;
    if (k >= 1) return base;
    const f = 0.5 + 0.5 * Phaser.Math.Clamp(k, 0, 1);   // fino a metà luminosità quando quasi distrutto
    const r = (base >> 16) & 255, g = (base >> 8) & 255, b = base & 255;
    return ((r * f | 0) << 16) | ((g * f | 0) << 8) | (b * f | 0);
  },

  // Costruisce il MURO DI CERUME coi pezzi/sprite AI: uno sprite-chunk per ogni blocco fisico
  // (variante deterministica, ricolorato per tipo, largo così si sovrappone ai vicini = massa
  // continua, non palline). Sotto le sporgenze (nessun blocco sotto) aggiunge una goccia/colata.
  // I blocchi restano la fisica/gameplay invisibile; questi sprite sono solo il "vestito".
  buildWaxSprites() {
    const B = window.CONFIG.BLOCK;
    const CH = ['wax_a', 'wax_b', 'wax_c', 'wax_d'];
    const DR = ['wax_drip_a', 'wax_drip_b'];
    const h = (n) => { const x = Math.abs(Math.sin(n) * 43758.5453); return x - Math.floor(x); };  // hash deterministico
    const blocks = this.blocks.getChildren().filter((b) => b.active);
    const occ = new Set(blocks.map((b) => b.col + ',' + b.row));
    blocks.forEach((b) => {
      if (b.waxImg) { b.waxImg.destroy(); b.waxImg = null; }
      if (b.waxDrip) { b.waxDrip.destroy(); b.waxDrip = null; }
      const seed = b.col * 13.1 + b.row * 7.7;
      const key = CH[Math.floor(h(seed) * CH.length) % CH.length];
      const src = this.textures.get(key).getSourceImage();
      // "Traballamento" organico: offset/scala/rotazione variabili -> cumulo irregolare, non colonna dritta.
      const ox = (h(seed + 1) - 0.5) * B * 0.55;
      const oy = (h(seed + 2) - 0.5) * B * 0.35;
      const img = this.add.image(b.x + ox, b.y + oy, key).setDepth(6);
      img.setScale((B * 2.2) / src.width * (0.82 + h(seed + 3) * 0.45));   // grandi + sovrapposti = fusi
      img.setAngle((h(seed + 4) - 0.5) * 26);
      if (h(seed + 5) < 0.5) img.setFlipX(true);
      img.setTint(this._waxTint(b.waxType, 1));
      if (this.waxLayer) this.waxLayer.add(img);   // nel livello sfocato -> globi fusi
      b.waxImg = img;
      b.waxOX = ox; b.waxOY = oy;
      // dati per l'animazione "fluida" (ondeggio) in animateWax()
      b.waxSeed = seed;
      b.waxBaseX = b.x + ox; b.waxBaseY = b.y + oy;
      b.waxBaseS = img.scaleX;
      // Goccia sotto lo sporto basso (niente blocco sotto): effetto colata.
      if (b.row > 0 && !occ.has(b.col + ',' + (b.row - 1))) {
        const dk = DR[Math.floor(h(seed + 6) * DR.length) % DR.length];
        const dsrc = this.textures.get(dk).getSourceImage();
        const d = this.add.image(b.x + ox, b.y + B * 0.3, dk).setOrigin(0.5, 0).setDepth(6);
        d.setScale((B * 1.2) / dsrc.width);
        d.setTint(this._waxTint(b.waxType, 1));
        if (this.waxLayer) this.waxLayer.add(d);
        b.waxDrip = d;
        b.waxDripBaseS = d.scaleY;
      }
    });
    this.drawWaxBase();
  },

  // Riempimento continuo (base scura) dietro agli sprite: chiude i vuoti tra un pezzo e l'altro
  // così la massa sembra UNICA. Ridisegnato quando un blocco viene distrutto (la massa si ritira).
  drawWaxBase() {
    const g = this.waxGfx;
    if (!g) return;
    const C = window.CONFIG.COLORS, B = window.CONFIG.BLOCK;
    g.clear();
    const blocks = this.blocks.getChildren().filter((b) => b.active);
    if (!blocks.length) return;
    const BASE = { soft: C.waxSoftDark, hard: C.waxHardDark, dirt: C.dirtDark };
    const byCol = {};
    blocks.forEach((b) => { (byCol[b.col] || (byCol[b.col] = [])).push(b); });
    Object.keys(byCol).forEach((col) => {
      const arr = byCol[col].sort((a, b) => a.row - b.row);
      let run = [arr[0]];
      const flush = () => {
        const top = run[run.length - 1], bot = run[0];
        const x = bot.x, w = B * 1.7, tY = top.y - B / 2, bY = bot.y + B / 2;
        g.fillStyle(BASE[top.waxType], 1);
        g.fillRect(x - w / 2, tY, w, bY - tY);
        g.fillEllipse(x, tY, w, w * 0.6);
      };
      for (let i = 1; i < arr.length; i++) { if (arr[i].row === arr[i - 1].row + 1) run.push(arr[i]); else { flush(); run = [arr[i]]; } }
      flush();
    });
  },


  // Sfondo "condotto uditivo": vedi GameGfx in src/gfx.js.
  drawBackground() { window.GameGfx.drawBackground(this); },

};
