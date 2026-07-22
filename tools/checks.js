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
      avanza(gs, 180);
      const bloccati = incastrabili.filter((r) => r.e.active && Math.abs(r.e.x - r.x0) < 4);
      if (bloccati.length === 0) ok('nessun nemico incastrato nel cerume', lv, incastrabili.length + ' sovrapposti ma si sono liberati');
      else ko('nessun nemico incastrato nel cerume', lv, bloccati.length + ' nemici fermi dentro il cerume dopo 3 secondi');
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
    let maxConsecutivi = 0, pgAffondato = 0, volanteFermo = 0;
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
        if (!e.active || e.spawning) return;
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

  // [12] NESSUN ERRORE JAVASCRIPT durante tutta la corsa
  if (erroriJs.length === 0) ok('nessun errore javascript', '-');
  else ko('nessun errore javascript', '-', erroriJs.slice(0, 3).join(' | '));

  const falliti = esiti.filter((e) => e.esito === 'FALLITO');
  return { totale: esiti.length, falliti: falliti.length, esiti };
};
