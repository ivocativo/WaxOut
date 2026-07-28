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
      if (salita > portata + 15) pedaneKo++;              // 15px di tolleranza
    });
    if (pedaneKo === 0 && sepolte === 0) {
      ok('pedane raggiungibili', lv, pedane.length + ' pedane, salita max ' + Math.round(peggiorSalto) + '/' + Math.round(portata) + 'px');
    } else {
      const parti = [];
      if (pedaneKo) parti.push(pedaneKo + ' oltre la portata del salto (max ' + Math.round(peggiorSalto) + ' contro ' + Math.round(portata) + ')');
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
    const cardStub = { id: 'damage', rep: true, apply: (s) => { s.damage += 8; } };
    fermaMeta();
    window.GameState.reset();
    window.GameState.level = window.CONFIG.RUN_LEVELS;
    window.GameState.wax = 321;
    const winsPrima = window.Meta.get().wins;
    const bankPrima = window.Meta.get().bank;
    g.scene.start('UpgradeScene');
    passaTick();
    g.scene.getScene('UpgradeScene').choose(cardStub);
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
      avanza(gs, 40);   // lascia finire la comparsa del boss
      return { gs, boss: gs.enemies.getChildren().find((e) => e.active && e.kind === 'boss') };
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
    const hpAttesaFinale = Math.round((420 + window.CONFIG.RUN_LEVELS * 40) * 1.7);
    const finaleFlag = !!(F.boss && F.boss.finale);
    const hpFinaleOk = !!(F.boss && F.boss.maxHp === hpAttesaFinale);
    forzaFase3(F.gs, F.boss);
    const crolloOk = !!(F.boss && F.boss._collapse === true && F.gs.quakeTimer);

    const M = bossDelLivello(5);
    const hpNormaleOk = !!(M.boss && M.boss.maxHp === (420 + 5 * 40) && !M.boss.finale);
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
    avanza(gs, 40);                                    // fa emergere il nemico (god-mode)
    if (gs.spawnTimer) gs.spawnTimer.remove();          // (di nuovo: avanza potrebbe averlo ricreato? no, ma sicuri)
    gs.platforms.getChildren().forEach((p) => { if (p.active && Math.abs(p.x - e.x) < 100) p.destroy(); });
    gs.blocks.getChildren().forEach((b) => { if (b.active && Math.abs(b.x - e.x) < 90 && b.y < e.body.top + 10) b.destroy(); });
    const hpNemicoPrima = e.hp;
    window.GameState.player.hp = 100; gs.invulnUntil = 0;   // via il god-mode: il danno deve contare
    gs.player.body.reset(e.x, e.body.top - 50);        // 50px sopra la testa del nemico
    gs.player.setVelocityY(250);                       // in caduta
    // Controlla il danno SOLO nella finestra del rimbalzo (fino a poco dopo lo stacco): un
    // eventuale colpo DOPO, quando il nemico torna e l'invuln e' scaduta, e' un colpo legittimo,
    // non un fallimento dello stomp.
    let rimbalzoMin = 0, hpDopoRimbalzo = 100, staccoAlRimbalzo = null;
    for (let i = 0; i < 20; i++) {
      t += 16.6; g.loop.step(t);                       // frame RAW (niente god-mode: il danno conta)
      // Quanto distavano i piedi dalla testa nel frame in cui e' partito il rimbalzo. Nasce da un
      // difetto vero (playtest 2026-07-27): la rilevazione anticipava di 48px e il PG rimbalzava
      // per aria, senza che si vedesse l'impatto. Il PG a fine frame e' gia' risalito di ~vy/60px,
      // quindi il valore atteso e' una decina di px in negativo, non una cinquantina.
      if (staccoAlRimbalzo === null && gs.player.body.velocity.y < -50 && e.body) {
        staccoAlRimbalzo = gs.player.body.bottom - e.body.top;
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

  // [19] ARSENALE (2026-07-27): il KIT scelto deve arrivare davvero in partita — statistiche
  // di partenza, forma del colpo corpo a corpo e gittata del getto. Nasce dal fatto che i kit
  // toccano tre punti lontani tra loro (newPlayer, meleeSwing, spawnPellet): se uno dei tre non
  // legge il kit, l'arma "comprata" sembra identica a quella base e non se ne accorge nessuno.
  {
    const armaSalvata = window.Meta.get().arma;
    const esiti = [];
    ['fioc', 'martello', 'idro', 'pompa'].forEach((id) => {
      const kit = window.ARMI.find((a) => a.id === id);
      window.Meta.setUnlock('arma_' + id, 1);
      window.Meta.setArma(id);
      fermaMeta();
      window.GameState.reset();
      window.GameState.level = 2;
      window.GameState.prossimoLivello = { kind: 'normal', mutator: null, waxMult: 1 };
      g.scene.start('GameScene');
      passaTick();
      const gs = g.scene.getScene('GameScene');
      avanza(gs, 12);
      const p = window.GameState.player;
      // il colpo corpo a corpo usa davvero la portata del kit?
      const M = window.armaCorrente().mischia;
      esiti.push({
        id: id,
        arma: p.arma === id,
        cadenza: p.attackCooldown === kit.mischia.cadenza,
        gittata: p.shotLife === kit.getto.gittata,
        palline: p.jetPellets === (kit.getto.palline || 1),
        portata: M.portata === kit.mischia.portata,
        extra: (!kit.getto.calamita || p.magnet === true) && (!kit.getto.perfora || p.jetPierce === true),
      });
    });
    window.Meta.setArma(armaSalvata || 'fioc');
    const rotti = esiti.filter((e) => !(e.arma && e.cadenza && e.gittata && e.palline && e.portata && e.extra));
    if (rotti.length === 0) ok('arsenale: il kit scelto arriva in partita', '-', esiti.map((e) => e.id).join(' '));
    else ko('arsenale: il kit scelto arriva in partita', '-', JSON.stringify(rotti));
  }

  // [20] NESSUN ERRORE JAVASCRIPT durante tutta la corsa
  if (erroriJs.length === 0) ok('nessun errore javascript', '-');
  else ko('nessun errore javascript', '-', erroriJs.slice(0, 3).join(' | '));

  const falliti = esiti.filter((e) => e.esito === 'FALLITO');
  return { totale: esiti.length, falliti: falliti.length, esiti };
};
