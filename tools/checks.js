// checks.js — CONTROLLI AUTOMATICI del gioco.
//
// Ogni controllo qui dentro nasce da un bug REALMENTE successo: sono le verifiche che finora
// rifacevo a mano ogni volta, raccolte in un posto solo. Si lanciano con:
//     python tools\controlla.py
//
// Come funziona: la funzione gira TUTTA IN UN COLPO SOLO (sincrona). E' importante — se si
// spezzasse in piu' momenti, tra un pezzo e l'altro il gioco continuerebbe a girare per conto suo
// (il ciclo di animazione del browser) e i risultati sarebbero falsi: e' successo davvero, un
// livello finiva da solo tra una misura e l'altra.
//
// Altre due regole imparate a caro prezzo:
// - i frame si fanno avanzare con game.loop.step() usando l'orologio INTERNO del gioco, non
//   quello del browser (divergono e falsano i tempi);
// - il terreno si rigenera a ogni avvio di livello, quindi cercare un punto e poi provarlo
//   DEVE avvenire nella stessa generazione.
window.__earwaxChecks = function (opts) {
  opts = opts || {};
  // 4 livelli bastano: coprono i tipi diversi (normale/corsa/sciame) senza far durare troppo la
  // suite. Se serve piu' copertura: window.__earwaxChecks({ livelli: [1,2,3,4,6,7] }).
  const LIVELLI = opts.livelli || [1, 2, 4, 6];
  const LIVELLO_BOSS = opts.livelloBoss || 5;
  const FRAME_GIOCO = opts.frameGioco || 240;

  const g = window.game;
  const esiti = [];
  const erroriJs = [];
  window.addEventListener('error', (e) => erroriJs.push(String(e.message)));

  // soglie
  const DIST_MIN_SPAWN = 130;   // hotfix 18/07: nemico che nasceva addosso = morte istantanea
  const APERTURA_MIN = 90;      // regola di sicurezza round 4: il condotto sempre attraversabile
  const SALTO_UTILE = 60;       // un salto "vero" supera abbondantemente questo
  const PORTATA_SALTO = 155;    // quanto in alto si arriva da un appoggio (apice misurato ~141)

  const ok = (controllo, livello, dettaglio) => esiti.push({ controllo, livello, esito: 'OK', dettaglio: dettaglio || '' });
  const ko = (controllo, livello, dettaglio) => esiti.push({ controllo, livello, esito: 'FALLITO', dettaglio: dettaglio });

  let t = g.loop.time;
  const avanza = (gs, n, godmode) => {
    for (let i = 0; i < n; i++) {
      t += 16.6;
      g.loop.step(t);
      if (godmode !== false) { window.GameState.player.hp = 999999; gs.invulnUntil = 1e12; }
      if (!gs.scene.isActive()) return false;
    }
    return true;
  };

  const avviaLivello = (lv) => {
    ['UpgradeScene', 'PauseScene', 'ShopScene', 'MenuScene'].forEach((k) => { try { g.scene.stop(k); } catch (e) {} });
    window.GameState.reset();
    window.GameState.level = lv;
    g.scene.start('GameScene');
    const gs = g.scene.getScene('GameScene');
    avanza(gs, 16);
    return gs;
  };

  // Un punto "pulito" dove fare le prove: lontano da membrane, cerume E pedane. Le pedane
  // contano perche' una sopra la testa tronca il salto e farebbe fallire il controllo per il
  // motivo sbagliato.
  const pulito = (gs, x) => !(gs.membraneXs || []).some((mx) => Math.abs(mx - x) < 160)
    && !gs.blocks.getChildren().some((b) => b.active && Math.abs(b.x - x) < 70)
    && !gs.platforms.getChildren().some((p) => p.active && Math.abs(p.x - x) < 110);

  // ---------------------------------------------------------------- per ogni livello
  LIVELLI.forEach((lv) => {
    const gs = avviaLivello(lv);

    // [1] CONDOTTO ATTRAVERSABILE — regola di sicurezza del round 4: nessun punto puo' chiudersi.
    let aperturaMin = 1e9, xPeggiore = 0;
    for (let x = 0; x <= gs.worldW; x += 20) {
      const ap = gs.terrainTopAt(x) - gs.ceilingYAt(x);
      if (ap < aperturaMin) { aperturaMin = ap; xPeggiore = x; }
    }
    if (aperturaMin >= APERTURA_MIN) ok('condotto attraversabile', lv, 'apertura minima ' + Math.round(aperturaMin) + 'px');
    else ko('condotto attraversabile', lv, 'apertura ' + Math.round(aperturaMin) + 'px a x=' + xPeggiore + ' (minimo ' + APERTURA_MIN + ')');

    // [2] CERUME SUL TERRENO — bug 20/07: i cumuli restavano alla vecchia quota fissa 360.
    const B = window.CONFIG.BLOCK;
    let peggioreCerume = 0;
    gs.blocks.getChildren().forEach((b) => {
      if (!b.active || b.ceiling || b.row !== 0) return;
      const scarto = Math.abs((b.y + B / 2) - gs.terrainTopAt(b.x));
      if (scarto > peggioreCerume) peggioreCerume = scarto;
    });
    if (peggioreCerume <= 2) ok('cerume appoggiato al terreno', lv, 'scarto max ' + Math.round(peggioreCerume) + 'px');
    else ko('cerume appoggiato al terreno', lv, 'scarto max ' + Math.round(peggioreCerume) + 'px dalla superficie');

    // [3] SPAWN SICURO — hotfix 18/07: nemici che nascevano addosso al giocatore (morte istantanea)
    //     e (30/06) nemici che spuntavano DENTRO una membrana restandoci incastrati.
    const xPartenza = gs.player.x;
    let distMin = 1e9;
    // I GUARDIANI sono piazzati apposta accanto alle membrane: sovrapporsi al cerume per loro e'
    // normale. Quello che conta e' se un nemico ci resta INCASTRATO, quindi si segna chi e'
    // dentro e piu' avanti si controlla se e' riuscito a muoversi.
    const incastrabili = [];
    gs.enemies.getChildren().forEach((e) => {
      if (!e.active || e.kind === 'fly') return;
      const d = Math.abs(e.x - xPartenza);
      if (d < distMin) distMin = d;
      const dentro = gs.blocks.getChildren().some((b) => b.active
        && Math.abs(b.x - e.x) < B / 2 + 6 && Math.abs(b.y - e.y) < B / 2 + 6);
      if (dentro && !e.guard) incastrabili.push({ e, x0: e.x });
    });
    if (distMin === 1e9) distMin = 9999;
    if (distMin >= DIST_MIN_SPAWN) ok('spawn lontano dal giocatore', lv, 'nemico piu' + "'" + ' vicino a ' + Math.round(distMin) + 'px');
    else ko('spawn lontano dal giocatore', lv, 'nemico a soli ' + Math.round(distMin) + 'px (minimo ' + DIST_MIN_SPAWN + ')');
    if (incastrabili.length === 0) {
      ok('nessun nemico incastrato nel cerume', lv);
    } else {
      // "Fermo" non vuol dire "incastrato": certi nemici (il Gorgogliante) stanno apposta immobili
      // a sputare. E' incastrato solo chi SPINGE per muoversi senza riuscirci, cioe' ha velocita'
      // orizzontale ma non avanza. Contarli come bloccati dava falsi allarmi.
      incastrabili.forEach((r) => { r.spinte = 0; r.xPrec = r.e.x; });
      for (let i = 0; i < 180; i++) {
        avanza(gs, 1);
        incastrabili.forEach((r) => {
          if (!r.e.active) return;
          if (Math.abs(r.e.body.velocity.x) > 10 && Math.abs(r.e.x - r.xPrec) < 0.5) r.spinte++;
          r.xPrec = r.e.x;
        });
      }
      const bloccati = incastrabili.filter((r) => r.e.active && r.spinte > 60);
      if (bloccati.length === 0) ok('nessun nemico incastrato nel cerume', lv, incastrabili.length + ' sovrapposti ma liberi di muoversi');
      else ko('nessun nemico incastrato nel cerume', lv, bloccati.length + ' nemici spingono contro il cerume senza avanzare');
    }

    // [4] PEDANE RAGGIUNGIBILI — bugfix E.3 (11/07): pedane troppo in alto = irraggiungibili.
    // La portata si ricava dalle costanti del gioco (stessa formula di buildPlatforms), cosi' il
    // controllo resta valido se un domani si cambia la potenza del salto o la gravita'.
    const pl = window.GameState.player;
    const portata = (pl.jumpVelocity * pl.jumpVelocity) / (2 * window.CONFIG.GRAVITY) * 0.82;
    const pedane = gs.platforms.getChildren().filter((p) => p.active);
    let peggiorSalto = 0, pedaneKo = 0, sepolte = 0;
    const dettaglio = [];
    pedane.forEach((p) => {
      const cima = p.body ? p.body.top : p.y;
      const terreno = gs.terrainTopAt(p.x);
      if (cima > terreno) { sepolte++; return; }          // dentro una collina
      // Miglior appoggio SOTTO la pedana. Vale come appoggio solo cio' che sta entro la portata
      // ORIZZONTALE di un salto (~175px): una pedana lontana non aiuta. Conta anche il CERUME,
      // che e' solido e si usa eccome come gradino (senza contarlo il controllo dava falsi allarmi).
      const PORTATA_ORIZZ = 175;
      let appoggio = terreno;
      pedane.forEach((q) => {
        if (q === p) return;
        const qCima = q.body ? q.body.top : q.y;
        if (qCima > cima && Math.abs(q.x - p.x) < PORTATA_ORIZZ && qCima < appoggio) appoggio = qCima;
      });
      gs.blocks.getChildren().forEach((b) => {
        if (!b.active) return;
        const cimaBlocco = b.y - B / 2;
        if (cimaBlocco > cima && Math.abs(b.x - p.x) < PORTATA_ORIZZ && cimaBlocco < appoggio) appoggio = cimaBlocco;
      });
      const salita = appoggio - cima;
      if (salita > peggiorSalto) peggiorSalto = salita;
      if (salita > portata + 15) {
        pedaneKo++;
        // ⚠️ QUANDO SCATTA, SERVE SAPERE QUALE DELLE DUE COSE E'. Il generatore garantisce che
        // ogni pedana stia entro un salto dal PROPRIO riferimento, che a volte e' il terreno e a
        // volte una pedana piu' bassa; questo controllo cerca l'appoggio solo entro 175px in
        // orizzontale. Se il vero appoggio sta appena oltre, la pedana e' raggiungibile e il
        // difetto e' nella finestra del controllo; se invece non c'e' nessun appoggio nemmeno
        // guardando lontano, la pedana e' davvero isolata ed e' un difetto del gioco.
        // Senza questo dettaglio, l'unica volta che e' scattato (2026-08-04, 1 volta su 2
        // esecuzioni, e mai piu' in 70 livelli generati apposta) non si e' potuto decidere.
        let appLontano = terreno, distLontano = -1;
        const guarda = (q, cimaQ) => {
          if (cimaQ <= cima) return;
          if (cimaQ < appLontano) { appLontano = cimaQ; distLontano = Math.round(Math.abs(q.x - p.x)); }
        };
        pedane.forEach((q) => { if (q !== p) guarda(q, q.body ? q.body.top : q.y); });
        gs.blocks.getChildren().forEach((b) => { if (b.active) guarda(b, b.y - B / 2); });
        dettaglio.push('pedana a x=' + Math.round(p.x)
          + ': salita ' + Math.round(salita) + 'px cercando entro 175px'
          + (distLontano >= 0
              ? '; guardando lontano c e un appoggio a ' + distLontano + 'px che la porta a '
                + Math.round(appLontano - cima) + 'px -> probabile finestra del controllo troppo stretta'
              : '; nessun appoggio a nessuna distanza -> pedana davvero isolata, difetto del gioco'));
      }
    });
    if (pedaneKo === 0 && sepolte === 0) {
      ok('pedane raggiungibili', lv, pedane.length + ' pedane, salita max ' + Math.round(peggiorSalto) + '/' + Math.round(portata) + 'px');
    } else {
      const parti = [];
      if (pedaneKo) parti.push(pedaneKo + ' oltre la portata del salto (max ' + Math.round(peggiorSalto) + ' contro ' + Math.round(portata) + ') | ' + dettaglio.join(' | '));
      if (sepolte) parti.push(sepolte + ' sepolte dentro il terreno');
      ko('pedane raggiungibili', lv, parti.join('; '));
    }

    // [5] SALTO NELLE CUNETTE — bug 20/07: dentro un avvallamento il salto non partiva.
    let cunetta = null;
    for (let x = 700; x < gs.worldW - 700; x += 8) {
      const s = gs.terrainTopAt(x);
      if (s > 372 && pulito(gs, x)) { cunetta = { x, s }; break; }
    }
    if (cunetta) {
      // Si isola il punto: un nemico addosso puo' disturbare il salto e far fallire il controllo
      // per il motivo sbagliato. Qui interessa la FISICA del terreno, non il combattimento.
      gs.enemies.getChildren().forEach((e) => { if (e.active && Math.abs(e.x - cunetta.x) < 220) e.destroy(); });
      // Miglior tentativo su 3: il bug vero (salto annullato dentro la cunetta) da' apice ~0 in
      // TUTTI i tentativi, mentre un singolo tentativo disturbato darebbe un falso allarme.
      let apice = 0;
      for (let tentativo = 0; tentativo < 3; tentativo++) {
        gs.player.x = cunetta.x;
        gs.player.body.reset(cunetta.x, gs.terrainTopAt(cunetta.x) - 60);
        avanza(gs, 40);
        const partenza = gs.player.body.bottom;
        gs.jumpBufferedAt = gs.time.now;
        for (let i = 0; i < 50; i++) {
          // Si tiene premuto finche' STA SALENDO: l'altezza del salto e' variabile e rilasciare
          // troppo presto lo tronca (con un numero fisso di frame il controllo era ballerino).
          gs.touch.jumpHeld = (i < 4) || gs.player.body.velocity.y < -20;
          t += 16.6; g.loop.step(t);
          window.GameState.player.hp = 999999; gs.invulnUntil = 1e12;
          const s = partenza - gs.player.body.bottom;
          if (s > apice) apice = s;
        }
        gs.touch.jumpHeld = false;
        if (apice >= SALTO_UTILE) break;
      }
      if (apice >= SALTO_UTILE) ok('salto dentro la cunetta', lv, 'apice ' + Math.round(apice) + 'px (cunetta a ' + Math.round(cunetta.s) + ')');
      else ko('salto dentro la cunetta', lv, 'apice ' + Math.round(apice) + 'px: il PG non si stacca (cunetta a ' + Math.round(cunetta.s) + ')');
    } else {
      ok('salto dentro la cunetta', lv, 'nessuna cunetta in questo livello, saltato');
    }

    // [6] NIENTE SPROFONDAMENTI + [7] VOLANTI NON INCASTRATI, giocando davvero (con bastonate).
    //     Sprofondamenti: bug 30/06 "i nemici finiscono sotto la linea del pavimento".
    //     Volanti: rischio segnalato l'11/07 e mai verificato (moscerino contro una pedana).
    const gs2 = avviaLivello(lv);
    let maxConsecutivi = 0, pgAffondato = 0, volanteFermo = 0, sprofSpawn = 0;
    const consecutivi = new Map(), fermi = new Map();
    for (let i = 0; i < FRAME_GIOCO; i++) {
      t += 16.6; g.loop.step(t);
      window.GameState.player.hp = 999999; gs2.invulnUntil = 1e12;
      if (!gs2.scene.isActive()) break;
      if (i % 30 === 0) {
        const vivi = gs2.enemies.getChildren().filter((e) => e.active && !e.spawning && e.kind !== 'fly');
        if (vivi.length) gs2.damageEnemy(vivi[0], 1, true);     // bastonata: provoca il rinculo
      }
      gs2.enemies.getChildren().forEach((e) => {
        if (!e.active) return;
        // ANCHE durante la comparsa: escluderla e' il motivo per cui questo controllo non aveva
        // visto il bug del 2026-07-22 (i nemici cadevano sotto il suolo mentre "emergevano",
        // perche' lo snap li salta ma la gravita' no). Chi emerge non deve MAI finire sotto.
        if (e.spawning) {
          if (e.kind !== 'fly') {
            const giu = e.body.bottom - gs2.terrainTopAt(e.x);
            if (giu > sprofSpawn) sprofSpawn = giu;
          }
          return;
        }
        if (e.kind === 'fly') {
          const fermo = Math.abs(e.body.velocity.x) + Math.abs(e.body.velocity.y) < 5;
          const c = fermo ? (fermi.get(e) || 0) + 1 : 0;
          fermi.set(e, c);
          if (c > volanteFermo) volanteFermo = c;
          return;
        }
        const sotto = e.body.bottom - gs2.terrainTopAt(e.x);
        const c = sotto > 30 ? (consecutivi.get(e) || 0) + 1 : 0;
        consecutivi.set(e, c);
        if (c > maxConsecutivi) maxConsecutivi = c;
      });
      const dp = gs2.player.body.bottom - gs2.terrainTopAt(gs2.player.x);
      if (dp > pgAffondato) pgAffondato = dp;
    }
    // qualche frame sprofondato e' normale (guizzo di atterraggio dopo il rinculo): conta la DURATA
    if (maxConsecutivi <= 12) ok('nemici non sprofondati', lv, 'max ' + maxConsecutivi + ' frame consecutivi sotto il terreno');
    else ko('nemici non sprofondati', lv, 'un nemico e\' rimasto ' + maxConsecutivi + ' frame sotto la superficie');
    if (pgAffondato <= 20) ok('giocatore non sprofondato', lv, 'max ' + Math.round(pgAffondato) + 'px');
    else ko('giocatore non sprofondato', lv, 'sceso ' + Math.round(pgAffondato) + 'px sotto la superficie');
    if (volanteFermo <= 90) ok('volanti non incastrati', lv, 'max ' + volanteFermo + ' frame immobili');
    else ko('volanti non incastrati', lv, 'un volante e\' rimasto immobile ' + volanteFermo + ' frame');
    if (sprofSpawn <= 6) ok('comparsa senza sprofondare', lv, 'max ' + Math.round(sprofSpawn) + 'px sotto la superficie');
    else ko('comparsa senza sprofondare', lv, 'un nemico e\' sceso ' + Math.round(sprofSpawn) + 'px sotto il terreno mentre compariva');

    // [8] SFONDO — 3 strati caricati (regressione del sistema a set).
    const strati = (gs2.bgLayers || []).length;
    if (strati === 3) ok('sfondo a 3 strati', lv);
    else ko('sfondo a 3 strati', lv, 'trovati ' + strati + ' strati');

    // [9] SCENA VIVA (non bloccata a meta' livello)
    if (gs2.scene.isActive() && !gs2.locked) ok('scena viva', lv);
    else ko('scena viva', lv, 'scena ' + (gs2.scene.isActive() ? 'bloccata' : 'non attiva'));
  });

  // ---------------------------------------------------------------- controlli speciali

  // [10] IL BOSS STACCA DA TERRA — hotfix 18/07: il salto del boss veniva annullato dallo
  //      stiramento applicato mentre era ancora appoggiato (il fix del round 2 non funzionava).
  {
    const gs = avviaLivello(LIVELLO_BOSS);
    avanza(gs, 60);
    let apiceBoss = 0;
    const boss = gs.enemies.getChildren().find((e) => e.active && e.kind === 'boss');
    const trovato = !!boss;
    // Il boss attacca solo se il giocatore gli sta VICINO: senza questo non salta mai e il
    // controllo darebbe un falso allarme (successo davvero la prima volta).
    if (boss) {
      // Non si ASPETTA che il boss decida di saltare: il suo balzo dipende da un timer casuale
      // e dalla distanza, quindi aspettare rendeva il controllo lento e ballerino (a volte
      // passava, a volte no, senza che nulla fosse rotto). Qui si toglie di mezzo l'attesa
      // azzerando il timer e tenendo il giocatore a tiro: il balzo lo fa comunque il codice del
      // gioco, quindi se il meccanismo si rompe di nuovo (era: lo stiramento applicato mentre
      // il boss e' ancora appoggiato gli annullava la velocita') il controllo se ne accorge.
      for (let i = 0; i < 600; i++) {
        if (!gs.scene.isActive() || !boss.active) break;
        if (i % 20 === 0) {
          const bx = Math.max(80, boss.x - 130);
          gs.player.body.reset(bx, gs.terrainTopAt(bx) - 40);
          boss.slamReadyAt = 0;                        // "puoi attaccare adesso"
        }
        t += 16.6; g.loop.step(t);
        window.GameState.player.hp = 999999; gs.invulnUntil = 1e12;
        const h = gs.terrainTopAt(boss.x) - boss.body.bottom;
        if (h > apiceBoss) apiceBoss = h;
        if (apiceBoss >= 40) break;                    // ha staccato: basta cosi'
      }
    }
    if (!trovato) ko('il boss stacca da terra', LIVELLO_BOSS, 'boss mai comparso nel livello ' + LIVELLO_BOSS);
    else if (apiceBoss >= 40) ok('il boss stacca da terra', LIVELLO_BOSS, 'apice ' + Math.round(apiceBoss) + 'px');
    else ko('il boss stacca da terra', LIVELLO_BOSS, 'apice ' + Math.round(apiceBoss) + 'px: resta incollato al suolo');
  }

  // [11] PROVA SENZA GOD-MODE — regola imparata il 18/07: col god-mode sempre acceso i bug di
  //      DANNO restano invisibili (due hotfix erano sfuggiti proprio per questo). Qui il
  //      giocatore sta FERMO all'inizio del livello e deve sopravvivere: se muore, qualcosa
  //      lo sta uccidendo appena nato.
  {
    const gs = avviaLivello(1);
    window.GameState.player.hp = window.GameState.player.maxHp || 100;
    gs.invulnUntil = 0;
    let vivo = true;
    for (let i = 0; i < 240; i++) {          // ~4 secondi immobile
      t += 16.6; g.loop.step(t);
      if (!gs.scene.isActive() || window.GameState.player.hp <= 0) { vivo = false; break; }
    }
    const hp = window.GameState.player.hp;
    if (vivo) ok('sopravvive fermo allo start (senza god-mode)', 1, 'vita rimasta ' + Math.round(hp));
    else ko('sopravvive fermo allo start (senza god-mode)', 1, 'morto restando fermo nei primi 4 secondi');
  }

  // ---------------------------------------------------------------- BLOCCO A (round A, 22/07):
  // finale della run + scelta del percorso. Le prove [12]-[13] testano il CONTRATTO piu' a
  // rischio (GameScene.create() che legge window.GameState.prossimoLivello), bypassando la UI
  // (click sulle carte) per restare veloci e mirate; [14]-[15] verificano l'instradamento e la
  // vittoria passando per le scene vere (UpgradeScene/DoorScene), chiamando i loro metodi
  // direttamente invece di simulare i click.
  const STOP_META = ['UpgradeScene', 'DoorScene', 'VictoryScene', 'PauseScene', 'ShopScene', 'MenuScene', 'GameScene'];
  const fermaMeta = () => STOP_META.forEach((k) => { try { g.scene.stop(k); } catch (e) {} });
  // `this.scene.start(...)` chiamato da DENTRO un metodo di scena (es. UpgradeScene.choose(),
  // DoorScene.choose()) e' ACCODATO da Phaser, non immediato: serve un tick del loop prima che
  // la nuova scena compaia in getScenes(true) (o che la sua create() sia girata). Verificato
  // riproducendo il problema: senza questo tick i controlli [13]-[15] fallivano non perche' il
  // gioco fosse rotto, ma perche' leggevano lo stato un istante troppo presto.
  const passaTick = (n) => { for (let i = 0; i < (n || 2); i++) { t += 16.6; g.loop.step(t); } };

  // [12] PORTA RISPETTATA DA GameScene — il livello generato deve rispettare ESATTAMENTE tipo,
  // modificatore e ricompensa scelti alla porta (contratto window.GameState.prossimoLivello).
  {
    const provaPortaSu = (lv, porta) => {
      fermaMeta();
      window.GameState.reset();
      window.GameState.level = lv;
      window.GameState.prossimoLivello = porta;
      g.scene.start('GameScene');
      const gs = g.scene.getScene('GameScene');
      avanza(gs, 4);
      return gs;
    };

    // porta RISCHIOSA: tipo + mutatore forzato (100%, non piu' un sorteggio) + ricompensa x2.
    const gsR = provaPortaSu(6, { kind: 'siege', mutator: 'armored', waxMult: 2 });
    const kindOkR = gsR.levelKind === 'siege';
    const mutOkR = !!gsR.mutator && gsR.mutator.id === 'armored' && gsR.mutEnemyHp === 1.7;
    const waxOkR = Math.abs((gsR.mutWaxMult || 1) - 2) < 0.01;
    const consumataR = window.GameState.prossimoLivello == null;   // non deve restare per il livello dopo
    if (kindOkR && mutOkR && waxOkR && consumataR) {
      ok('porta rispettata (rischiosa)', 6, 'kind=' + gsR.levelKind + ' mutatore=' + gsR.mutator.id + ' waxMult=' + gsR.mutWaxMult);
    } else {
      ko('porta rispettata (rischiosa)', 6, 'kind=' + gsR.levelKind + '(atteso siege) mutatore=' + (gsR.mutator && gsR.mutator.id)
        + '(atteso armored) waxMult=' + gsR.mutWaxMult + '(atteso 2) consumata=' + consumataR);
    }

    // porta SICURA: "nessun modificatore" deve restare TALE — non deve uscirne uno a sorpresa,
    // o l'anteprima mostrata nella porta ("nessun modificatore") diventerebbe bugiarda.
    const gsS = provaPortaSu(7, { kind: 'normal', mutator: null, waxMult: 1 });
    const kindOkS = gsS.levelKind === 'normal';
    const mutOkS = gsS.mutator === null;
    const waxOkS = Math.abs((gsS.mutWaxMult || 1) - 1) < 0.01;
    if (kindOkS && mutOkS && waxOkS) ok('porta rispettata (sicura, nessun modificatore)', 7);
    else ko('porta rispettata (sicura, nessun modificatore)', 7, 'kind=' + gsS.levelKind + ' mutatore=' + (gsS.mutator && gsS.mutator.id) + ' waxMult=' + gsS.mutWaxMult);
  }

  // [13] DoorScene GENERA una scelta valida e CONSUMABILE da GameScene.
  {
    fermaMeta();
    window.GameState.reset();
    window.GameState.level = 6;
    g.scene.start('DoorScene');
    passaTick();
    const ds = g.scene.getScene('DoorScene');
    const dueLati = Array.isArray(ds.doors) && ds.doors.length === 2;
    const diverse = dueLati && ds.doors[0].kind !== ds.doors[1].kind;
    if (dueLati && diverse) {
      ds.choose(ds.doors[1]);
      // Leggere window.GameState.prossimoLivello PRIMA del tick: GameScene.create() la CONSUMA
      // (la azzera) come sua primissima azione, quindi dopo il tick sarebbe gia' null.
      const impostata = window.GameState.prossimoLivello;
      const combacia = impostata && impostata.kind === ds.doors[1].kind && impostata.waxMult === ds.doors[1].waxMult;
      passaTick();
      const versoGioco = g.scene.getScenes(true).some((s) => s.scene.key === 'GameScene');
      if (combacia && versoGioco) ok('DoorScene genera una scelta valida', 6);
      else ko('DoorScene genera una scelta valida', 6, 'la scelta non arriva intatta a GameScene');
    } else {
      ko('DoorScene genera una scelta valida', 6, 'porte mancanti o identiche tra loro (dueLati=' + dueLati + ')');
    }
  }

  // [14] UpgradeScene INSTRADA correttamente: dopo un boss (livello 5) via diretta a GameScene
  // (niente porta — i boss restano fissi); dopo un livello normale (es. 3) passa da DoorScene.
  {
    const cardStub = { id: 'damage', rep: true, apply: (s) => { s.damage += 8; } };

    fermaMeta();
    window.GameState.reset();
    window.GameState.level = 4;   // il prossimo (5) e' boss
    g.scene.start('UpgradeScene');
    passaTick();
    g.scene.getScene('UpgradeScene').choose(cardStub);
    passaTick();
    const dopoBoss = g.scene.getScenes(true).map((s) => s.scene.key);
    const bossOk = dopoBoss.indexOf('GameScene') !== -1 && dopoBoss.indexOf('DoorScene') === -1 && window.GameState.level === 5;

    fermaMeta();
    window.GameState.reset();
    window.GameState.level = 3;   // il prossimo (4) NON e' boss
    g.scene.start('UpgradeScene');
    passaTick();
    g.scene.getScene('UpgradeScene').choose(cardStub);
    passaTick();
    const dopoNormale = g.scene.getScenes(true).map((s) => s.scene.key);
    const normaleOk = dopoNormale.indexOf('DoorScene') !== -1 && dopoNormale.indexOf('GameScene') === -1 && window.GameState.level === 4;

    if (bossOk && normaleOk) ok('UpgradeScene instrada boss/porta correttamente', '-');
    else ko('UpgradeScene instrada boss/porta correttamente', '-', 'dopo boss ok=' + bossOk + '   dopo livello normale ok=' + normaleOk);
  }

  // [15] VITTORIA al livello finale — completare RUN_LEVELS deve portare a VictoryScene (non al
  // livello successivo), incassare il cerume come a fine run e segnare la vittoria in Meta.
  // (Meta scrive su localStorage, ma il browser di questi controlli e' EFFIMERO — niente
  // rischio per i dati salvati veri del giocatore, che vivono in un profilo/browser separato.)
  {
    // ⚠️ PERCORSO CAMBIATO (2026-07-29): finito l'ultimo livello si va DIRITTI alla vittoria,
    // senza far scegliere una carta di potenziamento che non si userebbe mai (segnalato dal
    // playtest). Quindi il controllo ora guida GameScene.levelComplete, non UpgradeScene.choose.
    fermaMeta();
    window.GameState.reset();
    window.GameState.level = window.CONFIG.RUN_LEVELS;
    g.scene.start('GameScene');
    passaTick();
    const gsWin = g.scene.getScene('GameScene');
    avanza(gsWin, 10);
    window.GameState.wax = 321;
    const winsPrima = window.Meta.get().wins;
    const bankPrima = window.Meta.get().bank;
    gsWin.levelComplete();
    avanza(gsWin, 110);        // levelComplete aspetta 1,3s prima di cambiare scena
    passaTick();

    const attive = g.scene.getScenes(true).map((s) => s.scene.key);
    const versoVittoria = attive.indexOf('VictoryScene') !== -1 && attive.indexOf('GameScene') === -1;
    const metaOk = window.Meta.get().wins === winsPrima + 1 && window.Meta.get().bank === bankPrima + 321;
    if (versoVittoria && metaOk) ok('vittoria al livello finale', window.CONFIG.RUN_LEVELS, 'banca +321, vittorie +1');
    else ko('vittoria al livello finale', window.CONFIG.RUN_LEVELS, 'scene attive: ' + attive.join(',') + '   meta ok: ' + metaOk);
  }

  // [16] INFEZIONE — difficolta' crescente (round A, A.5): il grado scelto deve alzare le manopole
  // dei nemici e la ricompensa. Si misura su un LIVELLO BOSS (5): li' chooseMutator() esce subito
  // (niente mutatore) e non c'e' porta, quindi le mut* partono pulite da 1 e riflettono SOLO
  // l'infezione — cosi' il numero atteso e' esatto, senza il rumore di un mutatore casuale.
  {
    const factorAt = (grado) => {
      fermaMeta();
      window.GameState.reset();
      window.GameState.infezione = grado;
      window.GameState.level = 5;
      g.scene.start('GameScene');
      passaTick();
      const gs = g.scene.getScene('GameScene');
      return { hp: gs.mutEnemyHp, dmg: gs.mutEnemyDmg, speed: gs.mutEnemySpeed, wax: gs.mutWaxMult };
    };
    const F = window.CONFIG.INFEZIONE;
    const base = factorAt(0);
    const g3 = factorAt(3);
    const vicino = (a, b) => Math.abs(a - b) < 0.001;
    const baseOk = vicino(base.hp, 1) && vicino(base.wax, 1);   // grado 0 = nessun effetto
    const hpOk = vicino(g3.hp, 1 + F.enemyHp * 3);
    const dmgOk = vicino(g3.dmg, 1 + F.enemyDmg * 3);
    const speedOk = vicino(g3.speed, 1 + F.enemySpeed * 3);
    const waxOk = vicino(g3.wax, 1 + F.waxReward * 3);
    // La vittoria simulata in [15] e' avvenuta al grado 0 -> deve aver sbloccato il grado 1.
    const sbloccoOk = window.Meta.infezioneUnlocked() >= 1;
    window.GameState.infezione = 0;   // non lasciarla sporca per eventuali prove successive
    if (baseOk && hpOk && dmgOk && speedOk && waxOk && sbloccoOk) {
      ok('infezione applica scaling e sblocco', '-', 'grado 3: hp x' + g3.hp.toFixed(2) + ' dmg x' + g3.dmg.toFixed(2) + ' cerume x' + g3.wax.toFixed(2));
    } else {
      ko('infezione applica scaling e sblocco', '-', 'base(hp=' + base.hp + ',wax=' + base.wax + ') g3(hp=' + g3.hp.toFixed(2)
        + ',dmg=' + g3.dmg.toFixed(2) + ',speed=' + g3.speed.toFixed(2) + ',wax=' + g3.wax.toFixed(2) + ') sblocco=' + sbloccoOk);
    }
  }

  // [17] BOSS FINALE (round A, A.2): al livello RUN_LEVELS il boss ha piu' vita e una TERZA fase
  // ("crollo": frana di cerume dal soffitto a 25% HP). I boss INTERMEDI (liv. 5) non cambiano.
  {
    window.GameState.infezione = 0;   // isolare il fattore finale dallo scaling infezione

    const bossDelLivello = (lv) => {
      fermaMeta();
      window.GameState.reset();
      window.GameState.level = lv;
      g.scene.start('GameScene');
      passaTick();
      const gs = g.scene.getScene('GameScene');
      // ⚠️ Si aspetta la CONDIZIONE, non un numero fisso di fotogrammi: dal round 5 il boss non
      // nasce piu' all'istante ma dopo il banner d'apertura (vedi `avvioAl` in GameScene.create),
      // e un'attesa a occhio si romperebbe di nuovo alla prossima taratura di quel tempo.
      const trovaBoss = () => gs.enemies.getChildren().find((e) => e.active && e.kind === 'boss' && !e.spawning);
      for (let i = 0; i < 300 && !trovaBoss(); i++) avanza(gs, 1);
      return { gs, boss: trovaBoss() };
    };
    // porta il boss a fase "crollo" (20% HP) e fa girare l'IA una volta.
    const forzaFase3 = (gs, boss) => {
      if (!boss) return false;
      boss.bossAtk = null;
      boss.hp = Math.round(boss.maxHp * 0.2);
      gs.bossAI(boss, gs.time.now);
      return true;
    };

    const F = bossDelLivello(window.CONFIG.RUN_LEVELS);
    // Le vite attese si LEGGONO dalla costante del gioco (CONFIG.VITA_NEMICI, giro di
    // bilanciamento 2026-07-29) invece di ricopiarle a mano: se no il controllo va ri-aggiustato
    // a ogni taratura e smette di dire qualcosa.
    const V = window.CONFIG.VITA_NEMICI;
    const hpAttesaFinale = Math.round(Math.round((420 + window.CONFIG.RUN_LEVELS * 40) * 1.7) * V);
    const finaleFlag = !!(F.boss && F.boss.finale);
    const hpFinaleOk = !!(F.boss && F.boss.maxHp === hpAttesaFinale);
    forzaFase3(F.gs, F.boss);
    const crolloOk = !!(F.boss && F.boss._collapse === true && F.gs.quakeTimer);

    const M = bossDelLivello(5);
    const hpNormaleOk = !!(M.boss && M.boss.maxHp === Math.round((420 + 5 * 40) * V) && !M.boss.finale);
    forzaFase3(M.gs, M.boss);
    const intermedioNoCrollo = !!(M.boss && !M.boss._collapse);

    if (finaleFlag && hpFinaleOk && crolloOk && hpNormaleOk && intermedioNoCrollo) {
      ok('boss finale: piu vita + terza fase', window.CONFIG.RUN_LEVELS,
        'hp ' + (F.boss && F.boss.maxHp) + ' (boss liv.5: ' + (M.boss && M.boss.maxHp) + '), crollo ok');
    } else {
      ko('boss finale: piu vita + terza fase', window.CONFIG.RUN_LEVELS,
        'finaleFlag=' + finaleFlag + ' hpFinaleOk=' + hpFinaleOk + ' crolloOk=' + crolloOk
        + ' hpNormaleOk=' + hpNormaleOk + ' intermedioNoCrollo=' + intermedioNoCrollo);
    }
  }

  // [18] SALTO SUI NEMICI (giro difficolta' 2026-07-25): cadendo sulla testa di un nemico si
  // RIMBALZA e lo si colpisce, SENZA prendere danno. Delicato perche' il rilevamento deve battere
  // lo snap al terreno, che risucchia il PG al suolo attraverso il nemico (non solido) azzerando
  // la velocita' -> se il rilevamento e' troppo stretto lo stomp non parte mai (successo davvero).
  {
    fermaMeta();
    window.GameState.reset();
    window.GameState.level = 2;
    window.GameState.prossimoLivello = { kind: 'normal', mutator: null, waxMult: 1 };   // livello DETERMINISTICO
    g.scene.start('GameScene');
    passaTick();
    const gs = g.scene.getScene('GameScene');
    avanza(gs, 20);
    if (gs.spawnTimer) gs.spawnTimer.remove();          // niente nuovi nemici durante la prova
    gs.enemies.getChildren().forEach((e) => { if (e.active) e.destroy(); });
    // spawn il nemico su terreno piatto lontano da membrane, poi LIBERA la colonna di caduta
    // (tolgo pedane/cerume vicino): cosi' la prova non dipende dalla generazione del livello.
    let ex = Math.round(gs.worldW * 0.5);
    for (let x = Math.round(gs.worldW * 0.45); x < gs.worldW - 700; x += 8) {
      if (Math.abs(gs.terrainTopAt(x) - 360) < 6 && !(gs.membraneXs || []).some((mx) => Math.abs(mx - x) < 150)) { ex = x; break; }
    }
    const e = gs.spawnEnemy('blob', { x: ex });
    // ASPETTA CHE ABBIA FINITO DI EMERGERE, non un numero fisso di fotogrammi. Prima erano 40
    // (~660ms) e bastavano, ma dal 2026-07-31 la comparsa dura ~1s: il nemico era ancora
    // `spawning`, cioe' inerte e senza gravita', e il salto gli passava attraverso. Peggio, il
    // controllo falliva a INTERMITTENZA, perche' nel banco di prova i tween non seguono
    // l'orologio simulato ma il tempo reale (vedi in cima a questo file), quindi a volte la
    // comparsa finiva in tempo e a volte no. Aspettare la CONDIZIONE invece del tempo toglie
    // di mezzo tutta questa fragilita'.
    for (let i = 0; i < 200 && e.spawning; i++) avanza(gs, 1);
    avanza(gs, 4);                                     // un attimo per assestarsi a terra
    if (gs.spawnTimer) gs.spawnTimer.remove();          // (di nuovo: avanza potrebbe averlo ricreato? no, ma sicuri)
    gs.platforms.getChildren().forEach((p) => { if (p.active && Math.abs(p.x - e.x) < 100) p.destroy(); });
    // ⚠️ SI LIBERA TUTTA LA COLONNA, senza legare il criterio all'altezza del nemico. Prima era
    // `b.y < e.body.top + 10`, e il 2026-08-03 — alzando cerumino e crosta di 12px perche' i colpi
    // in piedi li prendessero — quel criterio ha smesso di rimuovere i blocchi all'altezza delle
    // spalle: il giocatore ci atterrava sopra e non arrivava mai alla testa. Il controllo
    // segnalava "salto sui nemici rotto" mentre il gioco era a posto.
    gs.blocks.getChildren().forEach((b) => { if (b.active && Math.abs(b.x - e.x) < 90) b.destroy(); });
    const hpNemicoPrima = e.hp;
    window.GameState.player.hp = 100; gs.invulnUntil = 0;   // via il god-mode: il danno deve contare
    gs.player.body.reset(e.x, e.body.top - 50);        // 50px sopra la testa del nemico
    gs.player.setVelocityY(250);                       // in caduta
    // Controlla il danno SOLO nella finestra del rimbalzo (fino a poco dopo lo stacco): un
    // eventuale colpo DOPO, quando il nemico torna e l'invuln e' scaduta, e' un colpo legittimo,
    // non un fallimento dello stomp.
    // ⚠️ La quota della testa si prende SUBITO, prima di far girare anche un solo fotogramma.
    // Il commento qui sotto spiega che il nemico puo' morire sotto il piede e sparire: vero, ma
    // registrarla solo DENTRO il ciclo non basta se muore al PRIMO passo — allora non c'e' nessun
    // valore precedente e la misura resta vuota. Successo il 2026-08-04: il controllo segnalava
    // un problema mentre il gioco aveva fatto tutto giusto (nemico colpito, rimbalzo avvenuto,
    // zero danni) e mancava solo il numero da misurare.
    let rimbalzoMin = 0, hpDopoRimbalzo = 100, staccoAlRimbalzo = null;
    let testaNemico = e.body ? e.body.top : null;
    for (let i = 0; i < 20; i++) {
      t += 16.6; g.loop.step(t);                       // frame RAW (niente god-mode: il danno conta)
      // Quanto distavano i piedi dalla testa nel frame in cui e' partito il rimbalzo. Nasce da un
      // difetto vero (playtest 2026-07-27): la rilevazione anticipava di 48px e il PG rimbalzava
      // per aria, senza che si vedesse l'impatto. Il PG a fine frame e' gia' risalito di ~vy/60px,
      // quindi il valore atteso e' una decina di px in negativo, non una cinquantina.
      // ⚠️ Dal giro di bilanciamento 2026-07-29 il colpo del PG e' x1.5 e i nemici hanno il 20%
      // di vita in meno: un cerumino di livello 2 MUORE sotto il piede, quindi al frame del
      // rimbalzo il suo corpo puo' non esistere piu'. Si tiene da parte la quota della testa
      // frame per frame, e si misura lo stacco con l'ultima nota buona.
      if (e.body) testaNemico = e.body.top;
      if (staccoAlRimbalzo === null && gs.player.body.velocity.y < -50 && testaNemico !== null) {
        staccoAlRimbalzo = gs.player.body.bottom - testaNemico;
      }
      if (gs.player.body.velocity.y < rimbalzoMin) rimbalzoMin = gs.player.body.velocity.y;
      hpDopoRimbalzo = window.GameState.player.hp;
      if (rimbalzoMin < -50 && gs.player.body.velocity.y > 0) break;   // rimbalzato e gia' in risalita finita
    }
    const nemicoColpito = !e.active || e.hp < hpNemicoPrima;
    const haRimbalzato = rimbalzoMin < -50;
    const senzaDanno = hpDopoRimbalzo >= 100;
    const aContatto = staccoAlRimbalzo !== null && Math.abs(staccoAlRimbalzo) <= 20;
    if (nemicoColpito && haRimbalzato && senzaDanno && aContatto) {
      ok('salto sui nemici', 2, 'rimbalzo ' + Math.round(rimbalzoMin) + ', stacco '
        + Math.round(staccoAlRimbalzo) + 'px, nemico colpito, 0 danni');
    } else {
      ko('salto sui nemici', 2, 'nemicoColpito=' + nemicoColpito + ' haRimbalzato=' + haRimbalzato
        + ' senzaDanno=' + senzaDanno + ' stacco=' + staccoAlRimbalzo);
    }
  }

  // [19] ARSENALE CHIUSO (2026-07-29). Dopo il playtest l'utente ha deciso di pubblicare con UN
  // SOLO kit (coton fioc + spruzzino): "si colpisce prevalentemente da lontano, quindi variare le
  // armi corpo a corpo ha poco senso". Il meccanismo resta tutto in piedi, ma il gioco deve
  // partire SEMPRE col kit base — anche se in Meta e' rimasta salvata un'altra arma da prima.
  // Questo controllo verifica proprio quello: che nessun residuo di salvataggio cambi la partita.
  // ⚠️ Se un domani si riapre l'arsenale, questo controllo va rimesso com'era (verificava che il
  // kit scelto arrivasse davvero in newPlayer, meleeSwing e spawnPellet): sta nella cronologia git.
  {
    const armaSalvata = window.Meta.get().arma;
    window.Meta.setUnlock('arma_martello', 1);
    window.Meta.setArma('martello');            // salvataggio "sporco": si prova a forzare un kit
    fermaMeta();
    window.GameState.reset();
    window.GameState.level = 2;
    window.GameState.prossimoLivello = { kind: 'normal', mutator: null, waxMult: 1 };
    g.scene.start('GameScene');
    passaTick();
    const gsArm = g.scene.getScene('GameScene');
    avanza(gsArm, 12);
    const pArm = window.GameState.player;
    const base = window.ARMI.find((a) => a.id === 'fioc');
    // ⚠️ La cadenza attesa si RICAVA dalla manopola `MISCHIA_CADENZA` invece di confrontarla col
    // numero grezzo del kit. Scritta a mano, questo controllo si rompeva a ogni taratura del
    // corpo a corpo pur essendo il gioco a posto — successo il 2026-08-03, quando il colpo e'
    // stato rallentato perche' l'animazione si vedesse (486 invece di 360).
    const cadenzaAttesa = Math.round(base.mischia.cadenza * window.CONFIG.MISCHIA_CADENZA);
    const restaBase = pArm.arma === 'fioc'
      && pArm.attackCooldown === cadenzaAttesa
      && pArm.shotLife === base.getto.gittata
      && window.armaCorrente().mischia.portata === base.mischia.portata;
    window.Meta.setArma(armaSalvata || 'fioc');
    if (restaBase) ok('arsenale chiuso: si parte sempre col kit base', '-', 'coton fioc + spruzzino');
    else ko('arsenale chiuso: si parte sempre col kit base', '-', 'arma=' + pArm.arma
      + ' cadenza=' + pArm.attackCooldown + ' gittata=' + pArm.shotLife);
  }

  // [20] PROIETTILI FERMATI DAL TERRENO (bug segnalato dal playtest 2026-07-29: "i proiettili
  // attraversano le colline"). Il pavimento e' una MAPPA DI ALTEZZE, non un corpo fisico: l'unico
  // collider era un rettangolo piatto in fondo al mondo, quindi tutto cio' che stava sopra quel
  // rettangolo — cioe' ogni collina — veniva attraversato. Ora c'e' un controllo a mano ogni
  // frame; questo test lo tiene onesto.
  {
    fermaMeta();
    window.GameState.reset();
    window.GameState.level = 3;
    window.GameState.prossimoLivello = { kind: 'normal', mutator: null, waxMult: 1 };
    g.scene.start('GameScene');
    passaTick();
    const gsP = g.scene.getScene('GameScene');
    avanza(gsP, 20);
    gsP.shots.getChildren().forEach((s) => { if (s.active) s.destroy(); });
    // Piazza una pallina DENTRO il terreno (sotto il profilo) e una dentro il soffitto: dopo un
    // frame non devono piu' esistere.
    const x = Math.round(gsP.worldW * 0.5);
    const dentroTerra = gsP.shots.create(x, gsP.terrainTopAt(x) + 30, 'soap');
    dentroTerra.body.setAllowGravity(false);
    const dentroSoffitto = gsP.shots.create(x + 60, gsP.ceilingYAt(x + 60) - 30, 'soap');
    dentroSoffitto.body.setAllowGravity(false);
    avanza(gsP, 3);
    const terraOk = !dentroTerra.active;
    const soffittoOk = !dentroSoffitto.active;
    // E nessuna pallina sopravvissuta puo' trovarsi sotto il profilo del terreno.
    const nessunaSepolta = gsP.shots.getChildren().every((s) => !s.active || s.y < gsP.terrainTopAt(s.x));
    if (terraOk && soffittoOk && nessunaSepolta) ok('i proiettili non attraversano le colline', 3);
    else ko('i proiettili non attraversano le colline', 3,
      'terra=' + terraOk + ' soffitto=' + soffittoOk + ' nessunaSepolta=' + nessunaSepolta);
  }

  // [21] CRONOMETRO A PROVA DI PAUSA (bug segnalato 2026-07-29: "se c'e' un timer e metto in
  // pausa, il tempo non si ferma"). La causa era sottile: le scadenze erano calcolate
  // sull'orologio della SCENA (che in pausa si ferma) mentre update() le confrontava con quello
  // del GIOCO (che non si ferma), quindi alla ripresa il conto faceva un salto pari alla pausa.
  // Ora si conta il tempo RIMASTO, scalato di `delta` a ogni frame della scena.
  {
    fermaMeta();
    window.GameState.reset();
    window.GameState.level = 4;
    window.GameState.prossimoLivello = { kind: 'siege', mutator: null, waxMult: 1 };
    g.scene.start('GameScene');
    passaTick();
    const gsT = g.scene.getScene('GameScene');
    avanza(gsT, 20);
    const primaPausa = gsT.siegeLeftMs;
    gsT.scene.launch('PauseScene', { from: 'GameScene' });
    gsT.scene.pause();
    passaTick();
    for (let i = 0; i < 180; i++) { t += 16.6; g.loop.step(t); }   // ~3 secondi di pausa VERA
    const dopoPausa = gsT.siegeLeftMs;
    gsT.scene.resume();
    try { g.scene.stop('PauseScene'); } catch (e) { /* niente */ }
    passaTick();
    avanza(gsT, 30);                                               // mezzo secondo di gioco vero
    const dopoRipresa = gsT.siegeLeftMs;
    const fermoInPausa = Math.abs(dopoPausa - primaPausa) < 50;    // in pausa NON deve scendere
    const riparte = dopoRipresa < dopoPausa - 200;                 // ripreso, deve tornare a scendere
    if (fermoInPausa && riparte) {
      ok('il cronometro si ferma in pausa', 4, 'in pausa ' + Math.round(primaPausa - dopoPausa)
        + 'ms, poi riparte (' + Math.round(dopoPausa - dopoRipresa) + 'ms in mezzo secondo)');
    } else {
      ko('il cronometro si ferma in pausa', 4, 'prima=' + Math.round(primaPausa)
        + ' dopoPausa=' + Math.round(dopoPausa) + ' dopoRipresa=' + Math.round(dopoRipresa));
    }
  }

  // [22] IL RIMBALZO FUNZIONA ANCHE SULLE COLLINE (bug segnalato 2026-07-31, il giro dopo il
  // controllo [20]: "se ottengo il potenziamento dei proiettili che rimbalzano questi continuano
  // a fermarsi"). Il primo rimedio invertiva la velocita' VERTICALE, ma un colpo sparato in
  // orizzontale ha vy≈0: invertire zero lo lasciava incollato alla collina, a bruciare un
  // rimbalzo per fotogramma. Ora si specchia la velocita' attorno alla perpendicolare del
  // pendio. Il controllo spara in piano contro una salita e pretende che il colpo SOPRAVVIVA,
  // esca dal terreno, prenda una componente verticale e consumi UN SOLO rimbalzo.
  {
    fermaMeta();
    window.GameState.reset();
    window.GameState.level = 3;
    window.GameState.prossimoLivello = { kind: 'normal', mutator: null, waxMult: 1 };
    g.scene.start('GameScene');
    passaTick();
    const gsR = g.scene.getScene('GameScene');
    avanza(gsR, 20);
    gsR.shots.getChildren().forEach((s) => { if (s.active) s.destroy(); });
    // cerca una SALITA verso destra (terreno davanti piu' alto, cioe' y minore) in un tratto
    // sgombro: un cumulo di cerume o un nemico sulla traiettoria spappolerebbero il colpo per
    // un motivo diverso da quello in prova.
    // Il livello e' generato a caso ogni volta: cercare solo le salite VERSO DESTRA falliva a
    // volte per assenza di bersagli. Si accetta il primo pendio nei due sensi e si spara in
    // salita, qualunque sia il verso.
    // Non ci si accontenta del primo pendio buono: si cerca il PIU' RIPIDO di tutto il livello.
    // Fermarsi al primo faceva fallire il controllo ogni tanto per "nessuna salita" — un livello
    // generato piatto non e' un difetto del gioco, ed e' esattamente il tipo di intermittenza che
    // toglie fiducia a tutta la suite.
    // ⚠️ SI SCEGLIE IL PENDIO E POI SI LIBERA LA ZONA, invece di cercare un punto gia' sgombro.
    // Pretendere che il livello ne offra uno ha reso questo controllo BALLERINO una terza volta
    // (2026-08-04): il terreno era regolarissimo — misurato su tre livelli di fila, dislivello
    // 108-144px e pendenza massima 18px — ma in quella generazione i cumuli di cerume coprivano
    // ogni punto abbastanza ripido, e il controllo diceva "livello troppo piatto" mentre il gioco
    // era a posto. E' lo stesso rimedio gia' usato nel controllo del salto sui nemici: si toglie
    // di mezzo cio' che disturba invece di sperare che non ci sia.
    let xr = null, verso = 1, meglio = 0;
    for (let x = 200; x < gsR.worldW - 200; x += 4) {
      const qui = gsR.terrainTopAt(x);
      const su = qui - gsR.terrainTopAt(x + 16);       // salita andando a destra
      const giu = qui - gsR.terrainTopAt(x - 16);      // salita andando a sinistra
      if (su > meglio) { meglio = su; xr = x; verso = 1; }
      if (giu > meglio) { meglio = giu; xr = x; verso = -1; }
    }
    if (meglio < 5) xr = null;                          // troppo piatto per essere una prova vera
    if (xr === null) {
      ko("i proiettili rimbalzanti non si piantano nelle colline", 3, "livello troppo piatto: pendenza massima " + meglio + "px su 16");
    } else {
      // libera la traiettoria: un cumulo o un nemico spappolerebbero il colpo per un motivo
      // diverso da quello in prova
      gsR.blocks.getChildren().slice().forEach((b) => { if (b.active && Math.abs(b.x - xr) < 140) b.destroy(); });
      gsR.enemies.getChildren().slice().forEach((e) => { if (e.active && Math.abs(e.x - xr) < 140) e.destroy(); });
      const sh = gsR.shots.create(xr, gsR.terrainTopAt(xr) - 2, 'soap');
      sh.body.setAllowGravity(false);
      sh.bounceLeft = 2;
      sh.setVelocity(300 * verso, 0);               // in piano, dritto contro la salita
      // 10 fotogrammi e non 4: update() gira PRIMA che la fisica sposti i corpi, quindi il
      // controllo di un frame vede la posizione di quello prima — con una finestra stretta il
      // colpo risultava ancora sepolto per un semplice sfasamento.
      avanza(gsR, 10);
      const vivo = sh.active;
      const fuori = vivo && sh.y < gsR.terrainTopAt(sh.x);
      const risale = vivo && sh.body.velocity.y < -20;   // deviato verso l'alto dal pendio
      const unoSolo = sh.bounceLeft >= 1;                // non li ha bruciati a raffica
      if (vivo && fuori && risale && unoSolo) {
        ok('i proiettili rimbalzanti non si piantano nelle colline', 3,
          'vy ' + Math.round(sh.body.velocity.y) + ', rimbalzi rimasti ' + sh.bounceLeft);
      } else {
        ko('i proiettili rimbalzanti non si piantano nelle colline', 3,
          'vivo=' + vivo + ' fuori=' + fuori + ' risale=' + risale
          + ' rimasti=' + sh.bounceLeft);
      }
    }
  }

  // [23] IL PERSONAGGIO SI ABBASSA DAVVERO QUANDO SI ACCOVACCIA (integrato 2026-07-31). Prima si
  // accorciava solo la sagoma invisibile e il disegno restava dritto. Qui si tiene premuto giu',
  // si controlla che parta l'animazione dedicata e che l'altezza A SCHERMO cali, poi si molla e
  // si controlla che risalga. L'animazione e' un PASSAGGIO che si ferma sull'ultimo frame: se
  // qualcuno la rilanciasse ogni frame resterebbe incollata al primo disegno, e questo lo becca.
  {
    fermaMeta();
    window.GameState.reset();
    window.GameState.level = 2;
    window.GameState.prossimoLivello = { kind: 'normal', mutator: null, waxMult: 1 };
    g.scene.start('GameScene');
    passaTick();
    const gsC = g.scene.getScene('GameScene');
    avanza(gsC, 24);
    // ⚠️ getBounds() dello sprite da' la CELLA (84x84), non la sagoma disegnata: misurava sempre
    // 84 e il controllo passava/falliva a vuoto. L'altezza vera si legge dai PIXEL della texture.
    const cimaDi = (indice) => {
      for (let y = 0; y < 84; y++) {
        for (let x = 0; x < 84; x += 3) {
          const a = g.textures.getPixelAlpha(x, y, 'hero_crouch', indice);
          if (a && a > 40) return y;
        }
      }
      return 84;
    };
    const cimaInPiedi = cimaDi(0), cimaGiu = cimaDi(5);

    gsC.touch.aimDown = true;                  // "giu'" premuto (stessa via del pad a schermo)
    avanza(gsC, 3);
    const partita = gsC.heroVisual.anims.currentAnim
      && gsC.heroVisual.anims.currentAnim.key === 'hero_crouch_a';
    avanza(gsC, 20);                           // l'animazione dura ~180ms = 11 fotogrammi
    const fermaSuUltimo = gsC.heroVisual.anims.currentFrame
      && gsC.heroVisual.anims.currentFrame.index === 6;   // 6 frame: l'ultimo e' l'indice 6
    gsC.touch.aimDown = false;
    avanza(gsC, 2);
    // La RISALITA e' lo stesso foglio riletto al contrario: subito dopo aver mollato deve essere
    // ancora l'animazione dell'accovacciamento a girare. Se il personaggio saltasse dritto a
    // "fermo" vorrebbe dire che si rialza di scatto in un fotogramma.
    const risalitaInCorso = gsC.heroVisual.anims.currentAnim
      && gsC.heroVisual.anims.currentAnim.key === 'hero_crouch_a';
    avanza(gsC, 30);
    const tornaNormale = gsC.heroVisual.anims.currentAnim
      && gsC.heroVisual.anims.currentAnim.key === 'hero_idle_a';
    const tornaSuPrimo = risalitaInCorso && tornaNormale;
    const scende = cimaGiu > cimaInPiedi + 5;            // la testa cala di almeno 5px
    if (partita && scende && fermaSuUltimo && tornaSuPrimo) {
      ok('il personaggio si abbassa quando si accovaccia', 2,
        'testa da y=' + cimaInPiedi + ' a y=' + cimaGiu + ' (-' + (cimaGiu - cimaInPiedi)
        + 'px), posa tenuta e poi si rialza');
    } else {
      ko('il personaggio si abbassa quando si accovaccia', 2,
        'animazione=' + partita + ' scende=' + scende + ' posaTenuta=' + fermaSuUltimo
        + ' risale=' + tornaSuPrimo + ' (testa ' + cimaInPiedi + ' -> ' + cimaGiu + ')');
    }
  }

  // [24] CAMMINATA ACCOVACCIATA (2026-07-31). Tre stati che si devono susseguire senza incastri:
  // accovacciato fermo = posa tenuta; accovacciato che si muove = ciclo di camminata; e tornando
  // fermo si deve RIPRENDERE la posa tenuta. Quest'ultimo e' il passaggio delicato: rilanciare
  // 'hero_crouch_a' rifarebbe tutta la discesa da in piedi (il personaggio si alzerebbe e si
  // riabbasserebbe), quindi si rimette a mano l'ultimo fotogramma. Se qualcuno un domani lo
  // "semplifica" con un play(), questo controllo lo becca.
  {
    fermaMeta();
    window.GameState.reset();
    window.GameState.level = 2;
    window.GameState.prossimoLivello = { kind: 'normal', mutator: null, waxMult: 1 };
    g.scene.start('GameScene');
    passaTick();
    const gsW = g.scene.getScene('GameScene');
    avanza(gsW, 24);
    gsW.touch.aimDown = true;
    avanza(gsW, 20);                                   // la discesa dura ~180ms
    const chiave = () => (gsW.heroVisual.anims.currentAnim || {}).key;
    const fermoGiu = chiave();
    gsW.touch.right = true;                            // ...e ora cammina accovacciato
    avanza(gsW, 14);
    const inCammino = chiave();
    const altezzaCammino = gsW.heroVisual.frame.height;
    gsW.touch.right = false;
    avanza(gsW, 20);                                   // si ferma, restando accovacciato
    const tornaFermo = gsW.heroVisual.texture.key;
    const nonSiRialza = !gsW.heroVisual.anims.isPlaying;
    gsW.touch.aimDown = false;
    avanza(gsW, 40);
    const finito = chiave();
    const ok1 = fermoGiu === 'hero_crouch_a';
    const ok2 = inCammino === 'hero_crouchwalk_a';
    const ok3 = tornaFermo === 'hero_crouch' && nonSiRialza;
    const ok4 = finito === 'hero_idle_a';
    if (ok1 && ok2 && ok3 && ok4) {
      ok('camminata accovacciata', 2, 'posa tenuta -> ciclo -> posa tenuta -> in piedi');
    } else {
      ko('camminata accovacciata', 2, 'fermoGiu=' + fermoGiu + ' inCammino=' + inCammino
        + ' tornaFermo=' + tornaFermo + '/' + nonSiRialza + ' finito=' + finito);
    }
  }

  // [25] CI SI SPORCA DI CERUME NEL CORPO A CORPO (2026-07-31, idea dell'utente). Tre cose che
  // devono restare vere: le macchie compaiono colpendo, non superano MAI il tetto (senza, dopo
  // qualche minuto il personaggio e' una palla di cerume), e SEGUONO il corpo invece di restare
  // incollate al livello. L'ultima e' quella che si romperebbe in silenzio.
  {
    fermaMeta();
    window.GameState.reset();
    window.GameState.level = 2;
    window.GameState.prossimoLivello = { kind: 'normal', mutator: null, waxMult: 1 };
    g.scene.start('GameScene');
    passaTick();
    const gsS = g.scene.getScene('GameScene');
    avanza(gsS, 24);
    const pulitoAllInizio = gsS.macchie.length === 0;
    // porta il PG addosso a un cumulo di cerume e picchia finche' non si sporca per bene
    // Si picchia CAMBIANDO bersaglio quando il cumulo si sbriciola: col danno x1,5 e la vita del
    // cerume x0,8 un cumulo cade in due bastonate, e fermandosi al primo il controllo misurava
    // una macchia sola — non provava affatto che il tetto tenga, che e' l'affermazione piu'
    // importante di tutte.
    let colpi = 0, bersagli = 0;
    const MAX = window.GameScene.MACCHIE_MAX;
    while (gsS.macchie.length < MAX && bersagli < 60) {
      const muro = gsS.blocks.getChildren().find((b) => b.active && !b.ceiling);
      if (!muro) break;
      bersagli++;
      gsS.player.body.reset(muro.x - 24, muro.y - 30);
      avanza(gsS, 1);
      for (let i = 0; i < 14 && muro.active && gsS.macchie.length < MAX; i++) {
        gsS.lastAttack = 0;                       // salta l'attesa fra un colpo e l'altro
        // ⚠️ doMelee e non meleeSwing: e' doMelee a GIRARE il personaggio verso il bersaglio.
        // Chiamando direttamente meleeSwing il colpo partiva nel verso in cui il PG guardava per
        // caso, quindi mancava quasi sempre il muro — il controllo passava lo stesso ma provava
        // molto meno di quanto sembrasse (4 macchie in 260 bastonate).
        gsS.doMelee(gsS.time.now, muro);
        colpi++;
        // ⚠️ IL COLPO NON ARRIVA NELL'ISTANTE IN CUI SI PICCHIA. Dal 2026-08-09 il danno (e con
        // lui lo schizzo che ti sporca) parte a meta' animazione, cioe' quando il braccio e'
        // davvero avanti — vedi meleeSwing/meleeImpatto. Con due soli fotogrammi qui il
        // controllo guardava PRIMA che il colpo fosse arrivato e non vedeva nessuna macchia.
        // 16 fotogrammi (~265ms) coprono anche l'animazione piu' lunga possibile (460ms / 2).
        avanza(gsS, 16);
      }
    }
    const siSporca = gsS.macchie.length > 0;
    const sottoIlTetto = gsS.macchie.length <= MAX;
    const arrivaAlTetto = gsS.macchie.length === MAX;   // il tetto e' stato davvero raggiunto
    // ...e ora si muove: le macchie devono spostarsi INSIEME a lui
    const m0 = gsS.macchie[0];
    const primaX = m0 ? m0.x : 0;
    const pgPrima = gsS.player.x;
    gsS.player.body.reset(pgPrima + 120, gsS.player.y);
    avanza(gsS, 3);
    const spostamentoPg = gsS.player.x - pgPrima;
    const seguono = m0 ? Math.abs((m0.x - primaX) - spostamentoPg) < 6 : false;
    if (pulitoAllInizio && siSporca && sottoIlTetto && arrivaAlTetto && seguono) {
      ok('ci si sporca di cerume colpendo', 2, gsS.macchie.length + ' macchie in ' + colpi
        + ' colpi su ' + bersagli + ' cumuli, tetto ' + MAX + ' rispettato, seguono il corpo');
    } else {
      ko('ci si sporca di cerume colpendo', 2, 'pulitoAllInizio=' + pulitoAllInizio
        + ' siSporca=' + siSporca + ' sottoIlTetto=' + sottoIlTetto
        + ' arrivaAlTetto=' + arrivaAlTetto + ' seguono=' + seguono
        + ' (' + gsS.macchie.length + ' macchie)');
    }
  }

  // [26] ASSEDIO A QUOTA (2026-07-31, idea dell'utente). Prima si vinceva SOPRAVVIVENDO fino allo
  // scadere del cronometro, e la tattica migliore era arrampicarsi su un cumulo e stare fermi —
  // cioe' CONSERVARE il cerume in un gioco che chiede di pulirlo. Ora bisogna eliminare una quota
  // di nemici. Tre cose da tenere vere:
  //   a) la quota deve stare BEN SOTTO ai nemici che il gioco riesce a mandare, se no si finisce
  //      ad aspettare che compaiano invece di combatterli (misurato: ~52 in 56s al livello 13);
  //   b) raggiunta la quota il livello finisce SUBITO, anche con tempo che avanza;
  //   c) tempo scaduto senza quota NON e' game over: e' una botta piu' un supplementare.
  {
    fermaMeta();
    window.GameState.reset();
    window.GameState.level = 13;
    window.GameState.prossimoLivello = { kind: 'siege', mutator: null, waxMult: 1 };
    g.scene.start('GameScene');
    passaTick();
    const gsA = g.scene.getScene('GameScene');
    avanza(gsA, 20);
    const quota = gsA.siegeQuota;
    const durata = gsA.siegeLeftMs;
    // quanti nemici riesce a mandare in tutto l'assedio, con un giocatore che li elimina subito
    let mandati = 0;
    const spawnOrig = gsA.spawnEnemy.bind(gsA);
    gsA.spawnEnemy = function () { mandati++; return spawnOrig.apply(null, arguments); };
    mandati = 0;
    for (let i = 0; i < 900; i++) {              // 15 secondi
      avanza(gsA, 1);
      gsA.enemies.getChildren().forEach((e) => { if (e.active && !e.spawning) e.destroy(); });
    }
    gsA.spawnEnemy = spawnOrig;
    const disponibili = Math.round(mandati * (durata / 1000) / 15);
    const quotaSostenibile = quota > 0 && quota <= disponibili * 0.7;

    // (b) raggiunta la quota si chiude subito
    window.GameState.reset();
    window.GameState.level = 13;
    window.GameState.prossimoLivello = { kind: 'siege', mutator: null, waxMult: 1 };
    g.scene.start('GameScene');
    passaTick();
    const gsB = g.scene.getScene('GameScene');
    avanza(gsB, 20);
    gsB.siegeKills = gsB.siegeQuota - 1;
    const tempoCheAvanza = gsB.siegeLeftMs;
    const e2 = gsB.spawnEnemy('blob', { x: gsB.player.x + 200 });
    for (let i = 0; i < 200 && e2.spawning; i++) avanza(gsB, 1);
    gsB.damageEnemy(e2, 99999, true);
    avanza(gsB, 2);
    const chiudeSubito = !gsB.scene.isActive() || gsB.locked;

    // (c) tempo scaduto senza quota: botta + supplementare, NON game over
    window.GameState.reset();
    window.GameState.level = 13;
    window.GameState.prossimoLivello = { kind: 'siege', mutator: null, waxMult: 1 };
    g.scene.start('GameScene');
    passaTick();
    const gsC = g.scene.getScene('GameScene');
    avanza(gsC, 20);
    gsC.siegeKills = 0;
    gsC.siegeLeftMs = 30;
    gsC.avvioAl = 0;   // salta il respiro d'apertura: qui si sta provando il tempo SCADUTO
    window.GameState.player.hp = window.GameState.player.maxHp;
    const vitaPrima = window.GameState.player.hp;
    for (let i = 0; i < 6; i++) { t += 16.6; g.loop.step(t); }   // niente god-mode: la botta conta
    const vitaDopo = window.GameState.player.hp;
    const vivo = gsC.scene.isActive() && !gsC.locked;
    const supplementare = gsC.siegeLeftMs > 1000;
    const faMale = vitaDopo < vitaPrima;

    if (quotaSostenibile && chiudeSubito && vivo && supplementare && faMale) {
      ok('assedio a quota', 13, 'quota ' + quota + ' su ~' + disponibili + ' disponibili in '
        + Math.round(durata / 1000) + 's; finisce alla quota; tempo scaduto = -'
        + (vitaPrima - vitaDopo) + ' vita e ' + Math.round(gsC.siegeLeftMs / 1000) + 's in piu');
    } else {
      ko('assedio a quota', 13, 'quota=' + quota + '/' + disponibili + ' sostenibile=' + quotaSostenibile
        + ' chiudeSubito=' + chiudeSubito + ' vivo=' + vivo + ' supplementare=' + supplementare
        + ' faMale=' + faMale);
    }
  }

  // [27] POSE DI MIRA (2026-08-02). Sparando a terra il CORPO prende una posa col braccio teso e
  // l'arma finisce nella MANO disegnata. Le cose che si romperebbero in silenzio:
  //   a) la posa giusta per ogni caso (avanti / in su / accovacciato / in corsa);
  //   b) l'arma DENTRO la mano e non a mezz'aria — e' l'unica cosa che si nota davvero;
  //   c) in aria NIENTE posa di mira: li' deve restare il salto.
  {
    fermaMeta();
    window.GameState.reset();
    window.GameState.level = 2;
    window.GameState.prossimoLivello = { kind: 'normal', mutator: null, waxMult: 1 };
    g.scene.start('GameScene');
    passaTick();
    const gsM = g.scene.getScene('GameScene');
    avanza(gsM, 24);
    gsM.enemies.getChildren().forEach((e) => { if (e.active) e.destroy(); });

    const prova = (dx, dy, giu, corri) => {
      gsM.facing = 1;
      gsM.touch.aimDown = !!giu;
      gsM.player.setVelocityX(corri ? 220 : 0);
      gsM.showRangedWeapon(dx, dy);
      gsM._weaponHideAt = gsM.time.now + 1e9;
      avanza(gsM, 2);
      // distanza fra l'arma e la MANO della posa: se la posa non e' agganciata bene, l'arma
      // resta appesa all'arco della spalla e questa distanza esplode.
      const t = (gsM._posaMira === 'corsa')
        ? window.GameScene.MANO.corsa[0] : window.GameScene.MANO[gsM._posaMira] || [0, 0];
      const mx = gsM.heroVisual.x + t[0], my = gsM.heroVisual.y + t[1];
      return { posa: gsM._posaMira, tex: gsM.heroVisual.texture.key,
        scarto: Math.hypot(gsM.heroWeapon.x - mx, gsM.heroWeapon.y - my) };
    };
    const a1 = prova(1, 0, false, false);
    const a2 = prova(0, -1, false, false);
    const a3 = prova(1, 0, true, false);
    const a4 = prova(1, 0, false, true);
    gsM.touch.aimDown = false;

    // in aria la posa NON deve comparire
    gsM.player.body.reset(gsM.player.x, gsM.player.y - 120);
    gsM.player.setVelocityY(-200);
    gsM.showRangedWeapon(1, 0);
    gsM._weaponHideAt = gsM.time.now + 1e9;
    avanza(gsM, 2);
    const inAria = gsM._posaMira;

    const pose = a1.posa === 'avanti' && a2.posa === 'su'
      && a3.posa === 'accovacciato' && a4.posa === 'corsa';
    const fogli = a1.tex === 'hero_aim' && a4.tex === 'hero_runaim';
    const inMano = [a1, a2, a3, a4].every((r) => r.scarto < 12);
    const ariaPulita = !inAria;
    if (pose && fogli && inMano && ariaPulita) {
      ok('pose di mira col braccio teso', 2, 'avanti/su/accovacciato/corsa, arma nella mano '
        + '(scarto max ' + Math.round(Math.max(a1.scarto, a2.scarto, a3.scarto, a4.scarto))
        + 'px), in aria resta il salto');
    } else {
      ko('pose di mira col braccio teso', 2, 'pose=' + [a1.posa, a2.posa, a3.posa, a4.posa].join('/')
        + ' fogli=' + fogli + ' inMano=' + inMano + ' inAria=' + inAria
        + ' scarti=' + [a1, a2, a3, a4].map((r) => Math.round(r.scarto)).join(','));
    }
  }

  // [28] ARMA E COLPI (playtest round 5, 2026-08-02). Tre difetti segnalati insieme, tre cose
  // che si romperebbero in silenzio:
  //   a) i colpi devono nascere dall'UGELLO dell'arma disegnata, non dalla pancia del PG;
  //   b) girandosi mentre l'arma e' ancora in mano, l'arma deve seguire il corpo (prima la mano
  //      si specchiava e il puntamento no: si vedeva l'arma rivolta dalla parte sbagliata);
  //   c) l'arma deve restare visibile ALMENO quanto l'intervallo tra un colpo e l'altro, se no
  //      lampeggia tra un colpo e il successivo e con lei sparisce la posa di mira.
  {
    fermaMeta();
    window.GameState.reset();
    window.GameState.level = 2;
    window.GameState.prossimoLivello = { kind: 'normal', mutator: null, waxMult: 1 };
    g.scene.start('GameScene');
    passaTick();
    const gsA = g.scene.getScene('GameScene');
    avanza(gsA, 24);
    gsA.enemies.getChildren().forEach((e) => { if (e.active) e.destroy(); });

    // (a) il colpo nasce dalla bocca. Si misura SUBITO dopo lo sparo, prima che la pallina si muova.
    gsA.facing = 1;
    gsA.lastShot = -1e9;
    gsA.shots.getChildren().forEach((s) => { if (s.active) s.destroy(); });
    gsA.fireJet(1, 0);
    const bocca = gsA.boccaArma();
    const pallina = gsA.shots.getChildren().find((s) => s.active);
    const daBocca = (bocca && pallina) ? Math.hypot(pallina.x - bocca.x, pallina.y - bocca.y) : 999;
    // e la bocca deve stare DAVANTI al corpo, se no il controllo passerebbe anche con l'arma
    // ferma sull'ombelico (bocca e pallina coinciderebbero comunque).
    const boccaAvanti = bocca ? (bocca.x - gsA.player.x) > 10 : false;

    // (c) finestra di visibilita' contro la cadenza di tiro
    const cadenza = window.GameState.player.shotCooldown;
    const finestra = gsA._weaponHideAt - gsA.time.now;
    const nonLampeggia = finestra >= cadenza;

    // (b) ci si gira mentre l'arma e' ancora in mano: deve puntare dall'altra parte
    const versoPrima = Math.cos(gsA.heroWeapon.rotation);
    gsA.facing = -1;
    avanza(gsA, 1);
    const versoDopo = Math.cos(gsA.heroWeapon.rotation);
    const seguIlCorpo = versoPrima > 0.5 && versoDopo < -0.5 && gsA.heroWeapon.flipY === true;

    if (daBocca < 2 && boccaAvanti && nonLampeggia && seguIlCorpo) {
      ok('i colpi partono dalla bocca dell arma', 2, 'scarto ' + daBocca.toFixed(1) + 'px, bocca '
        + Math.round(bocca.x - gsA.player.x) + 'px avanti al corpo; visibile ' + Math.round(finestra)
        + 'ms contro cadenza ' + cadenza + 'ms; girandosi l arma segue');
    } else {
      ko('i colpi partono dalla bocca dell arma', 2, 'daBocca=' + daBocca.toFixed(1)
        + ' boccaAvanti=' + boccaAvanti + ' finestra=' + Math.round(finestra) + '/' + cadenza
        + ' seguIlCorpo=' + seguIlCorpo + ' (cos ' + versoPrima.toFixed(2) + '->' + versoDopo.toFixed(2)
        + ' flipY=' + gsA.heroWeapon.flipY + ')');
    }
  }

  // [29] IL RESPIRO A INIZIO LIVELLO (playtest round 5). Finche' c'e' il banner d'apertura non
  // deve entrare nient'altro: niente nemici e cronometro fermo. E' una regola facile da
  // riperdere, perche' basta rimettere una nascita immediata dentro create().
  {
    fermaMeta();
    window.GameState.reset();
    window.GameState.level = 13;
    window.GameState.prossimoLivello = { kind: 'siege', mutator: null, waxMult: 1 };
    g.scene.start('GameScene');
    passaTick();
    const gsR = g.scene.getScene('GameScene');
    avanza(gsR, 2);
    // I guardiani delle membrane NON contano: non sono nemici che entrano in scena, sono
    // arredamento del livello piazzato lungo tutto il condotto, lontano dalla partenza.
    const assalitori = () => gsR.enemies.getChildren().filter((e) => e.active && !e.guard).length;
    const subitoNemici = assalitori();
    const tempoPieno = gsR.siegeLeftMs;
    const attesa = gsR.avvioAl - gsR.time.now;
    avanza(gsR, 20);                       // ancora dentro l'attesa (20 fotogrammi = ~330ms)
    const durante = assalitori();
    const cronoFermo = gsR.siegeLeftMs === tempoPieno;
    avanza(gsR, 100);                      // oltre l'attesa
    const dopo = assalitori();
    const cronoParte = gsR.siegeLeftMs < tempoPieno;

    if (subitoNemici === 0 && durante === 0 && cronoFermo && dopo > 0 && cronoParte && attesa > 500) {
      ok('respiro a inizio livello', 13, 'attesa ' + Math.round(attesa) + 'ms: 0 nemici e cronometro '
        + 'fermo mentre c e il banner, poi ' + dopo + ' nemici e il tempo parte');
    } else {
      ko('respiro a inizio livello', 13, 'attesa=' + Math.round(attesa) + ' subito=' + subitoNemici
        + ' durante=' + durante + ' cronoFermo=' + cronoFermo + ' dopo=' + dopo + ' cronoParte=' + cronoParte);
    }
  }

  // [30] NEMICI CHE NON VIBRANO (playtest round 5). Quando il giocatore e' esattamente sopra la
  // testa di un nemico a terra, quello deve FERMARSI, non sfarfallare a destra e sinistra.
  // Si misura contando i cambi di segno della velocita' orizzontale: vibrare vuol dire
  // cambiare verso in continuazione.
  {
    fermaMeta();
    window.GameState.reset();
    window.GameState.level = 2;
    window.GameState.prossimoLivello = { kind: 'normal', mutator: null, waxMult: 1 };
    g.scene.start('GameScene');
    passaTick();
    const gsV = g.scene.getScene('GameScene');
    // ⚠️ SI FA NASCERE IL NEMICO CHE SI VUOLE PROVARE, non si prende quello che capita.
    // Questo controllo e' stato ballerino DUE volte per lo stesso motivo di fondo: dipendeva da
    // cosa il livello offriva in quel momento. Prima cercava un nemico dopo un numero fisso di
    // fotogrammi (e ne trovava uno solo se per caso c'era un guardiano li' vicino); poi prendeva
    // il primo disponibile, e il 2026-08-04 gli e' capitato un tipo con un'IA tutta sua — pulce o
    // saltatore — che NON usa la zona morta e quindi non sta mai fermo: il controllo segnalava
    // una vibrazione che non c'era.
    // La zona morta vale per i nemici che CAMMINANO verso di te (cerumino e crosta): si prova
    // quella, esplicitamente.
    gsV.enemies.getChildren().slice().forEach((x) => { if (x.active) x.destroy(); });
    const e = gsV.spawnEnemy('blob', { x: gsV.player.x + 220 });
    for (let i = 0; i < 300 && e && e.active && e.spawning; i++) avanza(gsV, 1);
    let cambi = 0, fermo = 0, campioni = 0;
    if (e) {
      // il giocatore sta esattamente sopra di lui, come stando su una pedana
      gsV.player.body.reset(e.x, e.y - 150);
      let segnoPrec = 0;
      for (let i = 0; i < 40; i++) {
        gsV.player.body.reset(e.x, e.y - 150);   // resta li' sopra, immobile
        avanza(gsV, 1);
        if (!e.active) break;
        const v = e.body.velocity.x;
        const segno = Math.abs(v) < 1 ? 0 : Math.sign(v);
        if (segno !== 0 && segnoPrec !== 0 && segno !== segnoPrec) cambi++;
        if (segno !== 0) segnoPrec = segno;
        if (Math.abs(v) < 1) fermo++;
        campioni++;
      }
    }
    if (e && campioni > 20 && cambi === 0 && fermo > campioni * 0.6) {
      ok('i nemici non vibrano quando gli stai sopra', 2, fermo + '/' + campioni
        + ' fotogrammi da fermo, 0 inversioni di verso');
    } else {
      ko('i nemici non vibrano quando gli stai sopra', 2, 'nemico=' + !!e + ' campioni=' + campioni
        + ' inversioni=' + cambi + ' fermo=' + fermo);
    }
  }

  // [31] RAFFICA RADIALE (playtest round 5, abilita' nuova). Deve sparare in TUTTE le direzioni
  // e, impilandola, aggiungerne altre — non raddoppiare i colpi nella stessa direzione.
  {
    fermaMeta();
    window.GameState.reset();
    window.GameState.level = 2;
    window.GameState.prossimoLivello = { kind: 'normal', mutator: null, waxMult: 1 };
    g.scene.start('GameScene');
    passaTick();
    const gsRad = g.scene.getScene('GameScene');
    avanza(gsRad, 24);
    gsRad.enemies.getChildren().forEach((x) => { if (x.active) x.destroy(); });

    const raffica = (direzioni) => {
      // ⚠️ `.slice()`: distruggere gli oggetti iterando la lista VIVA del gruppo ne salta uno su
      // due (la lista si accorcia sotto ai piedi del ciclo). Senza la copia, due palline della
      // raffica precedente sopravvivevano e il conteggio usciva 10 invece di 8.
      gsRad.shots.getChildren().slice().forEach((s) => { if (s.active) s.destroy(); });
      window.GameState.player.radiale = direzioni;
      gsRad._radialeAl = 0;
      gsRad.raffichaRadiale(gsRad.time.now, window.GameState.player);
      const v = gsRad.shots.getChildren().filter((s) => s.active)
        .map((s) => Math.atan2(s.body.velocity.y, s.body.velocity.x));
      return v;
    };
    const a4 = raffica(4);
    const a8 = raffica(8);
    // angoli tutti diversi = direzioni davvero distinte (arrotondati al grado)
    const distinti = (v) => new Set(v.map((a) => Math.round(a * 180 / Math.PI))).size;
    const copre = (v) => {   // almeno un colpo per quadrante
      const q = new Set(v.map((a) => Math.floor(((a + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 2))));
      return q.size === 4;
    };
    const cadenza = window.CONFIG.RADIALE_OGNI > 0
      && gsRad._radialeAl > gsRad.time.now;   // dopo una raffica ci vuole una pausa

    if (a4.length === 4 && a8.length === 8 && distinti(a4) === 4 && distinti(a8) === 8
        && copre(a4) && copre(a8) && cadenza) {
      ok('raffica radiale', 2, '4 e 8 direzioni tutte distinte, tutti e quattro i quadranti coperti, '
        + 'pausa ' + window.CONFIG.RADIALE_OGNI + 'ms');
    } else {
      ko('raffica radiale', 2, 'n=' + a4.length + '/' + a8.length + ' distinti=' + distinti(a4)
        + '/' + distinti(a8) + ' copre=' + copre(a4) + '/' + copre(a8) + ' cadenza=' + cadenza);
    }
  }

  // [32] LE DUE ANIMAZIONI NUOVE (2026-08-03): sparo camminando accovacciato, e colpo corpo a
  // corpo col CORPO che mena invece della sola arma. Le cose che si romperebbero in silenzio:
  //   a) accovacciato + in movimento + sparo -> il foglio `hero_crouchaim`, non la posa ferma;
  //   b) accovacciato + FERMO -> deve restare la posa tenuta (se no si perde la distinzione);
  //   c) il colpo a terra -> il foglio `hero_melee`, e l'arma nella MANO di quel fotogramma;
  //   d) il colpo ha la precedenza: muoversi a meta' bastonata non deve rimettere la camminata.
  {
    fermaMeta();
    window.GameState.reset();
    window.GameState.level = 2;
    window.GameState.prossimoLivello = { kind: 'normal', mutator: null, waxMult: 1 };
    g.scene.start('GameScene');
    passaTick();
    const gsN = g.scene.getScene('GameScene');
    avanza(gsN, 24);
    gsN.enemies.getChildren().slice().forEach((e) => { if (e.active) e.destroy(); });

    // (a) e (b): sparo accovacciato, fermo e in movimento
    // ⚠️ Non basta scrivere `gsN.crouching = true`: i comandi lo RICALCOLANO a ogni fotogramma
    // dal tasto premuto, quindi un attimo dopo torna falso e il controllo misura la posa
    // sbagliata (successo davvero: dava "avanti/hero_aim" invece della posa accovacciata).
    // Si tiene premuto il comando vero, come farebbe un giocatore.
    const provaCrouch = (vx) => {
      gsN.facing = 1;
      gsN.touch.aimDown = true;           // = tenere giu' il tasto "abbassati"
      gsN._inMov = vx > 100;
      // La velocita' va rimessa a ogni fotogramma: l'attrito la spegnerebbe.
      for (let k = 0; k < 6; k++) {
        gsN.player.setVelocityX(vx);
        gsN.showRangedWeapon(1, 0);
        gsN._weaponHideAt = gsN.time.now + 1e9;
        avanza(gsN, 1);
      }
      return { posa: gsN._posaMira, tex: gsN.heroVisual.texture.key };
    };
    const fermo = provaCrouch(0);
    const cammina = provaCrouch(220);
    gsN.touch.aimDown = false;
    gsN.player.setVelocityX(0);
    gsN._inMov = false;
    avanza(gsN, 8);

    // (c) e (d): colpo corpo a corpo
    gsN.lastAttack = -1e9;
    gsN.lastGroundAt = gsN.time.now;
    gsN.meleeSwing();
    avanza(gsN, 1);
    const colpoTex = gsN.heroVisual.texture.key;
    // l'arma deve stare nella mano DI QUESTO fotogramma, non a un punto fisso
    const i = gsN.fotogrammaCorrente() % window.GameScene.MANO.mischia.length;
    const t = window.GameScene.MANO.mischia[i];
    const mx = gsN.heroVisual.x + t[0], my = gsN.heroVisual.y + t[1];
    const inMano = Math.hypot(gsN.heroWeapon.x - mx, gsN.heroWeapon.y - my);
    // muoversi non deve interrompere il colpo
    gsN.player.setVelocityX(220);
    gsN._inMov = true;
    avanza(gsN, 2);
    const restaColpo = gsN.heroVisual.texture.key === 'hero_melee';
    // ...ma quando finisce, si torna alle animazioni normali
    for (let k = 0; k < 40 && gsN.heroVisual.texture.key === 'hero_melee'; k++) avanza(gsN, 1);
    const finisce = gsN.heroVisual.texture.key !== 'hero_melee';

    const okCrouch = fermo.posa === 'accovacciato' && fermo.tex === 'hero_aim'
      && cammina.posa === 'crouchaim' && cammina.tex === 'hero_crouchaim';
    if (okCrouch && colpoTex === 'hero_melee' && inMano < 3 && restaColpo && finisce) {
      ok('sparo accovacciato in movimento + colpo col corpo', 2,
        'fermo=' + fermo.posa + ' in cammino=' + cammina.posa + '; colpo su hero_melee con l arma '
        + 'nella mano (scarto ' + inMano.toFixed(1) + 'px), non interrotto dal movimento, e finisce');
    } else {
      ko('sparo accovacciato in movimento + colpo col corpo', 2,
        'fermo=' + fermo.posa + '/' + fermo.tex + ' cammina=' + cammina.posa + '/' + cammina.tex
        + ' colpoTex=' + colpoTex + ' inMano=' + inMano.toFixed(1)
        + ' restaColpo=' + restaColpo + ' finisce=' + finisce);
    }
  }

  // [33] I COLPI IN PIEDI PRENDONO CERUMINO E CROSTA (playtest 2026-08-03). Dal momento in cui i
  // colpi partono dall'UGELLO invece che dal centro del corpo volano molto piu' in alto (51px dal
  // suolo invece di 26), e passavano sopra la testa dei nemici bassi. Cerumino e crosta sono stati
  // alzati apposta perche' si possano colpire stando in piedi; per gli ALTRI restare bassi e'
  // voluto (ci si deve abbassare — scelta dell'utente), e questo controllo verifica anche quello,
  // se no basterebbe alzare tutti i nemici per farlo passare e si perderebbe la distinzione.
  {
    fermaMeta();
    window.GameState.reset();
    window.GameState.level = 3;
    window.GameState.prossimoLivello = { kind: 'normal', mutator: null, waxMult: 1 };
    g.scene.start('GameScene');
    passaTick();
    const gsH = g.scene.getScene('GameScene');
    avanza(gsH, 24);
    gsH.enemies.getChildren().slice().forEach((e) => { if (e.active) e.destroy(); });

    // altezza a cui vola un colpo sparato IN PIEDI con mira orizzontale
    const suolo = gsH.terrainTopAt(gsH.player.x);
    gsH.facing = 1;
    gsH.lastShot = -1e9;
    gsH.shots.getChildren().slice().forEach((s) => { if (s.active) s.destroy(); });
    gsH.fireJet(1, 0);
    const pal = gsH.shots.getChildren().find((s) => s.active);
    const bordoBasso = pal ? (suolo - pal.y) - pal.body.height / 2 : 999;

    // ⚠️ SI ASPETTA CHE LA COMPARSA SIA FINITA prima di misurare. Scritto senza attesa il
    // controllo dava numeri assurdi (cerumino 62px invece di 46, gorgogliante 53 invece di 26):
    // mentre il nemico esce dal terreno il suo disegno viene allungato con un tween, e in questa
    // build ridimensionare il disegno ridimensiona ANCHE IL CORPO FISICO. Finche' non ha finito
    // di uscire, la sua altezza non e' quella vera.
    const cima = {};
    ['blob', 'crust', 'spit', 'hopper'].forEach((k, i) => {
      const e = gsH.spawnEnemy(k, { x: gsH.player.x + 300 + i * 80 });
      if (!e) return;
      for (let n = 0; n < 300 && e.active && e.spawning; n++) avanza(gsH, 1);
      if (e.active) cima[k] = (gsH.terrainTopAt(e.x) - e.body.top);
    });
    // ⚠️ E ADESSO ANCHE IL COLPO ACCOVACCIATO. Il controllo diceva "ci si deve abbassare" ma
    // provava SOLO il colpo in piedi: dava per buono che abbassarsi servisse, senza verificarlo
    // mai. Non serviva: il colpo accovacciato parte a 37 dal suolo e il gorgogliante era alto 26,
    // quindi il getto gli passava sopra in TUTTE E DUE le pose (segnalato dai tester 2026-08-18,
    // e il gorgogliante e' stato alzato a 40). Una frase in un controllo e' un'affermazione: o si
    // misura, o non si scrive.
    gsH.crouching = true;
    gsH.shots.clear(true, true);
    gsH.lastShot = -1e9;
    gsH.fireJet(1, 0);
    const palGiu = gsH.shots.getChildren()[0];
    const bassoGiu = palGiu ? (suolo - palGiu.y) - palGiu.body.height / 2 : 999;
    gsH.crouching = false;

    const prende = (k) => cima[k] >= bordoBasso;
    const prendeGiu = (k) => cima[k] >= bassoGiu;
    const bassi = !prende('spit') && !prende('hopper');   // in piedi non si prendono: e' il loro senso
    // ⚠️ IL SALTATORE NON SI PRENDE NEMMENO ABBASSANDOSI, ED E' VOLUTO: e' alto 30 e la fascia
    // bassa del colpo accovacciato parte da 37. Deciso con l'utente il 2026-08-18 dopo averglielo
    // fatto notare: un nemico che saltella si prende al volo o col coton fioc. NON "correggerlo"
    // alzandolo — sembrerebbe una svista e invece e' una scelta.
    const giuOk = prendeGiu('spit');                      // ...ma abbassandosi il gorgogliante SI'

    if (prende('blob') && prende('crust') && bassi && giuOk) {
      ok('i colpi prendono i nemici alti in piedi e il gorgogliante da accovacciati', 3,
        'in piedi il colpo passa a ' + Math.round(bordoBasso) + 'px dal suolo, accovacciati a '
        + Math.round(bassoGiu) + '; cerumino ' + Math.round(cima.blob) + ' e crosta '
        + Math.round(cima.crust) + ' si prendono in piedi; gorgogliante ' + Math.round(cima.spit)
        + ' solo abbassandosi; saltatore ' + Math.round(cima.hopper)
        + ' con nessuna delle due: VOLUTO, si prende al volo mentre salta o col coton fioc');
    } else {
      ko('i colpi prendono i nemici alti in piedi e il gorgogliante da accovacciati', 3,
        'bordo basso in piedi=' + Math.round(bordoBasso) + ' accovacciati=' + Math.round(bassoGiu)
        + ' cime=' + JSON.stringify(cima));
    }
  }

  // [35] TUTTE LE IMMAGINI SONO DAVVERO CARICATE (2026-08-09). E' il controllo che sarebbe
  // servito: Phaser scarica al massimo `maxParallelDownloads` file (di fabbrica 32) e quelli
  // oltre restano in coda PER SEMPRE, senza errore e senza fallimento. Il gioco ne aveva 34 e
  // girava senza le due animazioni aggiunte per ultime — il colpo corpo a corpo e lo sparo
  // accovacciato — e da fuori sembrava solo che "l'animazione non si vedesse".
  // ⚠️ Si guarda il RISULTATO (la texture esiste?), non il percorso (la riga di load c'e'?):
  // il difetto stava tutto nello spazio fra le due domande.
  {
    const boot = g.scene.getScene('BootScene');
    const attese = window.BootScene.TEXTURE_ATTESE;
    const mancanti = attese.filter((k) => !g.textures.exists(k));
    const inCoda = boot ? boot.load.list.size : 0;
    // e le animazioni che ne nascono devono avere davvero i loro fotogrammi
    const animeVuote = [['hero_melee_a', 4], ['hero_crouchaim_a', 8], ['hero_runaim_a', 6]]
      .filter(([k, n]) => !g.anims.exists(k) || g.anims.get(k).frames.length !== n)
      .map(([k]) => k);
    if (!mancanti.length && !inCoda && !animeVuote.length) {
      ok('tutte le immagini sono caricate', '-', attese.length + ' texture attese presenti, '
        + (boot ? boot.load.totalComplete : '?') + '/' + (boot ? boot.load.totalToLoad : '?')
        + ' file caricati, animazioni con tutti i fotogrammi');
    } else {
      ko('tutte le immagini sono caricate', '-', 'mancanti=[' + mancanti.join(',') + ']'
        + ' rimasti in coda=' + inCoda + ' animazioni vuote=[' + animeVuote.join(',') + ']');
    }
  }

  // [36] L'ARMA E' AGGANCIATA ALLA MANO NEI DUE VERSI (2026-08-09). Il ribaltamento di Phaser
  // non gira attorno al PERNO dell'immagine ma attorno alla sua META': col perno sull'impugnatura
  // (in basso) l'arma rivolta a sinistra scivolava 6,8 pixel piu' in basso, su 12 di altezza
  // disegnata. Erano i due difetti segnalati insieme al playtest ("verso sinistra la pistola e'
  // troppo in basso", "ogni tanto compare rivolta male").
  // ⚠️ SI MISURA getBounds(), NON I CONTI DEL GIOCO. Il calcolo della posizione era gia'
  // specchiato in modo esatto: lo scarto nasceva dopo, nel disegno. Un controllo che rifa' i
  // conti a mano non lo vedrebbe.
  {
    const gs = avviaLivello(2);
    const scarti = [];
    for (const d of [[1, 0], [0, -1], [1, -1], [1, 1]]) {
      const m = (verso) => {
        gs.facing = verso;
        gs._posaMira = 'corsa';
        gs.heroVisual.anims.play('hero_runaim_a', true);
        gs.heroVisual.setPosition(gs.player.x, gs.player.body.bottom);
        const n = Math.hypot(d[0], d[1]) || 1;
        gs.showRangedWeapon(verso * d[0] / n, d[1] / n);
        gs.positionWeapon();
        const b = gs.heroWeapon.getBounds();
        return { cx: (b.left + b.right) / 2 - gs.heroVisual.x, cy: (b.top + b.bottom) / 2 - gs.heroVisual.y };
      };
      const D = m(1), S = m(-1);
      scarti.push(Math.abs(S.cy - D.cy), Math.abs(S.cx + D.cx));
    }
    const peggio = Math.max(...scarti);
    if (peggio < 1) ok('l arma e agganciata alla mano nei due versi', 2,
      'quattro direzioni di mira, scarto massimo fra destra e sinistra ' + peggio.toFixed(2) + 'px');
    else ko('l arma e agganciata alla mano nei due versi', 2,
      'scarto massimo ' + peggio.toFixed(2) + 'px fra il disegno a destra e quello a sinistra');
  }

  // [37] I COMANDI A SCHERMO NON POSSONO FINIRE A COORDINATE NON VALIDE (2026-08-13).
  // Da quando i comandi si spostano per non finire sotto le barre di sistema, la loro posizione
  // dipende da `scale.displayScale`, che vale gameSize/displaySize. Quando il canvas ha ancora
  // dimensione ZERO — all'avvio e a ogni ROTAZIONE del telefono — quel rapporto e' infinito, e
  // zero per infinito fa NaN: i comandi finivano a coordinate inesistenti e SPARIVANO TUTTI.
  // Su un telefono e' un gioco senza leva e senza pulsanti, in una finestra di pochi millesimi:
  // il tipo di difetto che un tester non riesce a riprodurre e che quindi non verrebbe mai
  // sistemato. Qui si esercita direttamente il calcolo, nei casi limite che lo rompevano.
  {
    const M = window.TouchControls.margineSicurezza;
    const casi = [
      ['canvas a zero (rotazione)', { scale: { displayScale: { x: Infinity, y: Infinity } } }],
      ['scala non ancora pronta', { scale: {} }],
      ['scena senza scala', {}],
      ['scala normale', { scale: { displayScale: { x: 0.75, y: 0.75 } } }],
      ['scala negativa', { scale: { displayScale: { x: -2, y: -2 } } }],
    ];
    const rotti = [];
    for (const [nome, finta] of casi) {
      const r = M(finta);
      const valori = [r.sx, r.dx, r.giu];
      if (!valori.every((v) => Number.isFinite(v) && v >= 0 && v <= 90)) {
        rotti.push(nome + ' -> ' + JSON.stringify(r));
      }
    }
    if (!rotti.length) {
      ok('i comandi a schermo non finiscono a coordinate non valide', '-',
        casi.length + ' casi limite (canvas a zero, scala assente, scala negativa): '
        + 'margini sempre numeri validi fra 0 e 90');
    } else {
      ko('i comandi a schermo non finiscono a coordinate non valide', '-', rotti.join(' | '));
    }
  }

  // [41] PULIRE NON PAGA, MA FA AVANZARE IL LIVELLO (2026-08-18, scelta dell'utente).
  // La moneta si guadagna solo raccogliendo i pallini. ⚠️ Il controllo verifica DUE cose che
  // sembrano una sola e non lo sono: che rompere il cerume non dia moneta, e che continui a far
  // avanzare la percentuale di pulito. Se sparissero tutte e due, il gioco diventerebbe
  // INFINIBILE (serve l'80% per passare di livello) e i controlli sull'economia passerebbero
  // lo stesso: e' proprio la coppia che va tenuta d'occhio.
  {
    const gsE = avviaLivello(3);
    const b = gsE.blocks.getChildren().find((x) => x.active && !x.ceiling);
    const monetaPrima = window.GameState.wax;
    const pulitoPrima = gsE.cleanedWax || 0;
    if (b) gsE.damageBlock(b, 999999);
    const guadagno = window.GameState.wax - monetaPrima;
    const avanzato = (gsE.cleanedWax || 0) > pulitoPrima;
    // e un pallino DEVE invece pagare
    const primaPallino = window.GameState.wax;
    gsE.dropWaxPellet(gsE.player.x, gsE.player.y - 40, 10);
    const pallino = gsE.pickups.getChildren().slice(-1)[0];
    if (pallino) gsE.raccogliPickup ? gsE.raccogliPickup(pallino) : gsE.physics.overlap(gsE.player, pallino);
    const pallinoOk = !!pallino;
    if (b && guadagno === 0 && avanzato && pallinoOk) {
      ok('pulire non paga ma fa avanzare il livello', 3,
        'blocco distrutto: moneta +' + guadagno + ', pulito avanzato; un nemico vale '
        + Math.round((window.CONFIG.NEMICI_CERUME || 1) * 100) / 100 + 'x il suo valore base');
    } else {
      ko('pulire non paga ma fa avanzare il livello', 3, 'blocco=' + !!b + ' guadagno=' + guadagno
        + ' pulito avanzato=' + avanzato + ' pallino creato=' + pallinoOk);
    }
  }

  // [40] NESSUN NEMICO NASCE DENTRO IL CERUME, NEMMENO CON LA POSIZIONE IMPOSTA (2026-08-18).
  // Il controllo sul cerume esisteva gia', ma viveva dentro pickGroundX — e meta' dei nemici non
  // ci passa: sciami, guardiani delle membrane, nemici che si sdoppiano e il fuggitivo nascono a
  // una posizione IMPOSTA. Restavano incastrati a spingere contro un cumulo senza avanzare.
  // ⚠️ Qui si CHIEDE APPOSTA di nascere dentro un cumulo, che e' il caso che il vecchio controllo
  // non poteva vedere: farlo nascere "a caso" e sperare che capiti sul cerume proverebbe poco.
  {
    const gsC = avviaLivello(3);
    const muro = gsC.blocks.getChildren().find((b) => b.active && !b.ceiling);
    if (!muro) {
      ok('nessun nemico nasce dentro il cerume', 3, 'nessun cumulo nel livello: prova non eseguita');
    } else {
      const dentro = Math.round(muro.x);
      const nato = gsC.spawnEnemy('blob', { x: dentro });
      const finito = nato ? Math.round(nato.x) : null;
      const ancoraDentro = nato ? gsC.puntoOccupatoDalCerume(nato.x) : true;
      // e il punto chiesto doveva davvero essere occupato, se no la prova non prova niente
      const partenzaOccupata = gsC.puntoOccupatoDalCerume(dentro);
      if (partenzaOccupata && nato && !ancoraDentro) {
        ok('nessun nemico nasce dentro il cerume', 3,
          'chiesto x=' + dentro + ' (dentro un cumulo), spostato a x=' + finito
          + ' (' + Math.abs(finito - dentro) + 'px piu' + '\' in la\'), fuori dal cerume');
      } else {
        ko('nessun nemico nasce dentro il cerume', 3, 'partenza occupata=' + partenzaOccupata
          + ' nato=' + !!nato + ' ancora dentro=' + ancoraDentro + ' x=' + finito);
      }
    }
  }

  // [39] LA CURA SI VEDE GIA' ALLA PRIMA RUN DELL'APP (2026-08-17). Difetto segnalato: appena
  // aperta l'app la croce della cura non si vedeva, ma bastava iniziare un'altra run — senza
  // riavviare — perche' comparisse. La texture veniva creata al SETTIMO passo di create(),
  // mentre le cure nascono nel SECONDO (il livello si costruisce prima). Dalla seconda run in
  // poi la texture c'era gia', perche' sopravvive al cambio di scena: per questo il difetto
  // spariva da solo ed era facile crederlo risolto.
  // ⚠️ QUI SI RICREA LA CONDIZIONE DELLA PRIMA VOLTA cancellando la texture: senza quel passo
  // il controllo passerebbe sempre, perche' i controlli precedenti l'hanno gia' creata. E' la
  // differenza fra provare il caso e provare lo stato in cui ci si trova per caso.
  {
    const gs9 = avviaLivello(2);
    // ⚠️ PRIMA SI TOLGONO GLI OGGETTI CHE LA USANO. Cancellare una texture mentre un pickup in
    // campo la sta ancora disegnando manda in errore il renderer al primo fotogramma
    // ("Cannot read properties of null (reading 'glTexture')"). Era il "+1 errore in console"
    // che compariva a intermittenza: dipendeva dal fatto che il livello generato a caso avesse
    // o no una cura gia' in campo. Il gioco non c'entrava niente — era questo controllo.
    gs9.pickups.getChildren().slice().forEach((p) => {
      if (p.active && p.texture && p.texture.key === 'cura') p.destroy();
    });
    g.textures.remove('cura');
    const senza = g.textures.exists('cura');
    const cura = gs9.addWaxPickup(gs9.player.x, gs9.player.y - 60, true) ||
      gs9.pickups.getChildren().slice(-1)[0];
    const cerume = (gs9.addWaxPickup(gs9.player.x + 40, gs9.player.y - 60, false),
      gs9.pickups.getChildren().slice(-1)[0]);
    const okCura = !!cura && cura.texture.key === 'cura';
    const okCerume = !!cerume && cerume.texture.key === 'wax_glob';
    if (!senza && okCura && okCerume) {
      ok('la cura si vede gia\' alla prima run', 2,
        'texture cancellata come al primo avvio: la cura nasce lo stesso con la sua croce '
        + '(texture "' + cura.texture.key + '"), il cerume resta "' + cerume.texture.key + '"');
    } else {
      ko('la cura si vede gia\' alla prima run', 2, 'texture presente prima della prova=' + senza
        + ' cura=' + (cura && cura.texture.key) + ' cerume=' + (cerume && cerume.texture.key));
    }
  }

  // [38] I CARTELLI DEL BOSS SI ACCORDANO AL GENERE (2026-08-16). In italiano il participio si
  // accorda, e i cartelli erano al maschile fisso: con la Regina usciva "REGINA DELLE CROSTE:
  // DISTRUTTO" (segnalato dai tester). Ora ogni boss dichiara il proprio genere accanto al nome.
  // ⚠️ Questo controllo esiste per il boss CHE NON C'E' ANCORA: chi ne aggiunge uno nuovo deve
  // ricordarsi del genere, e senza una rete la dimenticanza si vedrebbe solo giocando fino a
  // quel boss, in italiano, e leggendo il cartello.
  {
    const I = window.I18n;
    const linguaPrima = 'it';
    const guasti = [];
    for (const lang of ['it', 'en']) {
      I.setLang(lang);
      for (const k of ['tappo', 'regina', 'gran']) {
        const g = I.t('boss_genere_' + k);
        if (g !== 'm' && g !== 'f') { guasti.push(lang + '/' + k + ': genere = "' + g + '"'); continue; }
        for (const frase of ['game_boss_dead_', 'game_boss_enrage_']) {
          for (const gen of ['m', 'f']) {
            const t = I.t(frase + gen, { nome: 'X' });
            // se la chiave manca, t() restituisce la chiave stessa: e' cosi' che si riconosce
            if (!t || t.indexOf(frase) === 0) guasti.push(lang + ': manca ' + frase + gen);
          }
        }
      }
    }
    // e il caso concreto che ha fatto nascere il controllo
    I.setLang('it');
    const gsB = g.scene.getScene('GameScene');
    const regina = gsB.cartelloBoss('game_boss_dead', { bossKind: 'regina' });
    const tappo = gsB.cartelloBoss('game_boss_dead', { bossKind: 'tappo' });
    if (!/DISTRUTTA/.test(regina)) guasti.push('la Regina non e\' al femminile: ' + regina);
    if (!/DISTRUTTO/.test(tappo)) guasti.push('il Tappo non e\' al maschile: ' + tappo);
    I.setLang(linguaPrima);
    if (!guasti.length) {
      ok('i cartelli del boss si accordano al genere', '-',
        'tre boss x due lingue: "' + regina + '" e "' + tappo + '"');
    } else {
      ko('i cartelli del boss si accordano al genere', '-', guasti.slice(0, 4).join(' | '));
    }
  }

  // [34] L'INTERRUTTORE DEL PANNELLO DI PROVA (2026-08-04, verso la pubblicazione). Spegnendo
  // `CONFIG.PANNELLO_PROVA` il pannello deve sparire E tutte le manopole devono tornare al valore
  // normale, god-mode compreso — anche se nel telefono e' rimasto salvato qualcosa da una prova
  // precedente. E' l'unica riga che separa la versione di prova da quella pubblicabile: se si
  // rompesse in silenzio, si pubblicherebbe un gioco con vita infinita e cerume gratis.
  {
    const T = window.Taratura;
    const primaFlag = window.CONFIG.PANNELLO_PROVA;
    // si sporcano apposta le manopole, come farebbe chi ha giocato col pannello
    const memoria = {};
    ['densita', 'vitaPg', 'dannoPg', 'cerume'].forEach((k) => { memoria[k] = T.v(k); T.set(k, 2.5); });
    const gmPrima = T.godmode();
    T.setGodmode(true);
    const sporcoRiconosciuto = T.modificata() && T.godmode() && T.v('densita') !== 1;

    window.CONFIG.PANNELLO_PROVA = false;
    const neutre = ['densita', 'velNemici', 'dannoNemici', 'vitaNemici', 'vitaPg', 'dannoPg',
                    'durataCorsa', 'cerume', 'rimbalzo'].every((k) => T.v(k) === 1);
    const cerumino = T.v('fpsCerumino') === 8;   // questa NON e' un moltiplicatore: torna al suo valore
    const gmSpento = T.godmode() === false;
    const nonSegnalaNiente = T.modificata() === false;
    const spento = T.acceso() === false;

    // si rimette tutto com'era: gli altri controlli non devono ereditare manopole girate
    window.CONFIG.PANNELLO_PROVA = primaFlag;
    Object.keys(memoria).forEach((k) => T.set(k, memoria[k]));
    T.setGodmode(gmPrima);

    if (sporcoRiconosciuto && neutre && cerumino && gmSpento && nonSegnalaNiente && spento) {
      ok('spegnendo il pannello di prova il gioco torna normale', '-',
        'manopole girate a 2,5 e god-mode acceso; a interruttore spento tornano tutte a 1 '
        + '(fpsCerumino a 8) e il god-mode e spento');
    } else {
      ko('spegnendo il pannello di prova il gioco torna normale', '-',
        'sporcoRiconosciuto=' + sporcoRiconosciuto + ' neutre=' + neutre + ' cerumino=' + cerumino
        + ' gmSpento=' + gmSpento + ' nonSegnalaNiente=' + nonSegnalaNiente + ' spento=' + spento);
    }
  }

  // [35] NESSUN ERRORE JAVASCRIPT durante tutta la corsa
  if (erroriJs.length === 0) ok('nessun errore javascript', '-');
  else ko('nessun errore javascript', '-', erroriJs.slice(0, 3).join(' | '));

  const falliti = esiti.filter((e) => e.esito === 'FALLITO');
  return { totale: esiti.length, falliti: falliti.length, esiti };
};
