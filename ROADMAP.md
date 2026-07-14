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
- [ ] **B.2 — Valutare nemici che SALTANO** (nuova varietà, ancora aperta — non necessaria per
  sbloccare il Fuggitivo, che e' gia' risolto sopra in altro modo). Idea a se stante per varieta',
  da riprendere quando si vuole.

---

## GRUPPO C — Boss

- [ ] **C.1 — Il boss è noioso** + c'è sempre una pedana comoda vicino per ripararsi senza rischio
  (rende il fight banale) + alla morte dovrebbe rilasciare 1-2 palline di cura. Tre modifiche
  collegate allo stesso combattimento: (a) rivedere il posizionamento/disponibilità delle pedane
  nell'arena boss (`buildLevel`/layout boss-specifico), (b) rendere il pattern d'attacco più
  interessante (varietà oltre "avanza + sputo telegrafato + infuria a metà vita"), (c) drop cure
  alla morte (si aggancia al sistema pickup/cura già esistente, `addWaxBlock(...,heal=true)` o
  simile). Da trattare come piccolo redesign, non un fix a riga singola.

---

## GRUPPO D — Combattimento / feel

- [ ] **D.1 — Lo scatto CON danno (dashStrike) dovrebbe essere visivamente diverso dallo scatto
  normale** (oggi probabilmente stessa scia/animazione). Si fa insieme ad A.6 (stessa funzione
  `updateDashStrike`/dash trail): aggiungere un effetto visivo distinto (colore scia, particelle)
  quando `p.dashStrike` è attivo.

---

## GRUPPO E — Livelli / mondo (visione grande, da pianificare a parte)

- [ ] **E.1 — Variante "cerume che cade" fa schifo.** Proposta utente: usare direttamente lo
  sprite del cerume vero (quello dei cumuli da pulire, non un disegno procedurale a parte) e farlo
  cadere OGNI TANTO dal soffitto (fa danno se colpisce). Da decidere: **feature fissa su ogni
  livello** (piccola varietà ambientale sempre presente) **oppure variante/mutatore dedicato**
  (es. "Terremoto"). Si lega a E.2 (soffitto visibile) — stessa area: cosa succede in alto.

- [ ] **E.2 — Livelli monotoni: servono più sfondi** (varianti) **+ mostrare il SOFFITTO** (più
  sottile del pavimento, per capire a cosa si "aggrappano" gli oggetti appesi in alto) **+ condotto
  NON dritto** (ondulato, sali/scendi) **+ valutare protuberanze/fessure/burroni.** Il pezzo più
  grande di tutta la lista: tocca `gfx.js` (sfondo/soffitto) E `GameScene.buildLevel`/
  `buildPlatforms`/`buildGoal` (il terreno oggi è piatto a un'altezza fissa). Da pianificare come
  blocco a parte con più fasi (prima soffitto visibile, poi ondulazione, poi protuberanze/burroni),
  non un fix in un turno solo.

- [ ] **E.3 — Le pedane non sempre sono raggiungibili.** Bug di generazione livello
  (`buildPlatforms`, dislivelli). Da investigare con test mirati (probabilmente un caso limite di
  altezza/distanza non coperto dai vincoli attuali). **Conviene farlo insieme a E.2** dato che si
  tocca comunque `buildPlatforms` per l'ondulazione del terreno — un solo giro di modifiche a quella
  funzione invece di due.

---

## GRUPPO F — Economia/shop (rework grande, da pianificare a parte)

- [ ] **F.1 — Troppo facile comprare i potenziamenti dal negozio.** Pacchetto di modifiche
  correlate proposte dall'utente: (a) ridurre il cerume ottenuto per livello; (b) i nemici
  rilasciano PALLINE di cerume da raccogliere attivamente invece del cerume che si accumula da
  solo (rimuovere l'acquisizione automatica) — tocca `damageEnemy`/kill reward, nuovo sistema
  pickup-drop; (c) il negozio è troppo limitato → aumentare i PROGETTI sbloccabili (nuovi
  `BLUEPRINTS` in `state.js` + voci in `ShopScene`). È il pezzo più grande dopo E.2: da pianificare
  a fasi (prima il tasso di guadagno, poi il drop-da-raccogliere, poi i nuovi progetti).
  **Indipendente da A.4** (quello è un bug preciso, questo è un rework di bilanciamento) ma stessa
  area di codice (UpgradeScene/BLUEPRINTS) — occhio a non ripassarci sopra due volte a vuoto.

---

## GRUPPO G — Audio (grande, standalone)

- [ ] **G.1 — Musica e suoni da rivedere completamente.** Tutto `src/sfx.js` (motore procedurale).
  Non collegato a nient'altro in questa lista — merita una sessione dedicata a parte quando si
  arriva al suo turno.

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

## Ordine proposto (salvo diverso avviso dell'utente)
1. ~~**Gruppo A**~~ **✅ FATTO** (7/7, vedi sopra) + **B.1 fatto insieme**. Tutto verificato in
   preview, **NON ancora committato** — in attesa di conferma dell'utente prima di salvare.
2. **Gruppo D.1** (scia diversa per lo scatto-con-danno) — rapido, stessa area di codice appena
   toccata per A.6, ha senso farlo subito dopo se l'utente conferma.
3. **Gruppo B.2** (nemici che saltano) — idea a se stante, quando si vuole.
4. **Gruppo C** (boss) — redesign piccolo ma multi-parte.
5. **Gruppo E** (livelli/mondo) — grande, a fasi. Probabilmente il blocco successivo a sé stante.
6. **Gruppo F** (economia/shop) — grande, a fasi.
7. **Gruppo G** (audio) — quando si arriva, sessione dedicata.
8. **Gruppo H** — non ora, solo promemoria.

Per ciascun punto, ciclo fisso come sempre: implementa → controllo qualità/`code-review` → collaudo
dal vivo (ora si VEDE, screenshot in preview) → riferisci in italiano semplice → chiedi se
committare.
