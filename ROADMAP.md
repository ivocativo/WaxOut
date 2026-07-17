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

## GRUPPO A — Fix rapidi, causa già individuata

- [ ] **A.1 — L'animazione del coton fioc va SEMPRE verso destra.**
  Causa (verificata): `showMeleeWeapon` (`GameScene.js` ~1875) fa ruotare l'arma con un tween
  d'angolo FISSO da `-1.1` a `0.7` (un arco orario) e applica solo `setFlipY(this._weaponFlip)` in
  base al facing. Il flip verticale non cambia il VERSO della rotazione, quindi l'arco "spazza"
  sempre verso destra anche quando guardi a sinistra. **Fix:** specchiare anche la rotazione col
  facing — quando `this.facing < 0`, invertire i due angoli del tween (es. da `+1.1` a `-0.7`) e/o
  usare `setFlipX` invece di `setFlipY`, così l'arco segue la direzione del colpo. Verifica: colpo
  a sinistra → l'arco spazza verso sinistra; a destra → verso destra.

- [ ] **A.2 — Dare alle Pulci balzi ancora più alti.**
  Causa: `fleaAI` (`GameScene.js` ~2077) usa `setVelocity(dir*speed*2.2, -380)`. **Fix:** alzare
  la componente verticale (es. `-460`/`-500`; apice ≈ v²/(2·1100) → -380=66px, -480=105px). Valuta
  se allungare di poco anche il cooldown `hopReadyAt` (ora 950ms) se diventano troppo insistenti.
  Verifica: la Pulce scavalca ostacoli più alti; picco velocità verticale = il nuovo valore.

- [ ] **A.3 — I proiettili dei nemici sono identici al cerume che raccogli.**
  Causa (verificata): `spitAt` (`GameScene.js` ~1437) crea la pallina sputata con `this.projectiles.
  create(sx, sy, 'wax_glob')` — la STESSA texture `wax_glob` usata sia dai pickup di cerume sulle
  pedane sia dalle palline lasciate dai nemici morti (F.1b). A colpo d'occhio "sparo nemico" e
  "bottino da raccogliere" si confondono. **Fix:** dare ai proiettili una texture PROPRIA,
  chiaramente "ostile" e diversa dal cerume dorato — es. una pallina generata a codice in `BootScene`
  (come le altre texture procedurali: cerca `PixelArt`/`generateTexture`), tono verde-acido/viola
  "velenoso" con un piccolo bordo scuro, così si legge come minaccia. Usarla in `spitAt` (e
  verificare che il boss usi la stessa via `spitAt`). Verifica: proiettili nemici visivamente
  distinti dai pickup; nessun errore. **Collegamento:** tema condiviso col round 1 (F.1b ha reso i
  nemici "sorgente di palline"): ora serve separare NETTAMENTE le palline-bottino da quelle-danno.

- [ ] **A.4 — Lo Scatto con danno va sbloccato solo DOPO lo scatto normale.**
  Causa (verificata): la carta `dashstrike` (`UpgradeScene.js` ~52) fa `apply: (s) => { s.dashStrike
  = true; if (!s.dash) s.dash = true; }` — cioè REGALA lo scatto base se non ce l'hai. E il filtro
  `avail` (`UpgradeScene.js` ~102) non ha un concetto di "prerequisito" per le carte normali (solo
  le EVOLUZIONI usano `needs`). **Fix (2 righe):** (1) aggiungere il supporto `needs` alle carte nel
  filtro `avail` — `if (u.needs && owned.indexOf(u.needs) === -1) return false;`; (2) su `dashstrike`
  mettere `needs: 'dash'` e TOGLIERE l'auto-regalo (`if (!s.dash)...`). Verifica: senza `dash` in
  `ownedAbilities`, la carta Scatto Offensivo NON esce; presa la carta Scatto, comincia a comparire.
  **Nota:** controllare che nessun'altra carta si appoggiasse a quell'auto-grant (non risulta: è
  l'unico caso).

---

## GRUPPO B — Soffitto + pedane alte  ⚠️ DA FARE INSIEME (sono in tensione)

_Questi due punti si CONDIZIONANO: rendere il soffitto "tangibile" (B.1) toglie spazio in alto, il_
_che peggiora B.2 (pedane alte irraggiungibili). Vanno decisi e implementati nello stesso turno._

- [ ] **B.1 — Il soffitto è troppo basso e intangibile.**
  Causa (verificata): l'ho aggiunto io nel round 1 (`GameScene.js` ~122) come `ch = round(gh*0.45)`
  = **81px** di fascia puramente ESTETICA (nessun collider; il bordo fisico del mondo è a y=0). Due
  problemi: (a) 81px = il 22% dell'altezza giocabile (360px) → "pende" troppo in basso; (b) è
  attraversabile (il giocatore/nemici possono stare sopra la fascia, fin su a y=0). **Fix:** (a)
  fascia più SOTTILE (es. `gh*0.28` ≈ 50px, si tara); (b) renderla TANGIBILE — spostare il bordo
  superiore del mondo fisico da y=0 al fondo della fascia: in `create` cambiare `this.physics.world.
  setBounds(0, 0, worldW, H - GROUND_H)` in modo che il top sia `CEIL_Y` (fondo del soffitto), così
  giocatore e nemici (che hanno `collideWorldBounds`) sbattono contro il soffitto invece di
  sparire nel vuoto sopra. ⚠️ Controllare i volanti: `dropFromCeiling` (~1406) li fa planare a
  `restY = Between(90,170)` → devono restare SOTTO `CEIL_Y` (con fascia ~50px sono già a posto, ma
  verificare). Verifica: il PG salta e sbatte la testa sul soffitto (non passa oltre); la fascia
  occupa meno spazio.

- [ ] **B.2 — La pedana più in alto a volte è irraggiungibile per il limite dello schermo in alto.**
  Causa (verificata): nel round 1 (E.3) ho clampato le pedane a `MAXUP` (≈117px, altezza di UN
  salto) rispetto alla superficie da cui le raggiungi, MA senza un limite MINIMO in alto. Concateno
  suolo→bassa→alta→scrigno: lo scrigno segreto può finire fino a ~9px dal bordo (`buildPlatforms`
  ~554, `clampAbove`). Per ATTERRARCI il PG (alto ~40px, `collideWorldBounds` col top del mondo a
  y=0) dovrebbe portare la testa sopra y=0 → impossibile, il bordo lo blocca. **Fix (insieme a
  B.1):** definire `CEIL_Y` una sola volta (fondo del soffitto tangibile di B.1) e nel clamp delle
  pedane imporre anche un TETTO: `platformY ≥ CEIL_Y + PLAYER_H + margine` (~40+16), così nessuna
  pedana (né lo scrigno) può salire tanto da non lasciare spazio a testa+salto sotto il soffitto.
  Verifica in preview SENZA doppio salto: la pedana/scrigno più in alto è sempre raggiungibile e il
  PG non sbatte la testa prima di arrivarci. **Collegamento:** dipende dal `CEIL_Y` fissato in B.1.

---

## GRUPPO C — Scatto (dash): feedback visivo

- [ ] **C.1 — Durante lo scatto la scia è poco visibile + serve più differenza tra scatto normale
  e scatto con danno.** Causa (verificata): `spawnDashGhost` (`GameScene.js` ~1688) crea fantasmi
  con `alpha 0.5`, throttle 40ms (→ pochi fantasmi in 160ms di scatto), che sfumano in 220ms; colori
  `0x8fe0ff` (azzurro, normale) vs `0xff6b3d` (arancio, danno). Lo scatto offensivo ha in più solo un
  anello una-tantum (`dashStrikeFx` ~1705). Troppo tenue e poco distinguibili. **Fix (estetico, da
  tarare):** (a) rendere la scia più marcata — throttle più basso (~20-25ms = più copie), `alpha`
  iniziale più alto (~0.75), magari 2-3 fantasmi persistenti; (b) DIFFERENZIARE forte i due scatti:
  normale = scia azzurra sobria, SENZA anello; con danno = scia arancione PIÙ densa/luminosa +
  l'anello iniziale + qualche particella/scintilla arancio lungo il tragitto (riusa `burst`), così
  "questo scatto fa male" è inequivocabile. Verifica: screenshot affiancati dei due scatti,
  differenza evidente; nessun calo di frame. **Collegamento:** stessa area di A.4 (lo scatto con
  danno ora è un vero sblocco a valle): il feedback deve rendere giustizia al fatto che è "avanzato".

---

## GRUPPO D — Boss

- [ ] **D.1 — Il boss non si stacca da terra quando salta (balzo+schiacciata di C.1).**
  Causa (VERIFICATA DAL VIVO, non solo letta): fisicamente il balzo c'è — misurato in preview, il
  boss si alza di **71px**, cioè ~il 100% della sua altezza (il boss è alto solo 72px). Il problema è
  che l'ARCO è troppo ORIZZONTALE: `bossAI` (`GameScene.js` ~2166) fa `setVelocity(dir*(speed*2+120),
  -430)` = ~188px/s orizzontali → **~147px in avanti** contro 71px in su, un arco piatto che si legge
  come "scivolata/carica in avanti" più che come un salto; e senza uno "stiramento" al decollo/ombra
  che si stacca, l'occhio non percepisce lo stacco. **Fix:** (a) arco più VERTICALE e drammatico —
  alzare la componente su (es. `-560`/`-620`) e ridurre/limitare quella orizzontale così ATTERRA
  SUL giocatore invece di superarlo (calcolare l'orizzontale in base alla distanza dal PG, non fissa);
  (b) VENDERE il salto: al decollo un piccolo "stretch" (scaleY su, scaleX giù, l'opposto
  dell'accovacciamento del windup) e un'OMBRA a terra che si rimpicciolisce mentre sale (cerchio
  scuro sotto il boss). Ricontrollare che `landed` (~2174) scatti ancora bene col nuovo arco.
  Verifica DAL VIVO in god-mode (campionare `boss.body.bottom` sui frame reali, come ho fatto io):
  apice ben visibile, il boss ATTERRA vicino al giocatore, l'onda d'urto (`bossSlamFx`) parte a
  terra. **Nota:** valutare anche se il raggio di innesco (ora 360px, `~2197`) è troppo corto — in
  un combattimento a distanza il boss potrebbe non arrivare mai a distanza-slam e non saltare mai:
  se serve, allargarlo o farlo avvicinare prima di caricare.

---

## GRUPPO E — Terremoto (mutatore)

- [ ] **E.1 — La scossa si deve PERCEPIRE + i blocchi che cadono devono essere già VISIBILI
  attaccati al soffitto, e a ogni scossa ne cade qualcuno.** Oggi (round 1, E.1) il "Terremoto"
  (`startWaxCollapseEvent`/`spawnCollapseChunk`, `GameScene.js` ~670-703) fa comparire chunk di
  cerume dal nulla in cima con un telegrafo lampeggiante, senza scossa percepita. **Cosa vuole
  l'utente (ridisegno):**
  - **(a) Cerume già appeso al soffitto.** All'inizio di un livello col mutatore `quake`, PIAZZARE
    una fila di "stalattiti" di cerume attaccate al soffitto (sprite `wax_a/b/c/d` tintati come il
    cerume duro, ancorati a `CEIL_Y` di B.1 — origin in alto, pendono giù), in punti sparsi. Sono
    scenografia INERTE finché non arriva la scossa.
  - **(b) Scossa percepibile a impulsi.** Sostituire la cadenza fissa dei chunk con vere "SCOSSE"
    periodiche (es. ogni ~2.5-3.5s): a ogni scossa → `cameras.main.shake` deciso (es. 400ms,
    0.012-0.016) + un rombo (`Sfx`, valutare cosa c'è) + STACCARE qualcuno dei blocchi appesi (quelli
    più vicini al giocatore o a caso), che da lì cadono col sistema già esistente (gravità, danno da
    contatto via overlap `collapseChunks`↔player già presente, `collapseImpact` sul cerume). Quando
    le stalattiti finiscono, o si ripopolano piano, o la scossa smette.
  - **Nota:** riusare il più possibile l'infrastruttura `collapseChunks` esistente (overlap/danno/
    impatto già fatti nel round 1); il lavoro nuovo è (1) le stalattiti pre-appese e (2) il ritmo a
    scosse con lo shake. **Collegamento:** dipende da `CEIL_Y` (B.1) per l'ancoraggio al soffitto —
    ha senso farlo DOPO il Gruppo B.
  Verifica: forzando il mutatore quake, si vedono blocchi appesi al soffitto; a ogni scossa lo
  schermo trema e cade qualche blocco (che ferisce il PG e apre varchi); nessun errore.

---

## GRUPPO F — Modalità a tempo (Corsa + Assedio)

- [ ] **F.1 — Corsa contro il tempo: manca un timer ben visibile che lampeggi negli ultimi
  secondi.** Causa (verificata): la modalità `rush` OGGI NON È A TEMPO — in `create` (`GameScene.js`
  ~336-344) è solo "attraversa fino al timpano senza dover pulire" (`cleanGoal=0`), niente
  cronometro. **Fix:** (a) renderla davvero una corsa a tempo — dare un limite (es. `rushEndAt =
  now + tempo_in_base_alla_lunghezza`) e se scade prima del timpano → fallimento (o penalità, da
  decidere); (b) TIMER ben visibile in HUD, grande e centrato in alto, che negli ultimi ~5s
  LAMPEGGIA (rosso/scala). **Collegamento con F.2:** conviene creare UN widget-timer riutilizzabile
  (grande, centrato, con modalità "lampeggio finale") e usarlo sia per la Corsa sia per l'Assedio,
  invece dell'attuale `siegeText` minuscolo. Verifica: in Corsa il timer scorre, lampeggia negli
  ultimi secondi, e scadere prima del timpano ha una conseguenza chiara.

- [ ] **F.2 — Assedio: timer poco visibile + la stessa mappa non è un granché.**
  Causa (verificata): il timer assedio è `siegeText` (`GameScene.js` ~369) — testo piccolo (20px)
  a y=96, poco leggibile; l'aggiornamento è in update ~2625. E l'assedio riusa lo stesso condotto
  orizzontale dei livelli normali. **Fix:** (a) timer → usare il widget grande/lampeggiante di F.1;
  (b) **DECISO con l'utente (2026-07-17): ARENA DEDICATA** — l'assedio "difendi la posizione a
  tempo" va in un'arena (mondo più stretto/chiuso, nemici da più lati, niente il lungo corridoio da
  attraversare) invece del solito livello. ⚠️ **È un lavoro di DESIGN grosso** (tocca `buildLevel`/
  `worldW`/spawn/camera): **prima di implementarlo va progettato a fondo con Opus** (forma
  dell'arena, da dove arrivano i nemici, come si vince) — NON improvvisare. La parte (a) timer si
  può fare subito; la (b) arena è un blocco a sé da pianificare. Verifica: timer assedio grande e
  chiaro; (arena) l'assedio si SENTE diverso da un livello normale.

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
1. **Gruppo A** (A.1 arco coton fioc, A.2 pulci, A.3 texture proiettili, A.4 gate scatto-danno) — 4 fix rapidi, cause certe.
2. **Gruppo D** (boss: arco del salto più verticale + stretch/ombra) — rapido, causa certa, verifica dal vivo.
3. **Gruppo C** (scia scatto più visibile + differenza normale/danno) — estetico, si sposa con A.4.
4. **Gruppo B** (soffitto tangibile+più sottile **+** pedane alte sotto il soffitto) — **INSIEME**, fissa `CEIL_Y`.
5. **Gruppo E** (terremoto: stalattiti + scosse con shake) — **dopo B** (usa `CEIL_Y`).
6. **Gruppo F** — F.1 (timer Corsa) + F.2 parte (a) (timer Assedio grande/lampeggiante, widget condiviso). ⚠️ **F.2 parte (b) ARENA assedio = blocco a sé, va pianificato con Opus prima** (non farlo qui).
7. **Gruppo G** (G.1 chiarire/rendere evidenti le 3 carte melee; G.2 aggiungere il solo "Getto Rapido") — **decisioni già prese** (vedi i punti), si può fare.
8. **Gruppo H** (menu) — **Sonnet propone una bozza e si itera con l'utente** (deciso).

Ciclo fisso per ogni punto: implementa → `/code-review` e/o skill *verify* → collaudo DAL VIVO
(god-mode, screenshot/campionamento in preview) → riferisci in italiano semplice → chiedi se
committare. Numeri "sensati" (altezze/tempi/colori/portate) da TARARE col playtest dell'utente.
