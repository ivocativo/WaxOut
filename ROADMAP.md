# Earwax War — Piano esecutivo (blocco "Correzioni playtest — round 2")

> 📄 **A cosa serve questo file:** è la "lista di lavoro" del blocco in corso (con le caselle da
> spuntare), usa e getta. Per lo **stato generale** del progetto, come collaudare e le regole vedi
> **`HANDOFF.md`**; per la descrizione del gioco vedi **`README.md`**.

_Preparato 2026-07-17 da Opus dopo il 2° playtest telefono dell'utente (15 segnalazioni). Le cause_
_qui sotto sono **già verificate nel codice** (file:riga) o **dal vivo in preview** dove non bastava_
_leggere — si affrontano una alla volta o a gruppetti, nell'ordine in fondo salvo diverso avviso._
_Regole invariate: god-mode nei test SEMPRE, i18n EN+IT per stringhe nuove, commit solo su richiesta._

> ✅ **Blocco precedente ("Correzioni playtest — round 1") CHIUSO e pushato.** Fatti e in
> `origin/main`: Gruppo A (7 bug) `cbd4fe2`, B.1+D.1+B.2, **C.1** boss `4913ba3`, **E.1+E.3**
> `672c20e`, **F.1a+b** `3a296a9`, **F.1c** (4 progetti) `7571519`, **soffitto** `9b43c73`. Il
> dettaglio di quel blocco è nella cronologia git (non più qui: questo file è usa e getta).

---

## Come leggere questa lista
Ogni punto: **cosa ha segnalato l'utente** → **causa** (file:riga, verificata) → **cosa fare** →
**note di collegamento**. Numeri "sensati" (velocità/altezze/tempi/colori) da TARARE col playtest.

---

## GRUPPO A — Fix rapidi, causa già individuata  ✅ TUTTI FATTI E VERIFICATI (2026-07-17)
_Tutti e 4 corretti nella stessa sessione, verificati con test mirati in preview (dati, zero_
_errori). **NON ancora committato** — in attesa di conferma dell'utente._

> ⚠️ **Nota tecnica per i prossimi round:** in questa sessione di preview il tab del browser resta
> in background (rAF/orologio di gioco fermi), il che ha rotto in due punti gli approcci di test
> "al buio" usuali: (1) `scene.start()` ripetuto in loop NON ri-esegue davvero `create()` finché
> non parte un frame reale — una scena può restare bloccata a metà creazione (`sys.settings.status
> === 4`) e ridare sempre lo stesso contenuto stantio; soluzione: se i risultati sembrano sospetti-
> mente identici a ripetizione, **ricaricare la pagina** (`navigate` con `force:true`) prima di
> dubitare della logica. (2) Per verificare la GEOMETRIA di un'animazione (non solo "esiste" ma
> "va nel verso giusto"), **non fidarsi di `getWorldTransformMatrix()` da solo** (ignora `flipX`/
> `flipY`, che sono solo un mirror dei pixel, non della matrice) — usare invece `sprite.getBounds()`
> a piu' punti dell'arco/tween con `tweens.killTweensOf()` + rotazione impostata a mano, cosi' si
> confronta la vera scatola visibile invece di un singolo punto locale.

- [x] **A.1 — L'animazione del coton fioc va SEMPRE verso destra.**
  Causa (verificata): `showMeleeWeapon` (`GameScene.js` ~1875) fa ruotare l'arma con un tween
  d'angolo FISSO da `-1.1` a `0.7` (un arco orario) e applica solo `setFlipY(this._weaponFlip)` in
  base al facing. Il flip verticale non cambia il VERSO della rotazione, quindi l'arco "spazza"
  sempre verso destra anche quando guardi a sinistra.
  **FATTO (causa piu' sottile del previsto — 3 tentativi prima di quello giusto):**
  `setFlipX` invece di `setFlipY` da SOLO non basta (il flip mescola solo i PIXEL, non la matrice
  di rotazione/posizione: verificato con `getWorldTransformMatrix`); nemmeno la semplice
  NEGAZIONE dell'angolo (`-θ`) basta, perche' geometricamente e' un mirror ALTO/BASSO, non
  SINISTRA/DESTRA, e sposta l'arco anche in verticale (verificato con `getBounds()`: Y diversa tra
  destra e sinistra). La formula corretta e' **`π - θ`** (riflessione attorno all'asse verticale) +
  `setFlipX` per l'orientamento dei pixel (utile per armi asimmetriche come il martello). Fix in
  `showMeleeWeapon`: `const mirror = (theta) => this._weaponFlip ? (Math.PI - theta) : theta;` poi
  `w.rotation = mirror(-1.1)` e il tween verso `mirror(0.7)`. Verificato con `getBounds()` su 4
  punti dell'arco (inizio/2 meta'/fine) per ENTRAMBE le armi (coton fioc + martello): X sempre
  specchiata esattamente attorno al giocatore, Y IDENTICA tra destra e sinistra in ogni punto.

- [x] **A.2 — Dare alle Pulci balzi ancora più alti.**
  Causa: `fleaAI` (`GameScene.js` ~2077) usava `setVelocity(dir*speed*2.2, -380)`.
  **FATTO:** alzata la componente verticale a `-480` (apice ≈105px, da 66px). Cooldown
  `hopReadyAt` lasciato a 950ms (l'aria in volo resta comunque sotto quella soglia, niente
  bisogno di allungarlo). Verificato: picco velocita' verticale = -480 come atteso.

- [x] **A.3 — I proiettili dei nemici sono identici al cerume che raccogli.**
  Causa (verificata): `spitAt` (`GameScene.js` ~1437) creava la pallina sputata con
  `this.projectiles.create(sx, sy, 'wax_glob')` — la STESSA texture del cerume raccoglibile.
  **FATTO:** nuova texture procedurale dedicata (`PixelArt.poisonBall`, in `pixelart.js`) —
  pallina verde-acido/viola con bordo scuro e riflesso chiaro, generata in `BootScene` come chiave
  `'proj_poison'`; `spitAt` ora la usa al posto di `wax_glob` (copre sia il gorgogliante sia il
  boss, che passano entrambi da `spitAt`). Verificato: texture del proiettile = `proj_poison` per
  entrambi i tipi di nemico, nettamente diversa dal pickup.

- [x] **A.4 — Lo Scatto con danno va sbloccato solo DOPO lo scatto normale.**
  Causa (verificata): la carta `dashstrike` (`UpgradeScene.js` ~52) faceva `apply: (s) => {
  s.dashStrike = true; if (!s.dash) s.dash = true; }` — REGALAVA lo scatto base se non posseduto.
  Il filtro `avail` non aveva concetto di prerequisito (solo le EVOLUZIONI usano `needs`).
  **FATTO:** aggiunto supporto generico `needs` al filtro `avail` (`if (u.needs &&
  owned.indexOf(u.needs) === -1) return false;`); su `dashstrike` aggiunto `needs: 'dash'` e
  tolto l'auto-regalo. Verificato su 50 aperture della carta SENZA scatto posseduto (150 carte
  totali): "Dash Strike" mai comparsa; CON scatto posseduto: ricomparsa al tentativo 43/80 (in
  linea con la probabilita' attesa ~2.5%/slot). Nessun'altra carta si appoggiava all'auto-regalo.

---

## GRUPPO B — Soffitto + pedane alte  ⚠️ DA FARE INSIEME (sono in tensione)

_Questi due punti si CONDIZIONANO: rendere il soffitto "tangibile" (B.1) toglie spazio in alto, il_
_che peggiora B.2 (pedane alte irraggiungibili). Vanno decisi e implementati nello stesso turno._

- [x] **B.1 — Il soffitto è troppo basso e intangibile.** FATTO E VERIFICATO (2026-07-17).
  **NON ancora committato.**
  **FATTO:** fascia visibile piu' sottile (`CEIL_Y = round(gh*0.28)` ≈ 50px, era 81px = `gh*0.45`)
  **e** tangibile — `this.CEIL_Y` salvato sulla scena (lo riusa anche B.2) e riordinato `create()`
  per calcolarlo PRIMA di `physics.world.setBounds`, che ora parte da `(0, CEIL_Y, worldW, H-gh-
  CEIL_Y)` invece che da `(0,0,...)`: il bordo fisico alto del mondo coincide col fondo del
  soffitto, non piu' con lo schermo. La camera resta `setBounds(0,0,worldW,H)` (invariata:
  continua a mostrare la fascia visivamente, cambia solo dove si FERMANO i corpi fisici). I
  volanti (`dropFromCeiling`, `restY` 90-170) restano comodamente sotto `CEIL_Y=50`, nessuna
  modifica necessaria. Le gocce (`movers`) non hanno `collideWorldBounds`, non toccate.
  Verificato: PG lanciato verso l'alto (velocita' enorme) si ferma esattamente a `body.top=50` =
  `CEIL_Y`, `blocked.up` scatta correttamente.

- [x] **B.2 — La pedana più in alto a volte è irraggiungibile per il limite dello schermo in alto.**
  FATTO E VERIFICATO (2026-07-17), insieme a B.1. **NON ancora committato.**
  **FATTO:** aggiunto un TETTO a `clampAbove` in `buildPlatforms` — `minY = this.CEIL_Y + 56`
  (corpo del PG ~40px + margine 16px) — `clampAbove = (refY, rawY) => Math.max(rawY, refY-MAXUP,
  minY)`, cosi' nessuna pedana (ne' lo scrigno segreto) puo' finire sopra quella quota, qualunque
  sia la catena di riferimenti (suolo→bassa→alta→scrigno). Verificato con la stessa chiusura di
  raggiungibilita' del round 1 (E.3) SENZA doppio salto, su **45 generazioni di livello (397
  pedane totali): zero irraggiungibili, zero sopra il nuovo limite del soffitto.** Volante testato
  di rimbalzo: si assesta a y≈89-90 (dentro il range atteso 90-170), ben sotto `CEIL_Y=50`. Zero
  errori console in tutta la verifica.

---

## GRUPPO C — Scatto (dash): feedback visivo

- [x] **C.1 — Durante lo scatto la scia è poco visibile + serve più differenza tra scatto normale
  e scatto con danno.** FATTO E VERIFICATO (2026-07-17). **NON ancora committato.**
  **FATTO:** in `spawnDashGhost` — (a) throttle dimezzato (40ms→20ms: quasi doppi fantasmi nella
  scia); (b) DIFFERENZIATI per intensita', non solo colore: alpha iniziale 0.65 (normale, era
  0.5) contro 0.85 (con danno) — non solo arancio invece di azzurro, anche visibilmente PIÙ
  luminoso; (c) scintille (`burst('bit_hard', ...)`) lungo il tragitto SOLO nello scatto
  offensivo, throttle 60ms indipendente da quello dei fantasmi. L'anello una-tantum
  (`dashStrikeFx`, gia' esclusivo del danno, invariato) resta l'unica cosa che lo scatto normale
  non ha, come richiesto. Verificato con test a tempo reale (`game.step()`): in una finestra di
  ~167ms (durata di uno scatto), 5 fantasmi per entrambi (prima ne sarebbero usciti meno, throttle
  piu' alto); alpha range normale 0.34→0.65, con danno 0.72→0.85 (nettamente piu' alto in ogni
  istante); tinte esatte (0x8fe0ff azzurro / 0xff6b3d arancio); 3 scintille generate nello scatto
  con danno, 0 in quello normale; l'anello si crea correttamente. Zero errori console.
  **Collegamento:** stessa area di A.4 (lo scatto con danno ora è un vero sblocco a valle): il
  feedback ora rende giustizia al fatto che è "avanzato".

---

## GRUPPO D — Boss

- [x] **D.1 — Il boss non si stacca da terra quando salta (balzo+schiacciata di C.1).**
  FATTO E VERIFICATO (2026-07-17). **NON ancora committato.**
  Causa originale: l'arco era troppo ORIZZONTALE (`bossAI`) — `setVelocity(dir*(speed*2+120),
  -430)` dava ~147px avanti contro solo ~84px in su (teorico), letto come "scivolata" non salto;
  niente stiramento/ombra per vendere lo stacco.
  **FATTO:**
  - **(a) Arco verticale + atterra SUL giocatore.** Salto molto piu' alto (`vy=-600`, apice
    teorico 163.6px, quasi il DOPPIO di prima) e orizzontale calcolato dalla distanza REALE al
    giocatore (non piu' un moltiplicatore fisso): `flightT = 2*600/gravity`, `vx =
    (player.x-e.x)/flightT` (volo simmetrico, stessa quota di partenza/arrivo), con clamp di
    sicurezza ±420. Raggio d'innesco allargato da 360 a 440px (nota della roadmap: con l'arco
    piu' verticale il boss deve poter agganciare lo slam anche da piu' lontano).
  - **(b) Venduto il salto:** stiramento al decollo (`setScale(bs*0.8, bs*1.25)`, l'opposto
    dell'accovacciamento del windup, si riassesta da solo con un tween in 200ms) + OMBRA a terra
    (`e.slamShadow`, nuova ellisse) che segue orizzontalmente e si rimpicciolisce/schiarisce con
    l'altezza (`e.slamApex` salvato al decollo), si distrugge all'atterraggio (e anche su morte
    del boss a meta' volo, hook `destroy`).
  - **⚠️ Scoperta tecnica IMPORTANTE per i test futuri (vedi nota in cima al Gruppo A):**
    `physics.world.step()` chiamato DA SOLO e ripetutamente (senza il resto del ciclo di gioco)
    "blocca" il flag `body.blocked.down` a `true` per sempre dopo un lungo periodo di riposo a
    terra, ANCHE se il corpo si stacca davvero — **riproducibile pure con un salto banale, senza
    nessuna riga del mio codice**. Mi ha fatto sembrare (erroneamente) che l'atterraggio scattasse
    troppo presto (~250ms, il minimo di sicurezza) invece che alla fine del volo vero. Il fix del
    test: usare `window.game.step(time, delta)` (il PASSO COMPLETO del motore, la stessa via della
    partita vera — gia' usato per il test dell'arco del coton fioc) invece del solo
    `physics.world.step()`. **Retroattivamente, questo significa che anche il numero "71px" del
    round 1 (C.1) era quasi certamente falsato dallo stesso artefatto** (71px combacia quasi
    esattamente con lo spostamento atteso nei primi 250ms del vecchio salto, non con l'apice vero).
  Verificato con `game.step()` (ciclo motore reale): apice 162px (teorico 163.6, quasi esatto);
  65 frame in aria (teorico 65.4); **atterra a 248px da un bersaglio posto a 250px** (praticamente
  esatto); stiramento visibile (`scaleY` >1 durante il volo); ombra visibile che si restringe
  salendo e si allarga scendendo, poi si distrugge; danno da impatto applicato all'atterraggio
  (`bossSlamFx`); innesco confermato a 400px (dentro il nuovo raggio, fuori dal vecchio). Zero
  errori console.

---

## GRUPPO E — Terremoto (mutatore)

- [x] **E.1 — La scossa si deve PERCEPIRE + i blocchi che cadono devono essere già VISIBILI
  attaccati al soffitto, e a ogni scossa ne cade qualcuno.** FATTO E VERIFICATO (2026-07-17).
  **NON ancora committato.**
  **FATTO — ridisegno completo di `startWaxCollapseEvent`** (tolta `spawnCollapseChunk`, sostituita
  da 4 metodi nuovi):
  - **(a) Cerume già appeso al soffitto.** `placeStalactites()` piazza 5-12 sprite VERI
    (`wax_a/b/c/d`, tinti come il cerume duro, origin in alto ancorato a `this.CEIL_Y` di B.1)
    lungo il livello (`pickHazardX`, come le altre insidie) — scenografia inerte in
    `this.stalactites`, niente fisica finché una scossa non le stacca.
  - **(b) Scossa percepibile a impulsi.** `scheduleQuakePulse()` si ri-programma da sola ogni
    2.5-3.5s (intervallo diverso ogni volta, non meccanico); `quakePulse()` fa
    `cameras.main.shake(400, 0.014)` + `Sfx.smash()` (rombo) + stacca 1-3 stalattiti (preferendo
    quelle più vicine al giocatore, via `detachStalactite`, che riusa `collapseChunks` — stessa
    fisica/danno/impatto del round 1, solo velocità iniziale un po' più alta: parte "smossa"
    dalla scossa, non da ferma). Se sono finite, 40% di possibilità a ogni scossa di ripiazzarne
    una nuova (si ripopolano piano, non restano vuote per il resto del livello).
  - Ripulita anche la pulizia di fine livello: le due chiamate `this.collapseTimer.remove()` in
    `levelComplete()`/`gameOver()` ora puntano al nuovo `this.quakeTimer` (il vecchio nome era
    rimasto due punti extra, non trovato al primo giro).
  Verificato: 7 stalattiti piazzate correttamente (sprite giusto, tinta 0xd59a2e, ancorate a
  `CEIL_Y`); una scossa manuale stacca la stalattite più vicina al giocatore, crea un chunk vero
  con gravità e velocità di partenza corrette, la camera trema; su 40 scosse a stalattiti vuote,
  11 ripopolamenti (~27%, coerente col 40% di probabilità); **percorso automatico REALE**
  verificato con `game.step()` (mutatore applicato come farebbe `chooseMutator`, ~8s di gioco
  reale): stalattiti piazzate da sole, almeno una scossa scattata da sola con un chunk caduto,
  timer ancora attivo. Zero errori console in tutta la verifica.

---

## GRUPPO F — Modalità a tempo (Corsa + Assedio)

- [x] **F.1 — Corsa contro il tempo: manca un timer ben visibile che lampeggi negli ultimi
  secondi.** FATTO E VERIFICATO (2026-07-17). **NON ancora committato.**
  **DECISO con l'utente:** se il tempo scade prima del timpano → **Game Over** (come morire, non
  una penalità morbida).
  **FATTO:** (a) `rushEndAt = now + round(worldW/130)*1000 + 8000` (ritmo medio atteso ~130px/s +
  margine fisso 8s di reazione — numero da TARARE col playtest, come sempre); scaduto senza aver
  raggiunto il timpano → `gameOver()`. Guardia anti-ingiustizia: se traguardo e scadenza capitano
  nello STESSO frame, vince il traguardo (`this.player.x < this.goalX` nella condizione), non la
  scadenza. (b) Nuovo **widget-timer condiviso** `buildBigTimer`/`updateBigTimer` (38px, centrato
  y=92, sostituisce il vecchio `siegeText` da 20px) — lampeggia (rosso + scala 1.18x) negli ultimi
  5s. Banner `game_rush_in` aggiornato per menzionare il tempo (EN+IT). Nuova chiave i18n
  `hud_rush` EN+IT.
  Verificato con `game.step()`: budget calcolato correttamente (worldW 3360 → 34s); testo/colore/
  scala del timer corretti sia lontano dalla scadenza che negli ultimi secondi (lampeggio
  alternato confermato su due campioni a 200ms di distanza); scadenza con PG lontano dal traguardo
  → vero Game Over (schermata `over_title` confermata, non solo `locked=true`); scadenza con PG
  GIÀ al traguardo → Livello Completato, non Game Over (guardia funziona).

- [x] **F.2a — Assedio: timer poco visibile.** FATTO E VERIFICATO (2026-07-17), stesso widget di
  F.1. **NON ancora committato.** Verificato: `bigTimerText` mostra "Survive: Ns" per l'assedio,
  vecchio `siegeText` rimosso (non più definito). **F.2b (arena dedicata) resta NON fatta**: è
  design grosso, **da pianificare a fondo con Opus prima** — non toccato in questo turno, come da
  decisione del 2026-07-17.
  **Nota tecnica (non è un bug del gioco):** durante questa verifica è comparso un errore console
  `Texture key already in use: 00000000-...` — riproducibile anche su un avvio completamente
  pulito (server riavviato, PRIMA che qualsiasi mio codice giri), quindi non è causato da F.1/F.2:
  sembra una singolarità dell'ambiente di preview di questa sessione (RNG interno di Phaser che
  genera chiavi-testura automatiche, probabilmente legato alle stranezze gia' note di questo tab
  in background), non un difetto del codice — tutta la logica testata (timer, scadenza, guardia,
  game over, livello completato) ha funzionato correttamente nonostante l'avviso.

---

## GRUPPO G — Contenuti / progressione

- [ ] **G.1 — Carte base "corpo a corpo" poco chiare (Braccio Lungo, Riflessi, Affilatura).**
  **RADICE del problema (emersa parlando con l'utente 2026-07-17):** TRE carte comuni toccano solo il
  CORPO A CORPO (coton fioc) ma hanno nomi "generali", quindi il giocatore non capisce cosa facciano
  e le crede inutili o doppie:
  - `range` "Braccio Lungo" (`UpgradeScene.js` ~38): `s.attackRange += 0.25`, usato SOLO in
    `meleeSwing` (`range = baseRange * p.attackRange`, ~1810). Su un coton fioc corto è impercettibile.
  - `attspd` "Riflessi" (~36): `s.attackCooldown -= 45`, SOLO il colpo corpo a corpo (il getto usa
    `shotCooldown`, altra cosa). Il nome/descrizione non dicono QUALE attacco.
  - `damage` "Affilatura" (~34): `s.damage += 8`, usato in melee/dash/onde d'urto — NON tocca il
    getto (che usa `p.jetDamage`, separato). Da qui la confusione dell'utente ("+danno esiste già,
    che differenza con un getto più potente?" → risposta: sono cose diverse, +danno è corpo a corpo).
  **DECISIONI dell'utente:**
  - **Braccio Lungo → RENDERLO EVIDENTE:** allungare di più la portata melee (es. +40%/pesca) E
    mostrarlo (arco/flash del colpo visibilmente più lungo). Resta una carta corpo a corpo.
  - **Riflessi → CHIARIRE:** nome/descrizione i18n che dicano esplicitamente che velocizza il COLPO
    CORPO A CORPO (coton fioc), non il getto (es. IT "Coton fioc più rapido").
  - **Affilatura → CHIARIRE lo scope** nella descrizione (è danno corpo a corpo/mischia, non getto),
    così non sembra coprire tutto. (Meccanica invariata.)
  i18n EN+IT per i testi ritoccati. Verifica: le tre carte comunicano chiaramente cosa potenziano;
  Braccio Lungo si vede all'uso. **Collegamento:** stessa famiglia "melee-only poco leggibile".

- [ ] **G.2 — Aggiungere UN nuovo potenziamento base: "Getto più rapido".**
  **DECISO con l'utente (2026-07-17):** i comuni sono pochi, ma NON si aggiungono né "+Salto" (il
  salto va bene com'è, non toccarlo) né "+Danno Getto" (eviterebbe il doppione concettuale con
  Affilatura — il danno del getto cresce già coi permanenti del negozio e con le abilità). Si
  aggiunge SOLO **"Getto più rapido"**: nuova carta comune `rep:true, rarity:'common'` che riduce
  `shotCooldown` (es. `s.shotCooldown = Math.max(120, s.shotCooldown - 40)`), il parallelo di
  "Riflessi" ma per il GETTO a distanza (oggi il getto non ha nessun comune che lo velocizzi).
  i18n `up_jetspd_name/_desc` EN+IT (IT es. "Getto Rapido / Raffiche più veloci"). Verifica: la
  carta esce a fine livello e accorcia davvero il tempo tra uno spruzzo e l'altro.

---

## GRUPPO H — Menu (grafica)

- [ ] **H.1 — I menu vanno rivisti: grafica obsoleta + togliere le scritte inutili dalla schermata
  principale.** Causa (verificata): `MenuScene.js` mostra, tutto insieme, titolo + sottotitolo +
  riga banca + 2 mascotte + un BLOCCO di 9 righe di controlli/obiettivo (`menu_ctrl_*`/`menu_goal_*`,
  ~38-52) + pulsanti; sfondo = gradiente + ellissi disegnati a mano (`drawBackground`, ~90-107),
  pulsanti = testo monospace piatto su giallo. Affollato e datato. **Fix (estetico, in parte
  soggettivo):** (a) ALLEGGERIRE la schermata principale — togliere il blocco controlli/obiettivo
  (i comandi touch sono già a schermo in gioco e ovvi; al massimo spostarli in un pannellino "?"
  o in un tutorial al primo avvio); tenere l'essenziale (titolo, START, NEGOZIO, lingua, audio,
  banca); (b) svecchiare il LOOK — titolo più caratterizzato, pulsanti più curati, palette coerente
  con l'interno "carnoso" del gioco. **DECISO con l'utente (2026-07-17): SONNET PROPONE UNA BOZZA
  e poi si itera guardandola** (niente direzione d'arte prima). Sonnet faccia una prima versione
  rinnovata + alleggerita, screenshot, e la si aggiusta insieme all'utente.
  Verifica: schermata principale pulita (poche scritte), aspetto più moderno/coeso; nessuna
  regressione ai pulsanti/lingua/audio.

---

## Ordine proposto per Sonnet (dal più netto/rapido al più aperto/di design)
1. ~~**Gruppo A**~~ ✅ FATTO 2026-07-17, committato (`2db4ecf`).
2. ~~**Gruppo D**~~ ✅ FATTO 2026-07-17, committato (`bf7c206`).
3. ~~**Gruppo C**~~ ✅ FATTO 2026-07-17, committato (`8c5c938`).
4. ~~**Gruppo B**~~ ✅ FATTO 2026-07-17, committato (`1b97655`).
5. ~~**Gruppo E**~~ ✅ FATTO 2026-07-17 (terremoto: stalattiti + scosse con shake, usa `CEIL_Y`).
6. ~~**Gruppo F**~~ ✅ FATTO 2026-07-17 — F.1 (Corsa a tempo, Game Over se scade) + F.2a (timer Assedio, stesso widget). F.2b (arena) resta da pianificare con Opus. NON ancora committato.
7. **Gruppo G** — **PROSSIMO** (G.1 chiarire/rendere evidenti le 3 carte melee; G.2 aggiungere il solo "Getto Rapido") — **decisioni già prese** (vedi i punti), si può fare.
8. **Gruppo H** (menu) — **Sonnet propone una bozza e si itera con l'utente** (deciso).

Ciclo fisso per ogni punto: implementa → `/code-review` e/o skill *verify* → collaudo DAL VIVO
(god-mode, screenshot/campionamento in preview) → riferisci in italiano semplice → chiedi se
committare. Numeri "sensati" (altezze/tempi/colori/portate) da TARARE col playtest dell'utente.
