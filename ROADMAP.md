# Earwax War — Piano esecutivo (blocco "Correzioni playtest — round 1")

> 📄 **A cosa serve questo file:** è la "lista di lavoro" del blocco in corso (con le caselle da
> spuntare), usa e getta. Per lo **stato generale** del progetto, come collaudare e le regole vedi
> **`HANDOFF.md`**; per la descrizione del gioco vedi **`README.md`**.

_Aggiornato 2026-07-13, dopo un playtest dell'utente su telefono con 21 segnalazioni (bug +_
_migliorie). Qui sotto sono **annotate e raggruppate** (non ancora corrette) — si affrontano_
_una alla volta o a gruppetti, nell'ordine proposto sotto salvo diverso avviso dell'utente._
_Regole: god-mode nei test SEMPRE, i18n EN+IT per stringhe nuove, commit solo su richiesta._

> ✅ **Blocco precedente ("Personaggio AI animato") sostanzialmente chiuso**: camminata/corsa/idle/
> salto integrati e giocati (commit `9c9cf84`, `afd6b5c`), arma-in-mano prototipata (`b2e167c`).
> Restano solo, per dopo: pose dedicate per l'attacco coordinato corpo+arma, embed per `file://`,
> stesso trattamento per i nemici. Vedi `HANDOFF.md` §DA FARE. Notare: il bug "coton fioc doppio"
> qui sotto (§A.1) è proprio un effetto collaterale del prototipo arma-in-mano — primo indiziato.

---

## Come leggere questa lista
Ogni punto ha: **cosa ha segnalato l'utente** → **causa probabile** (se trovata con una verifica
veloce nel codice, file:riga) → **nota su come si collega ad altri punti**. Quando una causa non è
ancora chiara è segnato "da investigare" invece che indovinato a caso.

---

## GRUPPO A — Bug rapidi, causa già individuata ✅ TUTTI FATTI E VERIFICATI (2026-07-13)
_Tutti e 7 corretti nella stessa sessione, verificati con test mirati in preview (dati + screenshot,_
_zero errori console). **NON ancora committato** — in attesa di conferma dell'utente._

- [x] **A.1 — Coton fioc compare due volte nel corpo a corpo.**
  Causa trovata: **due sistemi disegnano l'arma in contemporanea**. Quello vecchio
  (`GameGfx.showWeaponSwing`, `src/gfx.js:243`) crea uno sprite `swab`/`hammer` con un tween
  d'angolo e si autodistrugge; quello nuovo (`this.showMeleeWeapon`, `GameScene.js`, dal prototipo
  "arma in mano" di ieri) fa la STESSA cosa col layer `this.heroWeapon`. `meleeSwing()` li chiama
  entrambi. **FATTO:** rimossa la chiamata + il metodo wrapper in GameScene.js + la funzione morta
  in gfx.js (nessun altro chiamante). Verificato: nella scena resta 1 solo sprite swab/hammer
  durante l'attacco (prima 2).

- [x] **A.2 — I moscerini attraversano il cerume.**
  Causa trovata: `GameScene.js:187`, `this.physics.add.collider(this.enemies, this.blocks, null,
  notFlyer)` — il filtro `notFlyer` esclude ESPRESSAMENTE i volanti dalla collisione col cerume.
  **Nota di collegamento importante (leggere prima di toccare):** questo è in TENSIONE con l'idea
  di trasformare il Fuggitivo Dorato in un nemico volante (vedi B.1) — se i volanti *devono* poter
  attraversare il cerume (comportamento voluto, "volano sopra tutto"), allora il fix qui è solo
  documentare/confermare che è INTENZIONALE e non un bug; se invece i volanti *devono* collidere
  col cerume come tutti, il fix è togliere `notFlyer` dalla riga 187 — ma allora la soluzione B.1
  (fuggitivo=volante) NON risolverebbe il suo blocco contro il cerume. **Decidere A.2 e B.1
  INSIEME, nello stesso turno**, prima di implementare uno dei due.
  **FATTO (deciso insieme a B.1):** il collider `enemies<->blocks` ora usa un filtro `notFugitive`
  (non più `notFlyer`) — TUTTI i nemici collidono col cerume, **eccetto** il Fuggitivo Dorato
  (bypass mirato, non "diventa volante": vedi B.1). Verificato con `physics.world.collide()`
  isolato: moscerino normale si ferma sul blocco (prima lo attraversava), fuggitivo lo attraversa.

- [x] **A.3 — Seconda Vita si ricarica troppo spesso (dovrebbe essere una volta per PARTITA).**
  Causa trovata: `GameScene.js:2550`, `if (p.secondLife && !this.secondLifeReady && p.hp >=
  p.maxHp) this.secondLifeReady = true;` — si riarma ogni volta che torni a vita piena (curandoti
  con pickup/potenziamenti), quindi può salvarti più volte nella stessa run. **Fix probabile:**
  un flag `secondLifeUsed` che diventa `true` al primo uso e non si azzera mai fino al prossimo
  `GameState.reset()` (inizio nuova run); togliere la ricarica automatica a vita piena.
  **FATTO (causa piu' profonda del previsto):** `this.secondLifeReady` era stato/scena, azzerato a
  `true` ad OGNI `create()` (quindi a ogni LIVELLO, non solo a inizio partita) — bug ancora piu'
  generoso della sola ricarica-a-vita-piena. Spostato lo stato su `window.GameState.player.
  secondLifeUsed` (vera vita di RUN). Verificato: 1° colpo mortale salva (hp 35, used=true), 2°
  colpo mortale nella STESSA run uccide anche dopo essere tornato a vita piena; nuova run
  (`GameState.reset()`) lo azzera correttamente.

- [x] **A.4 — Potenziamenti non cumulabili (es. Doppio Salto) escono più volte anche se già presi.**
  Causa trovata, MOLTO probabile: lo sblocco PERMANENTE da negozio "Doppio Salto Innato"
  (`UNLOCKS.djump` in `state.js`) imposta `doubleJump: lv('djump') > 0` già in `newPlayer()` — ma
  questo non viene mai registrato in `GameState.ownedAbilities` (che il filtro di `UpgradeScene.js:
  98-103` usa per NON riproporre una carta una-tantum già presa). Chi ha comprato lo sblocco al
  negozio si ritrova quindi la carta "Doppio Salto" offerta a vuoto ogni run (pesca sprecata, non fa
  nulla). **Fix probabile:** all'inizio della run (o nel filtro `avail`), pre-popolare
  `ownedAbilities` con le abilità equivalenti già garantite dai permanenti (o controllare
  direttamente il flag `p.doubleJump`/analoghi nel filtro, non solo `ownedAbilities`). **Verificare
  se lo stesso pattern riguarda altre abilità collegate a UNLOCKS/BLUEPRINTS permanenti**, non solo
  doubleJump — da controllare quando si corregge.
  **FATTO + verificato che NON riguarda altro:** controllate tutte le UNLOCKS (hp/dmg/speed sono
  bonus statistici sempre cumulabili per design, nessun problema) e tutte le BLUEPRINTS (sbloccano
  solo l'IDONEITA' della carta, non l'abilita' stessa — nessun problema). `djump` era l'UNICO caso.
  Fix in `GameState.reset()`: se `player.doubleJump` e' gia' vero (sblocco permanente), lo segna
  subito in `ownedAbilities`. Verificato: con lo sblocco attivo, `ownedAbilities` contiene
  'doublejump' da inizio run e il filtro dell'UpgradeScene lo esclude correttamente.

- [x] **A.5 — I nemici Esplosivi (élite "boom") non danneggiano altri nemici/il cerume, solo il
  giocatore.** Causa trovata: `enemyExplode()` (`GameScene.js:1238-1250`) controlla SOLO la
  distanza dal giocatore (`Math.hypot(this.player.x - x, ...)`) per applicare danno; non itera su
  `this.enemies`/`this.blocks` nel raggio. **Fix probabile:** aggiungere, nello stesso raggio `R`,
  danno ad area anche a nemici vicini (`damageEnemy`, non-elite-a-cascata per evitare esplosioni a
  catena infinite — da decidere se è un effetto voluto o da smorzare) e al cerume (`damageBlock`).
  **FATTO:** aggiunto danno ad area (stesso raggio/danno del giocatore) a nemici e cerume vicini.
  **Decisione presa:** reazione a catena tra Esplosivi vicini CONSENTITA (tema "esplosivo", effetto
  soddisfacente, nessun rischio di loop essendo il numero di nemici finito). Verificato con uno
  spy diretto: blocco e nemico piazzati nel raggio hanno preso entrambi lo stesso danno (-15 a
  livello 3), prima restavano illesi.

- [x] **A.6 — Scatto (dash) contro le torri di cerume: spariscono ISTANTANEAMENTE, si perde
  l'animazione di caduta/cedimento.** Causa trovata: `updateDashStrike()` (`GameScene.js:1584-1586`)
  chiama `damageBlock(b, p.damage)` su OGNI blocco in overlap a OGNI FRAME per tutta la durata dello
  scatto — a differenza dei nemici, che hanno un cooldown per-bersaglio (`e._dashHitAt`, riga 1581),
  i blocchi non ce l'hanno: in pochi frame consecutivi (scatto dura più frame) lo stesso blocco (o
  più blocchi in fila) prende danno decine di volte, sparendo di colpo invece di cedere un pezzo
  alla volta con l'animazione già esistente (collasso a celle). **Fix probabile:** aggiungere un
  cooldown per-blocco analogo a `_dashHitAt` (es. `b._dashHitAt`). **Collegato al punto D.1 sotto**
  (lo scatto con danno deve anche SEMBRARE diverso da quello normale) — stessa area di codice,
  ha senso farli nello stesso turno.
  **FATTO (solo la parte A.6, D.1 resta per il Gruppo D):** aggiunto `b._dashHitAt` identico al
  pattern nemici. Verificato con uno spy su `damageBlock`: 10 frame simulati di overlap durante lo
  scatto → 1 sola chiamata (prima ne avrebbe fatte fino a 10, sparendo il blocco di colpo).

- [x] **A.7 — Nemici a proiettili (gorgogliante/boss) non funzionano nei livelli a poca gravità.**
  Causa trovata: `spitAt()` (`GameScene.js:1339`) usa `const g = window.CONFIG.GRAVITY;` — una
  COSTANTE fissa — per calcolare la parabola balistica, invece della gravità REALE del mondo
  fisico (`this.physics.world.gravity.y`), che il mutatore "poca gravità" (`lowgrav`) modifica a
  runtime. Con gravità reale diversa da quella usata nel calcolo, la traiettoria non torna e il
  proiettile sbaglia bersaglio/si comporta a caso. **Fix:** leggere `this.physics.world.gravity.y`
  invece della costante.
  **FATTO:** una riga (`const g = this.physics.world.gravity.y;`). Verificato: confrontata la
  velocita' calcolata per lo stesso bersaglio a gravita' piena vs "poca gravita'" (mutatore) —
  ora diversa e coerente (prima sarebbe stata identica, sbagliando la parabola).

---

## GRUPPO B — Nemici che saltano / Fuggitivo Dorato

- [x] **B.1 — Il Fuggitivo Dorato si blocca contro il cerume** (è un nemico "blob" a terra, fisica
  normale → collide col cerume come chiunque altro). Proposta dell'utente: farlo volante. **Prima
  di implementare, decidere insieme ad A.2** se i volanti devono o no attraversare il cerume — la
  risposta cambia la soluzione (volante coerente con A.2 risolto in un modo, o serve un'altra
  strada tipo "il fuggitivo ignora la collisione col cerume via `notFlyer`-style anche restando a
  terra/saltando").
  **FATTO — soluzione diversa dalla proposta originale, stessa esigenza risolta meglio:** NON
  diventa volante (dopo il fix di A.2 un volante collide col cerume, quindi si incastrerebbe
  comunque). Resta un blob a terra (gia' dorato) con un bypass MIRATO: `notFugitive` nel collider
  blocks lo esclude specificamente (via `e.fugitive===true`), lasciando tutti gli altri nemici
  (moscerini inclusi) a collidere normalmente. Giustificazione narrativa: e' la "preda inafferrabile"
  dell'evento, non un volante generico. Verificato: overlap forzato su un blocco → il moscerino
  normale si ferma, il fuggitivo lo attraversa.
- [x] **B.2 — Valutare nemici che SALTANO** (nuova varietà, ancora aperta — non necessaria per
  sbloccare il Fuggitivo, che e' gia' risolto sopra in altro modo). Idea a se stante per varieta',
  da riprendere quando si vuole.
  **FATTO (2026-07-13): 2 nemici nuovi, entrambi implementati** (il cerumino gia' faceva un
  affondo-balzo singolo da vicino: questi si sentono diversi apposta).
  - **Pulce** (`enemy_flea`, kind `'flea'`, dal lvl 2, peso 3): piccola e debole, salta di
    CONTINUO verso il giocatore (nessun telegrafo) — fastidiosa, non pericolosa. `fleaAI(e, now)`.
    **Tarata su richiesta utente (2026-07-13):** balzo piu' alto e meno frequente — `vy:-380`
    (era -260, ~2x l'altezza: da ~31px a ~67px di apice) e cooldown 950ms (era 550ms, circa 1
    balzo/sec invece di ~1.8/sec). Verificato: 2 balzi in 2s (prima ~3-4), picco velocita' -380.
  - **Saltatore** (`enemy_hopper`, kind `'hopper'`, dal lvl 3, peso 2): stesso schema a stati del
    cerumino (carica->balzo->recupero) ma ESAGERATO — carica piu' lunga (550ms, piu' tempo per
    reagire), balzo molto piu' alto/lungo (`vy:-420` contro `-190` del cerumino, puo' scavalcarti
    o atterrarti sopra), onda d'urto all'atterraggio (danno ad area se troppo vicino, oltre al
    contatto diretto). `hopperAI(e, now)` + `hopperLandFx(x,y)`.
  Texture procedurali nuove (`enemy_flea`/`enemy_hopper` in `BootScene.js`, stile coerente con gli
  altri nemici). Compatibili col sistema élite (verificato: aura visibile, stato IA regolare anche
  da corazzati). Verificato con test mirati (log velocita', stati, screenshot) + zero errori
  console: la Pulce salta ~2 volte/secondo, il Saltatore fa il ciclo completo idle->windup->lunge
  (picco vy -420)->atterraggio(onda)->idle.

---

## GRUPPO C — Boss  ✅ DECISO, pronto per Sonnet
_Attacco nuovo scelto dall'utente: **Balzo + schiacciata con onda d'urto**._

- [ ] **C.1 — Boss meno noioso + niente pedana-riparo + drop cure.** Tre modifiche allo stesso
  combattimento, tutte in `GameScene.js`.
  - **(a) Togliere la pedana-riparo nell'arena boss.** `buildPlatforms()` (~riga 550) sparge pedane
    lungo tutto il condotto; nei livelli boss ne spunta una comoda vicino al timpano che rende il
    fight banale. Fix: se `this.levelKind === 'boss'`, NON piazzare pedane nell'arena del boss (parte
    destra vicino al timpano). ⚠️ GOTCHA: `this.goalX` NON e' ancora impostato dentro `buildPlatforms`
    (lo imposta `buildGoal`, chiamato DOPO in `buildLevel`) → usare una soglia su `this.worldW` (zona
    boss = `x > this.worldW - 800`) e saltare gli `addPlatform` con x li'. Verifica: livello boss →
    nessuna pedana vicino al boss.
  - **(b) Drop cure alla morte del boss.** In `damageEnemy`, ramo `if (e.kind === 'boss')` del blocco
    morte (~riga 1896): dopo il banner, `this.addWaxPickup(e.x - 22, e.y - 8, true); this.addWaxPickup(
    e.x + 22, e.y - 8, true);` (3° arg `true` = pickup CURA, firma gia' esistente). Verifica: boss
    morto → 2 palline rosa raccoglibili.
  - **(c) Attacco "Balzo + schiacciata" nel `bossAI` (~riga 2050).** Macchina a stati sul boss
    (campo `e.bossAtk`), a cooldown, INTERCALATA allo sputo (non insieme). Riusa il pattern del
    Saltatore (`hopperAI`/`hopperLandFx`):
    - cooldown `e.slamReadyAt` (~ogni 4500ms; ~3000ms se `e._enraged`);
    - pronto + giocatore entro ~360px + boss a terra → stato `'slamwind'`: fermo, lampeggia + si
      accovaccia (~600ms, telegrafo lungo: e' pesante);
    - `'slamjump'`: `setVelocity(dir * (e.speed*2 + 120), -430)` (balzo alto verso il giocatore);
    - all'atterraggio (a terra e >250ms dallo stacco): `this.bossSlamFx(e.x, e.y)` = anello grosso
      (R~100) + shake forte + danno ad area al giocatore se entro R (`hurtPlayer(round(e.contactDamage
      *0.9), e.x)`) + danno al cerume vicino; poi `idle`, `e.slamReadyAt = now + cooldown`.
    - Gate: sputa SOLO se `!e.bossAtk`; disattiva il "avanza" (setVelocityX) durante slamwind/slamjump.
    Verifica (god-mode): ciclo idle→slamwind(telegrafo)→salto→onda→cooldown, e lo sputo continua tra
    uno slam e l'altro. Numeri (raggio/danno/cooldown/altezza) da tarare col playtest utente.

---

## GRUPPO D — Combattimento / feel

- [x] **D.1 — Lo scatto CON danno (dashStrike) dovrebbe essere visivamente diverso dallo scatto
  normale** (oggi probabilmente stessa scia/animazione). Si fa insieme ad A.6 (stessa funzione
  `updateDashStrike`/dash trail): aggiungere un effetto visivo distinto (colore scia, particelle)
  quando `p.dashStrike` è attivo.
  **FATTO (2026-07-13):** in realta' lo scatto non aveva NESSUN feedback visivo (ne' normale ne'
  con danno) — solo suono. Aggiunta una scia di "fantasmi" (copie dell'aspetto attuale del PG,
  stessa texture/frame/flip di `heroVisual`, che si dissolvono in 220ms): **azzurra** (`0x8fe0ff`)
  per lo scatto normale, **arancione** (`0xff6b3d`, stessa tinta di esplosioni/impatti nel gioco)
  per quello con danno, + un lampo/anello arancio UNA TANTUM all'inizio dello scatto offensivo
  (`dashStrikeFx`). Nuovi metodi `spawnDashGhost(damaging)` e `dashStrikeFx()` in GameScene.js,
  chiamati da dove parte/prosegue lo scatto. Verificato con screenshot affiancati: colori
  chiaramente distinti, zero errori console.

---

## GRUPPO E — Livelli / mondo  ✅ DECISO
_E.1 = **mutatore "Terremoto"** (non feature fissa). E.2 = **solo FASE 1 ora** (soffitto visibile +_
_piu' sfondi + protuberanze); terreno ondulato/burroni RIMANDATI a un blocco dedicato._

- [ ] **E.1 — "Terremoto": cerume vero che cade, come MUTATORE.** Oggi e' un EVENTO casuale
  (`waxcollapse` in `window.EVENTS`) con blocco-segnaposto che NON ferisce il giocatore. Trasformarlo
  (`GameScene.js` + `state.js` + `i18n.js`):
  - **Da evento a mutatore.** In `state.js`: TOGLIERE `waxcollapse` da `window.EVENTS`; AGGIUNGERE a
    `window.MUTATORS` `{ id: 'quake', color: '#e0a83a', apply(s){ s.mutQuake = true; s.startWaxCollapseEvent(); } }`.
    Cosi' capita ~1 livello su ~12 (mutatori escono ~55%, sono 7). Aggiungere `s.mutQuake` a
    `resetMutators()`. ⚠️ Confermare che il gruppo `this.collapseChunks` esista gia' quando il
    mutatore parte (chooseMutator gira in create; l'evento usa un delayedCall di 2-4s → livello gia' costruito).
  - **Piu' intenso da mutatore.** In `startWaxCollapseEvent`/`spawnCollapseChunk`: se `this.mutQuake`,
    durata ~tutto il livello e cadenza chunk piu' fitta (~1100ms invece di 1500).
  - **Sprite vero del cerume.** In `spawnCollapseChunk` (~riga 687) sostituire `'block_hard'` con un
    chunk vero (`wax_a/b/c/d`): leggere come `buildWaxSprites` sceglie texture/scala/tint e replicare.
  - **Ferisce il giocatore.** Aggiungere `this.physics.add.overlap(this.collapseChunks, this.player,
    (c) => { this.hurtPlayer(12 + window.GameState.level, c.x); this.collapseImpact(c); })` accanto
    agli altri overlap dei collapseChunks (oggi colpisce solo il cerume via `collapseImpact`).
  - **i18n:** `mut_quake` EN+IT (banner mutatore).
  Verifica: forzando il mutatore quake, cadono chunk di cerume VERO che feriscono il PG e aprono
  varchi nel cerume; niente piu' evento waxcollapse separato.

- [ ] **E.3 — Pedane non sempre raggiungibili (bugfix, si fa QUI prima di E.2).** In `buildPlatforms`
  (~riga 550) le pedane alte (150-220px sopra il suolo) e lo scrigno segreto (fino a ~96px sopra la
  pedana alta) possono uscire dalla portata di UN salto — e vanno raggiunte col SINGOLO salto (il
  doppio salto e' uno sblocco, non garantito). Fix: `JUMP_H = p.jumpVelocity^2 / (2*CONFIG.GRAVITY)`,
  `MAXUP = JUMP_H * 0.82` = dislivello massimo consentito; CLAMPARE l'altezza di ogni pedana a `MAXUP`
  rispetto alla superficie da cui la si raggiunge (suolo per la bassa, pedana bassa per l'alta, pedana
  alta per lo scrigno). Verifica in preview SENZA doppio salto: si arriva sempre alla pedana sopra con
  un salto solo.

- [ ] **E.2 — FASE 1 (solo questa ora).** Terreno ondulato/burroni RIMANDATI (vedi Fase 2).
  - **(1) Soffitto visibile — CODICE, Sonnet lo fa subito.** Oggi le cose appese in alto (cumuli di
    soffitto, gocce, protuberanze) partono da y=0 senza superficie visibile. In `gfx.js` (cercare
    dove si disegna il `ground`/pavimento), aggiungere una FASCIA di soffitto in cima, **piu' sottile
    del pavimento**, stessa palette carnosa. Solo estetica (il bordo alto del mondo e' gia' a y=0,
    niente collider nuovo). Verifica: striscia di "tessuto" in alto, gli oggetti appesi ci partono da sotto.
  - **(2) piu' sfondi + (3) piu' protuberanze — LOOP AI, serve l'utente.** Nuove immagini su Leonardo
    (come `bg_flesh_01` e le protuberanze): l'assistente scrive i prompt "salva-filtro", l'utente
    genera, l'assistente ritaglia (`cutout_bg.ps1`)+pixella e aggancia (fondale gia' ha settore-per-
    livello in `drawBackground`; protuberanze = chiavi in `GameGfx.PROTUBERANCES` + load in BootScene).
    Si fa quando l'utente e' pronto a generare — NON codice puro. Intanto il soffitto (1) da' varieta'.

### E.2 — FASE 2 (RIMANDATA, blocco Opus dedicato)
Condotto **ondulato** (sali/scendi) + **burroni** (buchi nel pavimento). Grande e rischioso: il
pavimento oggi e' UN collider piatto a `H - GROUND_H`; servirebbe terreno a quote variabili (collider a
segmenti/poligono) + gestione della CADUTA del PG nei burroni (morte/respawn/danno). Tocca
`buildLevel`/`buildPlatforms`/`buildGoal`/`buildMounds` (tutti assumono quota fissa) + camera +
`gfx.js`. **Pianificare a fondo con Opus prima di darlo a Sonnet — non improvvisare.**

---

## GRUPPO F — Economia/shop  ✅ DECISO
_Le palline di cerume le rilasciano **solo i nemici** (la pulizia del cerume resta automatica). A fasi._

- [ ] **F.1a+b — Ridurre il cerume + drop-da-raccogliere dai nemici** (`GameScene.js` + `state.js`).
  - **(a) Ridurre il cerume.** Manopola globale `window.CONFIG.WAX_GAIN` (partire da ~0.55, poi si
    tara) moltiplicata ai punti di guadagno automatici che restano: `grabPickup` (~riga 884) e la
    pulizia del cerume in `damageBlock` (~riga 1819). Cosi' TUTTO il cerume passa da questi due
    punti, scalato.
  - **(b) Nemici → PALLINE invece di accredito automatico.** In `damageEnemy`, ramo morte (~riga
    1889), TOGLIERE `window.GameState.wax += ...` e far cadere una pallina: nuovo helper
    `dropWaxPellet(e.x, e.y - 8, e.waxValue)` modellato su `addWaxPickup` (ramo non-cura) — pickup nel
    gruppo `this.pickups` (niente gravita', come gli altri), `waxValue` = quello del nemico, texture
    `wax_glob`, piccolo "pop" di comparsa. Si raccoglie con l'overlap player↔pickups gia' esistente,
    la Calamita lo attrae. **ECCEZIONE Fuggitivo Dorato:** accredito ISTANTANEO (ricompensa evento) →
    `if (e.fugitive) { GameState.wax += ...; } else { this.dropWaxPellet(...); }`. Verifica: uccidere
    un nemico lascia una pallina; totale cerume/livello piu' basso; fuggitivo da' subito il bottino.

- [ ] **F.1c — Piu' progetti sbloccabili** (DOPO F.1a+b). Additivo, seguire ESATTAMENTE il pattern
  esistente (magnet/blast/splash/companion): (1) voce in `window.BLUEPRINTS` (state.js) col costo;
  (2) flag in `newPlayer()`; (3) carta `locked` in `UpgradeScene.ALL`; (4) riga nel negozio
  `ShopScene`; (5) meccanica in `GameScene`; (6) i18n `bp_*`/`up_*`/`ability_*` EN+IT. **Proposta 3
  progetti (CONFERMARE/variare con l'utente):** **Trivella** (getto/mazza attraversa piu' cerume di
  fila), **Riflesso** (lo scudo, parando, respinge indietro il proiettile), **Doppio Getto** (una
  seconda bocca che spara all'indietro).

---

## GRUPPO G — Audio (grande, standalone, sessione dedicata)

- [ ] **G.1 — Rifare musica e suoni** (`src/sfx.js`). **Bivio da decidere con l'utente PRIMA di
  iniziare:** (A) restare **procedurale** (Web Audio, gira da `file://`, zero peso) ma rifatto meglio,
  oppure (B) passare a **file audio veri** (piu' belli ma da procurare/generare + incorporare per
  `file://` + peso). Serve anche una direzione di **stile** (retro/chiptune? organico/squishy?
  comico?). Blocco a se', quando si arriva.

---

## GRUPPO H — Estetica futura (note, non azioni immediate)

- [ ] **H.1 — Il PG dovrebbe "sporcarsi" di cerume** (visivamente, mentre pulisce/combatte).
  Si aggancia alla pipeline hero AI/AutoSprite già in uso (tint o overlay sul `heroVisual`, o una
  variante di sprite sheet "sporco"). Da fare quando si torna sul personaggio.
- [ ] **H.2 — Le aureole colorate delle varianti élite dovranno sparire quando i nemici avranno
  sprite AI veri** (oggi sono l'unico modo per distinguere a colpo d'occhio Corazzato/Esplosivo/
  Split). **Non è un'azione da fare ora** — è solo una nota per non dimenticare di rimuoverle
  quando arriverà quel lavoro (stesso trattamento AI+AutoSprite del personaggio, vedi
  `HANDOFF.md`).

---

## Ordine per Sonnet (deciso 2026-07-13)
**Fatti:** Gruppo A (7/7) + B.1 (`cbd4fe2`), D.1 (`5e81dec`), B.2 (`a29f1c4`). **Da fare, in ordine:**
1. **C** (boss: no-pedana + drop cure + balzo-schiacciata).
2. **E.1** (mutatore Terremoto: cerume vero + ferisce il PG) → poi **E.3** (pedane raggiungibili, rapido).
3. **F.1a+b** (riduci cerume + palline dai nemici).
4. **F.1c** (nuovi progetti).
5. **E.2 Fase 1 punto (1)** (soffitto visibile — codice puro). Punti (2)(3) (sfondi/protuberanze) = loop AI con l'utente.
6. **[RIMANDATI a planning Opus dedicato]** E.2 Fase 2 (ondulato + burroni), G (audio).
7. **H** — non ora, solo promemoria.

Ciclo fisso per ogni punto: implementa → `/code-review` e/o skill *verify* → collaudo dal vivo
(god-mode, screenshot in preview) → riferisci in italiano semplice → chiedi se committare. Numeri
"sensati" (danni/raggi/cooldown/`WAX_GAIN`) da TARARE col playtest dell'utente.
