# Earwax War — Piano esecutivo

> 📄 **A cosa serve questo file:** è la "lista di lavoro" dei blocchi in corso, usa e getta.
> Stato generale + backlog completo in **`HANDOFF.md`**; descrizione gioco in `README.md`.
> Regole fisse: **prima di ogni commit lanciare `python tools\controlla.py`** (73 controlli);
> god-mode nei test MA anche ≥1 prova SENZA; i18n EN+IT per ogni stringa nuova (niente accenti,
> il font pixel non li rende); commit solo su richiesta dell'utente.

_Preparato 2026-07-22 da Opus. I blocchi A e B nascono dalla ricerca sulle best practice del genere_
_(sintesi e fonti in `HANDOFF.md` §Principi di design) e dalla richiesta dell'utente._

**Chi esegue cosa.** 🤖 = adatto a Sonnet (meccanico, specificato fino in fondo).
🧠 = serve Opus (decisione di design, giudizio estetico, o taratura da fare guardando il gioco).

---

# BLOCCO A — Dare un FINALE alla run + scelta del percorso

**Perché.** Oggi `UpgradeScene` fa `GameState.level += 1` all'infinito: **non esiste la vittoria**,
una partita può finire solo con la morte. Le fonti sono concordi che una run ha bisogno di una
conclusione, e senza vittoria non è possibile la meccanica di ritenzione più forte del genere (la
difficoltà crescente che il giocatore sceglie DOPO aver vinto). È il buco più grande del gioco.
Inoltre il giocatore non sceglie mai il percorso: il tipo di livello è deciso dal numero
(`levelNum % 5`), quindi manca del tutto la decisione rischio/ricompensa.

## A.1 — Traguardo e vittoria ✅ FATTO (2026-07-22, commit `db4c1eb`, eseguito da Sonnet)
- [x] `CONFIG.RUN_LEVELS = 15` in `state.js`.
- [x] `UpgradeScene.choose()`: se il livello appena finito è `RUN_LEVELS`, incassa il cerume
  (`Meta.bankRun`) + segna la vittoria (nuovo `Meta.recordWin()`, nuovo campo `wins`) e va a
  `VictoryScene` invece che al livello successivo.
- [x] `src/scenes/VictoryScene.js`: titolo, riepilogo (livelli, cerume, tempo REALE trascorso via
  `GameState.runStartAt`), pulsanti Nuova run / Menu. Stesso stile di `MenuScene`.
- [x] i18n EN+IT.
- **Verificato:** `controlla.py` 56/56 (2 esecuzioni), screenshot della schermata di vittoria.

## A.2 — Boss finale ✅ FATTO (2026-07-22, commit `7eff829`, Opus)
- [x] Il livello `RUN_LEVELS` è il **GRAN TAPPO**: `cfg.hp ×1.7` (1734 contro 620 di un boss liv.5),
  `cfg.wax ×1.5`, banner d'ingresso dedicato. Flag `e.finale` da `this.isFinale = livello ===
  RUN_LEVELS`. I boss intermedi (5, 10) restano invariati a 2 fasi.
- [x] **Terza fase a 25% HP** (solo finale): "il condotto CROLLA" → frana di cerume dal soffitto
  (riusa `placeStalactites`/`scheduleQuakePulse` dell'evento `quake`, mai usata sui boss: nuova
  dimensione di pericolo verticale) + sputo a 5 vie + slam più ravvicinato. Banner a yPos 175 per
  non sovrapporsi a quello della furia nel raro doppio-scatto in un frame.
- [x] i18n EN+IT.
- **Verificato:** controllo [17] (hp ×1.7 esatto, crollo scatta, boss liv.5 escluso), 58/58;
  screenshot della terza fase (frana + banner).
- **Da tarare col playtest:** vita ×1.7 e soglia 25% sono stime; se il finale risulta troppo lungo
  o troppo facile si girano i numeri (moltiplicatore hp e soglia in `bossAI`/`spawnEnemy`).

### ✅ BLOCCO A COMPLETO (A.1 finale, A.3 porte, A.5 infezione, A.2 boss finale).

## A.3 — Scelta tra DUE PORTE ✅ FATTO (2026-07-22, commit `db4c1eb`, eseguito da Sonnet)
- [x] Nuova `src/scenes/DoorScene.js`, dopo la carta di potenziamento: due opzioni CONTRAPPOSTE —
  sicura (normale/corsa, nessun modificatore, ricompensa base) e rischiosa (assedio/sciame,
  modificatore forzato, cerume ×2). `bonanza` esclusa dal pool rischioso (raddoppierebbe il
  cerume in silenzio sopra al bonus gia' promesso, rendendo bugiarda l'anteprima).
- [x] La scelta scrive `GameState.prossimoLivello = { kind, mutator, waxMult }`; `GameScene.create`
  la legge e la CONSUMA (azzerata subito) invece di decidere da `levelNum % 5`. Assente (livello 1)
  → comportamento a sorteggio di sempre.
- [x] I livelli boss restano fissi: mai una porta.
- [x] i18n EN+IT.
- **Verificato:** `controlla.py` 56/56 (2 esecuzioni) — porta rispettata (caso rischioso e sicuro),
  DoorScene genera una scelta consumabile, UpgradeScene instrada bene boss/porta. Screenshot.
- ⚠️ Durante la verifica sono emersi e risolti **3 bug nel TEST** (non nel gioco), documentati nel
  commit e in cima a `tools/checks.js`: `this.scene.start()` chiamato da dentro un metodo di scena
  e' ACCODATO da Phaser (serve un tick prima che la nuova scena compaia); `prossimoLivello` va letto
  PRIMA del tick che avvia GameScene (la consuma come sua prima azione); `'GameScene'` mancava dalla
  lista di scene da fermare tra un sotto-test e l'altro.

## A.4 — Durata: ✅ CONFERMATA dal playtest (2026-07-22)
L'utente: «se si prendono i potenziamenti giusti, in 20 minuti al 15° ci si arriva». E' dentro la
finestra indicata dalle fonti (20-30 min, meno su telefono). **`RUN_LEVELS = 15` resta.**

## A.4b — Economia: ✅ MISURATA (2026-07-22), NON toccare i prezzi
L'utente: «partendo da zero è molto difficile arrivare al 15°». **Non è un difetto**: nel genere la
prima run non si vince, ci si arriva accumulando potenziamenti permanenti, ed è ciò che da' valore
al finale. Il rischio da escludere era che il divario si chiudesse troppo lentamente. Misurato:

| cerume disponibile in una run perfetta (15 livelli) | **7.840** |
|---|---|
| moltiplicatore globale alla raccolta (`CONFIG.WAX_GAIN`) | **×0,55** |
| → incassabile in una run perfetta | **~4.300** |
| costo di TUTTI gli `UNLOCKS` | 5.960 |
| costo di TUTTI i `BLUEPRINTS` | 2.450 |
| **costo totale** | **8.410** |

Comprare tutto costa ~2 run perfette, realisticamente **6-10 run normali** (nessuno pulisce il 100%
e le prime run muoiono presto). E' dentro la finestra 5-10 indicata dalle fonti → **l'economia e'
sana**. La difficolta' percepita non e' fame di risorse: e' abilita' e scalata dei nemici, cioe' la
forma giusta per il genere.
- ⚠️ **Se un domani la progressione risultasse lenta, la manopola e' `CONFIG.WAX_GAIN` (0,55)**:
  un solo numero che quasi dimezza gli incassi, molto meglio che ritoccare dodici prezzi.
- [ ] Rimisurare solo SE dopo il finale il playtest dice che si arriva alla vittoria troppo tardi.

## A.5 — Difficoltà crescente dopo la vittoria ✅ FATTO (2026-07-22, commit `f59befd`, Opus)
- [x] Grado **"Infezione"** 0–5, scelto nel menu (selettore `< Infezione: N >`, compare solo dopo
  la prima vittoria). Ogni grado: nemici hp +15% / velocità +7% / danno +10% e **cerume +20%**
  (l'incentivo). Fattori in `CONFIG.INFEZIONE`.
- [x] `GameScene.applyInfezione()` alza le manopole `mut*` esistenti, sopra a mutatore + porta.
  Aggiunto `mutEnemyDmg` (prima il danno nemici non aveva moltiplicatore).
- [x] `Meta.infezioneMax` (grado più alto superato) + `infezioneUnlocked()`; `recordWin(tier)`.
  `GameState.infezione` NON azzerato da `reset()` (resta su "Nuova run", si cambia solo dal menu).
- [x] HUD "Livello N - Infezione M" (M>0); `VictoryScene` mostra il grado sbloccato.
- **Verificato:** controllo [16] in `checks.js` (scaling esatto su livello boss + sblocco), 57/57;
  screenshot di menu/HUD/vittoria.
- **Da tarare col playtest:** i fattori per grado e il tetto a 5 sono una prima stima. Se 5 gradi
  risultano troppo pochi/troppi o la curva stona, si girano i numeri in `CONFIG.INFEZIONE`.

---

# BLOCCO B — Restyling NEMICI e TIMPANO

**Perché.** Sono gli ultimi elementi con la vecchia estetica: i nemici sono pixel-art generata da
codice (`PixelArt.fromGrid` in `BootScene`) e il timpano è uno sprite vecchio. Ora che sfondo,
terreno, soffitto, pedane e pozze parlano la stessa lingua, stonano loro.

## B.1 — Timpano ✅ FATTO (2026-07-24, commit `ae123a9`)
Prima provato via codice (`paintEardrum`) ma NON convinceva (troppo stilizzato) → **cambio
approccio deciso con l'utente: immagine AI**, stessa pipeline dei nemici. Timpano realistico
(manico del martello, cono di luce, vasi) su fondo magenta, scontornato e pixellizzato, caricato
come `eardrum` e piazzato in `buildGoal` (respira). Vittoria sempre su `goalX`. `paintEardrum`
rimosso. **Nato qui `tools/bake_sprite.ps1`** (scontorno+pixel per un singolo sprite AI, riusabile).

## B.2 — Nemici: immagini AI ✅ FATTO (2026-07-25, commit `4a135cd`)
Tutti e 7 (cerumino/crosta/gorgogliante/moscerino/pulce/saltatore/boss) sono immagini AI su fondo
magenta, stile **organico/parassitario leggermente gore** (scelto dall'utente, non cartoon).
- [x] Prompt scritti (nella cronologia sessione 25/07); l'utente ha generato.
- [x] `bake_sprite.ps1`: **chiave allargata** — prende magenta puro E rosa acceso (una generazione
  usava rosa) senza intaccare l'arte (creature ambra/verde/turchese, mai rosa).
- [x] `BootScene`: caricati da `assets/sprites/enemies/*_px.png`; rimosse le 5 texture procedurali.
- [x] `spawnEnemy`: tabella `ART` ricalcola scala/hitbox dalla texture (fisica ~invariata); corpo
  **ancorato in basso** (le immagini AI sono ritagliate, senza il bordo che centrava i vecchi
  sprite). Piedi a terra verificati (sprofondamento 0).
- [x] Sorgenti (16MB) in `art_sources/` FUORI da `assets/` (non entrano nell'APK); in `assets/` solo
  i baked (8-32KB).
- **Da fare ancora (rimandati):**
  - [ ] **Aureole élite:** ancora presenti (cerchio+tint). Ora che i nemici sono disegnati, si
    possono togliere e rendere Corazzato/Esplosivo/Split varianti di colore/dettaglio.
  - [x] **Dimensione nemici:** ✅ APPROVATA dal playtest (2026-07-25): «si distinguono bene, le
    dimensioni vanno bene». Non toccare la tabella `ART`.
  - [~] **ANIMAZIONI: SBLOCCATE senza AutoSprite (2026-07-27).** L'utente ha animato il **cerumino**
    con **Claude Design** (claude.ai/design) e consegnato uno sheet di 12 frame 256x256. Integrato:
    nuovo `tools/bake_sheet.py` (ritaglio UNICO su tutti i frame + ridimensiona + posterizza),
    sheet in `assets/spritesheets/enemies/`, caricato in `BootScene` **sulla stessa chiave**
    `enemy_blob` (chi non chiede l'animazione vede il frame 0: menu, tabella ART e hitbox non se ne
    accorgono), animazione globale `blob_crawl` a 8 fps, ogni nemico parte da un frame a caso.
    - [ ] Restano da animare gli altri 6 nemici, stessa strada.
  - [x] ✅ **TIMPANO SCOLLEGATO — FATTO 2026-07-27 (`918725d`).** Segnalato dal playtest: l'immagine
    "galleggiava". Nuova `GameGfx.paintEardrumSocket` dietro allo sprite: massa che si addensa verso
    il centro, labbro di tessuto + **ombra di contatto** attaccata al bordo (e' quella che fa leggere
    "incastonato"), vasi che proseguono nella carne. Timpano spostato a `goalX-10` perche' a
    `goalX+40` il suo lato destro finiva fuori schermo proprio al momento della vittoria.

---

# BLOCCO D — Playtest round 3: bug, difficolta', chiarezza ✅ FATTO (2026-07-25/27)

Nasce dalle segnalazioni dell'utente dopo il playtest del Blocco A + nemici nuovi. Ordine deciso
dall'utente: «prima elimina i bug poi procediamo subito con la difficolta'».

## D.1 — Bug ✅ (`8c397ae`)
- [x] **Nemici che cadevano sotto il suolo a fine livello** (visibile al timpano): a `levelComplete`
  e `gameOver` la scena si ferma ma la gravita' no → nuovo `freezeEnemies()` che spegne
  `body.moves` su tutti i nemici.
- [x] **Pozze scivolose nei punti angolosi**: `addSlimeZone` ora cerca un tratto abbastanza piatto
  (`terrainFlatEnough`, fino a 8 tentativi) e se non lo trova NON piazza la pozza.

## D.2 — Difficolta' ✅ (`59dab7e`)
Diagnosi: i frame di invulnerabilita' **esistevano gia'** (0,9s + rinculo), quindi non era
"stunlock" ma **DENSITA'**. Tre interventi insieme:
- [x] **Meno nemici contemporanei** in tutti i tipi (normale max 5, sciame/assedio max 7) e
  comparse piu' diradate.
- [x] **SALTO SUI NEMICI (alla Mario)** — richiesto dall'utente: cadendo addosso a un nemico si
  rimbalza, si ricarica il salto e gli si fanno danni (×1,1). ⚠️ Trappola pagata: l'aggancio al
  terreno (heightmap-snap) "risucchia" il PG a terra ATTRAVERSANDO il nemico prima del controllo di
  contatto → la rilevazione dello stomp va fatta **PRIMA dello snap**, con una finestra di 48px
  sopra al nemico (altrimenti i nemici bassi non si calpestano mai).
- [x] **Mercy-invuln piu' lunga** dopo un colpo (0,9 → 1,2s) e 400ms di grazia dopo il rimbalzo
  (a 220ms il nemico tornava addosso e il rimbalzo costava vita).

## D.3 — Corsa a tempo ✅ (`2ff0337`)
- [x] **Countdown 3-2-1-VIA** a inizio livello (prima partiva di soppiatto).
- [x] **Piu' tempo** (il cronometro parte dopo il countdown) e **molto meno frequente**
  (probabilita' 0,28 → 0,18; lato porta sicura resta ~1 volta su 4).

## D.4 — Crash musica sul telefono ✅ (`5527c96`)
- [x] Causa vera: **accumulo di nodi audio** (oscillatori/filtri mai scollegati). Ora ogni voce si
  autodistrugge (`cleanupOnEnd` su `onended`). Misurato: ~96% dei nodi liberati contro ~0% prima.
- [x] Su richiesta dell'utente: **musica sospesa a schermo spento** (`visibilitychange`) e ripresa
  al ritorno; lo scheduler non lavora mentre e' sospesa.
- ℹ️ **L'utente vuole comunque RIFARE musica ED effetti** piu' avanti: non investire altro sul
  synth attuale, e' materiale di passaggio.

## D.5 — Varieta' e chiarezza della porta ✅ (`6a5dc76`, `d48b2f6`)
- [x] **4 nuovi modificatori** (7 → 11): CRISTALLO (nemici fragili che picchiano forte), FRENESIA
  (affollato ma redditizio), FURIA (pochi ma feroci), CERUME DI FERRO (durissimo ma prezioso).
- [x] **Nuova carta "Getto Potente"** (+5 danno a distanza): mancava del tutto un potenziamento del
  danno dell'arma a distanza.
- [x] **Porta piu' chiara**: ogni carta ora ha tre sezioni etichettate e separate — **OBIETTIVO**
  (tipo di livello + una frase che dice cosa fare), **REGOLA SPECIALE** (il modificatore, nel colore
  del suo banner in partita), **PREMIO**. Risolve la segnalazione «la distinzione tra modificatori e
  tipi di livello non e' chiara».

---

# BLOCCO C — ASSEDIO ✅ RISOLTO (2026-07-31, idea dell'utente)

**Il problema (playtest 2026-07-22):** «per sopravvivere conviene andare in cima a un cumulo di
cerume e resistere da lì». Strategia emergente, di per se' un buon segno — ma il gioco chiede di
PULIRE il cerume, e la mossa vincente era CONSERVARNE un cumulo per starci sopra. L'Assedio
rischiava di diventare "sali e aspetta": si risolve una volta e poi si ripete identico.

**La soluzione, proposta dall'utente: una QUOTA DI UCCISIONI.** Non si vince piu' sopravvivendo
allo scadere del cronometro, ma eliminando `10 + livello` nemici prima che scada. Il rifugio non
serve piu' a niente: fermo non uccidi, e non completi. Raggiunta la quota il livello finisce
SUBITO, anche se avanza tempo, cosi' essere aggressivi ti fa uscire prima.

⚠️ **La quota e' vincolata dal SOFFITTO di nemici che il gioco riesce a mandare**, non e' un
numero libero. Misurato con un giocatore perfetto (elimina ogni nemico appena compare, cosi' il
tetto a schermo non blocca mai le nuove comparse): al livello 13 ne arrivano ~52 in 56 secondi.
La quota sta sotto la meta' (23 su 56 = 41%). Se si avvicinasse al soffitto il gioco si
rovescerebbe: si finirebbe ad ASPETTARE che i nemici compaiano, l'opposto di un assedio. Il
controllo automatico [26] verifica proprio questo rapporto, cosi' se un domani si tocca la
frequenza delle comparse o la durata, il numero non resta indietro in silenzio.

**Tempo scaduto senza quota** (scelta dell'utente fra quattro possibilita'): non e' game over.
Prendi una botta pari al 20% della vita massima (`CONFIG.SIEGE_PENALITA`, una frazione e non un
numero fisso, cosi' resta significativa anche con tanti Cuori Extra) e ti tocca un supplementare
di 15s (`CONFIG.SIEGE_SUPPLEMENTARE`). Se continui a non farcela le botte si sommano e prima o
poi ci lasci la pelle: la regola si chiude da sola senza buttare una run al primo errore.

**Buttata la vecchia proposta** (il cumulo che si sgretola sotto i piedi): era una toppa che
rendeva il rifugio scomodo, invece di togliergli il senso. Quella dell'utente e' piu' pulita.

Resta aperta l'**arena dedicata** per l'Assedio (oggi riusa un livello normale col cronometro):
lavoro grosso, da pianificare a parte.

---

# BLOCCO E — Playtest round 4 ✅ CHIUSO (2026-07-29/30)

19 segnalazioni dell'utente, tutte chiuse in `238d6af` + `fc329ac`. I due bug piu' istruttivi,
annotati perche' la causa non era dove sembrava:
- **Proiettili che attraversavano le colline**: il pavimento e' una MAPPA DI ALTEZZE, non un corpo
  fisico; l'unico collider era il rettangolo piatto in fondo al mondo, quindi tutto cio' che
  stava sopra veniva attraversato. Ora un controllo per frame. Controllo automatico [20].
- **Cronometro che non si fermava in pausa**: le scadenze erano calcolate sull'orologio della
  SCENA (che in pausa si ferma) e confrontate in update() con quello del GIOCO (che non si
  ferma) — alla ripresa il conto saltava in avanti. Ora si conta il tempo RIMASTO, scalato di
  delta a ogni frame: immune per costruzione. Controllo automatico [21].

**Bilanciamento** (playtest: "ai livelli alti pulire e' estenuante"): tre manopole in `CONFIG`
invece di venti numeri sparsi — `DANNO_PG` 1,5 · `VITA_CERUME` 0,8 · `VITA_NEMICI` 0,8 — piu'
meno membrane dal livello 8 in su (fino al -40%). Piu' una cura di fine livello (`CURA_PICKUP`,
lo stesso valore di una pallina raccolta a terra).

**ARSENALE CHIUSO.** Decisione dell'utente: "si colpisce prevalentemente da lontano, quindi
variare le armi corpo a corpo ha poco senso". Si pubblica col kit unico (coton fioc +
spruzzino). Il meccanismo resta INTERO: per riaprirlo servono il pulsante in `MenuScene` e una
riga in `state.js` (`const scelta = 'fioc'`). Il controllo [19] ora verifica il contrario di
prima — che nessun salvataggio vecchio cambi il kit.

## E.bis — Coda del round 4 (2026-07-31)

- **Rimbalzo che non rimbalzava.** Col potenziamento RIMBALZO i colpi si piantavano lo stesso
  nelle colline. Il rimedio del giro prima invertiva la velocita' VERTICALE, ma un colpo sparato
  in piano ha vy≈0: invertire zero lo lasciava incollato al pendio a bruciare un rimbalzo per
  fotogramma, e dopo tre si spappolava comunque. Ora `rimbalzaSulTerreno()` misura la PENDENZA
  del profilo su 16px e specchia la velocita' attorno alla perpendicolare, poi spinge il colpo
  fuori dalla superficie (senza, rientra il frame dopo e ne consuma un altro). Vale anche per il
  soffitto. Controllo automatico [22].
- **Comparsa dei nemici** ("vorrei durasse di piu', deve capirsi che escono dal suolo"). Erano
  380ms in cui il nemico si limitava ad allungarsi — e per giunta partiva schiacciato **al centro
  della propria statura**, cioe' a mezz'aria: sembrava che si srotolasse per aria, non che
  uscisse da sotto. Ora sono due tempi, ~1 secondo (1,5 per i boss): prima il pavimento si gonfia
  in una bolla coi colori del terreno (`GameGfx.CARNE`, larga quanto la creatura) — telegrafo
  onesto che dice DOVE sta per uscire — poi il nemico spinge fuori **coi piedi appoggiati a
  terra** per tutta la salita, con sbuffi lungo il percorso. Resta inerte (`e.spawning`) per
  tutto il tempo, quindi allungarla non alza la difficolta': la abbassa.

---

# ANIMAZIONI DEI NEMICI ✅ COMPLETE (2026-07-28/30)

Tutti e otto animati con Claude Design + `tools/bake_sheet.py`. Non resta nessuna immagine ferma.

| nemico | animazione | note |
|---|---|---|
| cerumino | strisciata, 8 fps | il primo, ha aperto la strada |
| crosta | strisciata, 5 fps | piu' lenta apposta: e' secca e pesante |
| moscerino | battito d'ali, 16 fps | ⚠️ frame 1 e 5 avevano l'ala TRANCIATA per 58px sul bordo della cella: sostituiti coi frame 0 e 4, i pixel persi non si recuperano |
| pulce | passo, 9 fps | lo "stacco fra zampa e corpo" e' vero a piena risoluzione ma sparisce a 34px: NON rattoppato, vedi sotto |
| gorgogliante | strisciata, 6 fps | |
| Tappo di Cerume | passo, 6 fps | |
| Regina delle Croste | passo, 6 fps | |
| saltatore | SALTO a 3 spezzoni | unico senza ciclo: carica/balzo/atterraggio legati agli stati dell'IA |

**Due lezioni pagate, da ricordare per i prossimi disegni:**
1. **Margine nella cella.** Se la creatura tocca il bordo viene tranciata di netto e i pixel non
   tornano. E' successo alle ali del moscerino. Nel prompt va chiesto margine abbondante.
2. **Il prompt governa il DISEGNO, non il MONTAGGIO.** Claude Design ritaglia la creatura a pezzi
   e indovina dove sono le articolazioni: chiedere "metti un perno nel ginocchio" nel prompt
   dell'immagine non serve, va detto alla fase di montaggio — o si sceglie un'animazione che non
   richiede articolazioni (e' cosi' che si e' risolto il saltatore, con squash/stretch di tutto
   il corpo invece di un passo).
3. `tools/ripara_sheet.py` riempie i buchi all'attaccatura delle zampe. Provato su pulce e boss:
   alla dimensione di gioco NON migliora niente e impasta i vuoti veri fra le zampe. Resta li'
   per quando un difetto si vedra' davvero. ⚠️ Il colore va preso solo da pixel PIENI: dai
   semitrasparenti entra l'alone magenta dello scontorno e la toppa viene a chiazze viola.

---

# DA DECIDERE CON L'UTENTE (proposte pronte, NON implementate)

## M — MUSICA ✅ CHIUSA (2026-07-28). Quattro brani CC0 in `assets/musica/`, fonti tracciate in
## `assets/musica/FONTI.md`, crediti nel pannello "?" del menu.
## Quello che segue resta come promemoria di COME e' stata fatta.
**Come farlo, in concreto.**
- **Quanti brani:** 4 — menu, livello, boss/assedio, vittoria. Con meno si sente il vuoto, con
  piu' cresce il peso senza che il giocatore se ne accorga.
- **Formato e peso (il punto delicato):** OGG Vorbis, che il webview Android legge da solo.
  A 96 kbps un minuto pesa ~0,7 MB: quattro anelli da 75-90 secondi fanno **~4 MB**. L'app ora
  sta a ~10 MB, quindi si tornerebbe sui 14. ⚠️ I brani NON vanno incorporati come data URI
  (il base64 aggiunge un terzo): si caricano come file, e la musica non funzionera' col doppio
  clic da PC — sul telefono e nell'app si'.
- **Dove prenderli, in ordine di comodita':**
  1. ✅ **CC0 — SCELTA DALL'UTENTE (2026-07-27)**: nessun obbligo, nemmeno i crediti. Dove
     ascoltare (verificato il 27/07/2026):
     - **opengameart.org/content/cc0-music-0** — la raccolta piu' grossa (oltre mille brani), si
       ascoltano nella pagina. Chiptune, orchestrale, ambient, temi di battaglia.
     - **pixabay.com/music/search/cc0/** — lettore comodo, catalogo piu' "moderno".
     - **kenney.nl/assets** — tutto CC0, soprattutto effetti ma con qualche pacchetto musicale.
     - **itch.io**, sezione risorse per giochi, filtro musica + CC0.
     - ⚠️ **freepd.com NON esiste piu'** (chiuso nel 2025 dopo 17 anni): era la prima fonte che
       veniva in mente, non mandarci nessuno.
  2. **CC-BY** (gratis ma vanno citati): Kevin MacLeod / filmmusic.io, catalogo enorme.
     Richiede una schermata CREDITI, che oggi non c'e' — mezz'ora di lavoro.
  3. **A pagamento non esclusivo** (WOW Sound, Epidemic): costa, ma si trova il tono giusto.
  4. **Generata con l'IA** (tipo Suno): tentante visto come e' andata con Claude Design per gli
     sprite, ma ⚠️ le condizioni d'uso commerciale cambiano da servizio a servizio e da piano a
     piano — da verificare PRIMA di affezionarsi a un brano.
- **Cosa serve nel codice** (lavoro mio, ~2 ore): `BootScene` carica i 4 file; `Sfx.setMusic()`
  smette di suonare il synth e fa partire il brano con dissolvenza e anello; restano com'erano
  il pulsante musica, il volume e la sospensione a schermo spento. Gli EFFETTI non si toccano.
- **Cosa serve da te:** scegliere i brani. Io non posso ascoltarli, quindi il gusto e' tuo.
  Proposta operativa: preparo io l'impianto e una cartella `assets/musica/` con quattro nomi
  fissi; tu ci lasci dentro i quattro file e funziona senza altro lavoro.

## E — EASTER EGG PROPOSTI (l'utente decide quali, NON implementare prima)
In ordine di rapporto tra risata e lavoro:
1. **Il coton fioc conficcato** 🤖 — ogni tanto, un coton fioc gigante abbandonato nella parete.
   Colpendolo 10 volte si stacca e da' un bonus danno temporaneo. E' anche una battuta VERA:
   i coton fioc nell'orecchio non si usano. Poco lavoro, molto a tema.
2. **Il cerumino domestico** 🤖 — raramente un cerumino non ti attacca: ti segue per tutto il
   livello come un cagnolino e a fine livello ti lascia il suo cerume. Riusa l'IA della bolla
   aiutante, cambia solo chi la esegue.
3. **Il timpano dorato** 🤖 — una run ogni ~20, il timpano e' d'oro: arrivarci vale un premio
   grosso e un cartello dedicato. Due righe di codice, e da' qualcosa da raccontare.
4. **Livello 13** 🤖 — al tredicesimo livello tutto e' un filo piu' scuro e i nemici sono tutti
   "cristallo" (fragilissimi ma micidiali), con un cartello scaramantico. Riusa un modificatore
   che c'e' gia'.
5. **Lo scrigno dietro al timpano** 🧠 — una pedana nascosta sopra al traguardo, raggiungibile
   solo con doppio salto + scatto. Premia chi esplora invece di correre. Va disegnata a mano
   nella generazione del livello: piu' lavoro.
6. **Il moscerino albino** 🤖 — un moscerino bianco che non attacca e scappa: seguirlo porta a
   un gruzzolo nascosto. Riusa quasi tutto il Fuggitivo Dorato.
7. **Il cartello del dottore** 🤖 — un cartellino minuscolo sulla parete: "Non infilare i coton
   fioc nelle orecchie". Costo quasi zero, e fa sorridere chi lo nota.
8. **Codice Konami** 🤖 — da tastiera, cambia il cappello del personaggio. Vale solo su PC.

## N — NOME DELL'APP: ✅ SCELTO E APPLICATO — **WAXOUT** (scelto 2026-07-27, applicato 2026-07-31)
Perche' si cambiava: "Earwax War" non e' occupato, ma **"Earwax" da solo e' il party game di
Jackbox** e su Play c'e' gia' **Earwax Clinic** — cercando "earwax game" si finisce su di loro.
Verificato che **Waxout** non risulta occupato da nessun gioco o app. Limite dello store: 30
caratteri, niente emoji, niente maiuscole tutte tranne il marchio.
- [x] **NOME APPLICATO (2026-07-31).** `capacitor.config.json` (appName "Waxout" e appId
  **`io.github.ivocativo.waxout`** — ⚠️ dopo la pubblicazione NON si puo' piu' cambiare),
  `package.json`, `index.html`, il titolo nel menu, il nome dell'APK. Cartella e repository
  restano `earwaxwar`: cambiarli romperebbe percorsi e cronologia senza portare niente al
  giocatore.
  ⚠️ **NON toccate le chiavi di salvataggio** (`earwaxwar.meta.v1`, `.lang`, `.vol`,
  `.music`, `.taratura.v1`): sono le etichette sotto cui il telefono tiene banca, sblocchi e
  record. Rinominarle avrebbe azzerato i progressi di chi gia' gioca, in cambio di niente.
  ⚠️ Cambiando l'appId il telefono considera Waxout un'app DIVERSA da Earwax War: dopo
  l'aggiornamento ne convivono due, e la vecchia va disinstallata a mano.
- [x] **Sottotitolo risolto senza scrivere niente di nuovo:** il menu ora fa "WAXOUT" grande e
  "The Earwax War" / "La Guerra del Cerume" sotto — il vecchio nome diventa la spiegazione del
  nuovo, e la parola chiave "earwax" resta.
- [x] **ICONA (2026-07-31).** Immagine generata dall'utente (primo piano del personaggio col
  cerume che cola dal casco), lavorata da `tools/fai_icone.py` in tutte le misure. Vedi
  `HANDOFF.md` per la zona sicura, che e' il punto dove si sbaglia.

---

# APERTI, in ordine di quanto sono pronti
- [ ] **CREDITI** (prima dello store) 🤖: tutti e quattro i brani sono **CC0 verificati** sulla
  scheda (vedi `assets/musica/FONTI.md`), quindi nessun obbligo. Ma l'autore del brano del MENU
  (R0B B3RY) CHIEDE esplicitamente di essere citato: «By using this file you are committed to
  mention "Rob Bery" and "Rob Bery Art"». Costa una riga e toglie ogni dubbio. Proposta: una
  sezione CREDITI dentro il pannello "?" del menu (che c'e' gia'), con i quattro autori della
  musica + Phaser, e la stessa lista nella descrizione dello store.
- [ ] ⭐ **ARMI DEL PG — meta' fatta.** Scelte prese con l'utente il 2026-07-27: **kit completi**
  (ogni arma cambia insieme mischia e getto, perche' il tasto d'attacco e' uno solo e sceglie da
  se' in base alla distanza), **si sbloccano al negozio e si sceglie a inizio run**, **prima le
  meccaniche poi l'arte** (per non disegnare armi che poi si buttano).
  - [x] **MECCANICHE FATTE**: `window.ARMI` in `state.js` (5 kit), `ArmiScene` (Arsenale: sblocca +
    equipaggia), terzo pulsante nel menu, `Meta.arma`/`armaPosseduta`/`setArma`, mischia e getto
    che leggono il kit, controllo automatico [19]. La carta "Martello di Cerume" e' stata sostituita
    da **Testa Pesante** (+30% danno mischia): dare il martello con una carta non ha piu' senso ora
    che l'arma la scegli tu, e Testa Pesante funziona con qualunque kit.
  - [x] **ARTE FATTA (2026-07-31)**: le due armi che restano dopo la chiusura dell'arsenale sono
    disegnate. `assets/sprites/weapons/swab_px.png` (80x12) e `sprayer_px.png` (39x24), stessa
    pipeline dei nemici (fondo magenta -> `tools/bake_sprite.ps1`), caricate in `BootScene` e
    descritte nella tabella `WEAPONS` di `GameScene` (perno = dove sta la mano, scala 0,5 perche'
    sono baked a doppia risoluzione). Il coton fioc ha UNA punta sola: si impugna dal lato nudo.
    Resta generato a codice solo `PA.hammer`, per il kit dormiente dell'arsenale.
    **Con questo, nel gioco non c'e' piu' nessuna texture disegnata a codice.**
  - [ ] **TARATURA**: i numeri sono una prima stima (profilo misurato sotto). Da giudicare in mano.

| kit | mischia | getto |
|---|---|---|
| Coton Fioc (base) | 72 dps, portata 50 | 47 dps, 493px |
| Martello, 240 | 73 dps ma **38 a botta**, portata 64 e arco largo | 26 dps (dimezzato) |
| Pinzette, 300 | **91 dps** ma portata 36 (devi stare incollato) | 43 dps |
| Idropulsore, 380 | 43 dps (fiacco) | 55 dps, **35 a colpo, perfora 3**, 551px |
| Pompa a Vuoto, 460 | 67 dps | 65 dps ma **solo 220px** + calamita inclusa |
- [x] ✅ **TIMPANO SCOLLEGATO**: fatto 2026-07-27 (`918725d`) — vedi §B.2.
- [ ] **Sfoltire l'APK** 🤖: ~8 MB su 22 sono materiale di lavorazione impacchettato per sbaglio.
  Dettaglio in `HANDOFF.md` §APK da SFOLTIRE. Il primo pezzo (togliere il caricamento delle
  protuberanze disattivate) vale 1,8 MB e risparmia memoria sul telefono.
- [ ] **Protuberanze** da rigenerare in stile e riattivare (il meccanismo è intatto in
  `GameGfx.drawProtuberances`, basta rimettere la chiamata in `buildLevel`).
- [ ] **Crouch**: 36 frame già forniti, servono 2 risposte dell'utente (vedi `HANDOFF.md`
  §Asset nuovi): è un ciclo o una posa tenuta? sostituisce lo schiacciamento attuale?
- [ ] **Tarature col playtest** e verifica dal vivo dell'**Assedio**, mai giocato davvero. In attesa
  del **round 4** dell'utente per giudicare i numeri del Blocco D (densita', forza del salto sui
  nemici, durata della Corsa). ⚠️ **L'utente non ha ancora MAI vinto una run** → la terza fase del
  boss finale (crollo) e' verificata solo dai controlli automatici, mai vista dal vivo.
- [ ] **Altri set di sfondo**: procedura pronta, basta che l'utente dica "voglio altri sfondi".

---

# BLOCCO F — Playtest round 5 (2026-08-02) 🚧 IN CORSO

Diciannove segnalazioni dell'utente dopo aver giocato l'APK di `3a1a44b`. Raggruppate per
argomento, non per ordine di arrivo: dentro un gruppo si tocca lo stesso codice, e farle insieme
costa molto meno che una alla volta.

## F.A — ARMI E PROIETTILI (si vede a ogni singolo colpo → priorita' massima)
- [x] **A.1 FATTO. I proiettili partono dalla BOCCA dell'arma.** Nuovo `boccaArma()`: prende
  l'offset della punta misurato sul disegno (`WEAPONS[].bocca`), lo scala, lo specchia e lo
  RUOTA come l'arma, cosi' la bocca resta la bocca in tutte e otto le direzioni di mira.
  Verificato dal controllo [28]: scarto 0,0px fra pallina e ugello, ugello 34px davanti al corpo.
  ~~ Oggi `spawnPellet` li fa nascere
  a `player.x + nx*18`, cioe' su un cerchietto attorno al CORPO, mentre l'arma e' disegnata in
  mano da tutt'altra parte: si vede il colpo uscire dalla pancia. Va calcolata la punta dell'arma
  dalla sua posizione+rotazione reali e fatta nascere li' anche la vampata.
- [x] **A.2 FATTO, e le cause erano DUE.** (1) `positionWeapon` usava `this.facing` per la mano
  ma teneva l'angolo congelato allo sparo: girandosi nei decimi in cui l'arma e' ancora in mano,
  la mano si specchiava e il puntamento no. Ora il verso si rilegge ogni fotogramma e l'arma
  segue il corpo (angolo specchiato con pi-greco meno theta: stessa altezza, direzione
  ribaltata). (2) Il verso si deduceva da `nx < 0`, ma mirando dritto in SU nx vale 0, quindi
  risultava sempre "destra" anche mirando da sinistra. Ora si prende da `facing`, sempre definito.
  ~~ Sospetto preciso da
  verificare: l'arma resta a schermo 220ms dopo lo sparo, e in quei 220ms `positionWeapon` la
  RIMETTE ogni fotogramma usando `this.facing` (dove guardi ORA) mentre la rotazione e' quella
  congelata al momento dello sparo. Ti giri mentre l'arma e' ancora visibile → la mano si
  specchia, il puntamento no.
- [x] **A.3 FATTO.** Scala 0,5 -> 0,72. E la permanenza a schermo non e' piu' fissa (220ms) ma
  segue la CADENZA dell'arma che hai in mano: vedi B.1/B.2, era la stessa causa.
  ~~ Oggi `scale: 0.5` e 240ms: si
  capisce a malapena cosa hai in mano. Ingrandire e allungare la permanenza.

## F.B — ANIMAZIONI ESISTENTI: scatti e colori
- [x] **B.1 e B.2 RISOLTI, ed erano LO STESSO difetto** (piu' un secondo difetto sotto).
  CAUSA 1, quella grossa: l'arma restava in mano 220ms FISSI, ma le armi sparano ogni 230-640ms.
  Nel buco fra un colpo e l'altro l'arma spariva, e con lei la condizione `mirando`, quindi la
  posa di mira ricadeva su idle/corsa e poi tornava. Ora la finestra e' cadenza + margine.
  CAUSA 2: la soglia "si sta muovendo" era un valore unico (10). Quando la velocita' ci balla
  intorno (rinculo, discesa, tasto sfiorato) si alternavano posa ferma e ciclo di corsa, e il
  ciclo RIPARTIVA ogni volta dal primo disegno. Ora c'e' l'isteresi: `inMovimento()` entra a 45
  ed esce a 10.
  Verificato anche che il foglio `hero_runaim` era gia' a posto, cosi' non lo si ri-tocca a
  vuoto: 6 fotogrammi = due passi, differenze fra fotogrammi consecutivi uniformi (15-20),
  ampiezza delle gambe 59-30-52-28. Il ciclo non c'entrava.
  (B.2 sta qui sopra: stessa causa di B.1.)
- [x] **B.3 FATTO, ma NON toccando i disegni.** Misurato: i due fogli accovacciati stanno a
  108-110 di luminosita' media contro 80-86 di tutti gli altri.
  DUE STRADE PROVATE E BUTTATE, da non rifare: (a) riscalare i valori perche' media e
  dispersione combacino con quelle degli altri fogli — la tavolozza ha SEI soli livelli per
  canale, l'arrotondamento finale manda a monte la correzione e il verde finiva sotto al rosso,
  cioe' personaggio VERDE; (b) abbinamento di istogrammi canale per canale — rosso e verde
  scendevano di un gradino e il blu no, personaggio GRIGIO (88,86,88). Con sei livelli i valori
  raggiungibili erano 91 o 71 contro un bersaglio di 82: non ci si arriva, punto.
  SOLUZIONE: `tintaPersonaggio()`, una velatura scura (0xc2c2c2 = 0,76, che e' esattamente il
  rapporto misurato) applicata a schermo solo nei fotogrammi in cui c'e' uno dei due fogli.
  Esatta, reversibile, nessun file d'arte toccato.

## F.C — ANIMAZIONI NUOVE ✅ FATTE (2026-08-03)
Materiale pronto in `assets/spritesheets/hero/da_modificare/` con `ISTRUZIONI.md` e i prompt.
Da li' in poi e' lavoro mio (cucitura del foglio sul rig, tavolozza a sei livelli, misura della
posizione della MANO fotogramma per fotogramma per infilarci l'arma, registrazione, controlli).

⚠️ **NON ritagliare i fotogrammi dal foglio gia' lavorato per farli ridisegnare.** Fatto al primo
tentativo e bocciato dall'utente: «veramente piccole e sgranate». Il foglio e' il PUNTO D'ARRIVO
della lavorazione — celle 84x84 con la tavolozza ridotta a sei livelli — quindi ingrandirlo
restituisce per forza un'immagine minuscola e sporca. Si torna sempre alla SORGENTE: il video, o
le pose a piena risoluzione in `assets/spritesheets/hero/`.
Nuovo **`tools/estrai_frame_video.py`**: ritrova nel video i fotogrammi di un'animazione gia' in
gioco e li riesporta grandi, scontornati su magenta. Confronta le SAGOME e non i colori (il
colore non sopravvive al ridimensionamento e alla posterizzazione, la forma si').
⚠️ **Secondo giro di correzioni, sempre segnalato dall'utente: "alcune parti magenta dentro il
personaggio".** Non era un ritaglio storto, era un problema senza soluzione per la strada che si
stava battendo: MISURATO, il fondo della registrazione sta a (30,30,32) e i contorni del
personaggio a (32,33,36), cioe' lo stesso colore. Nessuna soglia li separa (con la piu' stretta
provata si perdeva meta' del personaggio), e la macchia d'olio dai bordi non buca ma dilaga lungo
i contorni interni. La strada buona non distingue affatto contorno e fondo: ricostruisce la
SAGOMA (pezzo colorato piu' grande → tappa tutti i buchi → riapri solo quelli grandi → allarga di
2px per riprendersi il contorno esterno). Da ~1000 buchi a 6-18 per fotogramma, e i rimasti sono
i due veri. Dettaglio completo in `HANDOFF.md` §camminata accovacciata.
⚠️ Con la ricerca libera assegnava lo STESSO fotogramma a due celle diverse — una camminata ha
due mezzi passi che si somigliano molto. Risolto imponendo l'ordine crescente: non e' una
furbizia, e' un fatto sulla sorgente (un video non torna indietro), e scioglie l'ambiguita' da
solo. Per la camminata accovacciata sono i fotogrammi **74, 78, 81, 85, 88, 92, 95, 99** del
video (passo regolare: conferma che l'aggancio e' quello giusto).
- [x] **C.1 Sparo camminando accovacciato — FATTO (2026-08-03).** Foglio `hero_crouchaim_px.png`,
  8 fotogrammi, animazione `hero_crouchaim_a` a 12 al secondo — la STESSA andatura della
  camminata accovacciata, perche' sono gli stessi fotogrammi col braccio diverso: se
  divergessero, il passo cambierebbe velocita' nel momento in cui apri il fuoco.
  Verificato: casco fermo a y=28-29 su tutti e otto, statura 50-51 contro i 49-51 della
  camminata, e la posizione della MANO misurata in due modi indipendenti (punta della sagoma e
  colore del guanto) che concordano entro 3 pixel.
  ⚠️ Nel fotogramma 3 il generatore ha disegnato il braccio PIEGATO invece che teso: l'arma lo
  segue (giusto — sta nella mano disegnata) ma per un fotogramma su otto rientra. Si chiude
  rigenerando quel disegno, NON ritoccando il numero in `MANO.crouchaim`.
- [x] **C.2 Colpo corpo a corpo — FATTO (2026-08-03).** Foglio `hero_melee_px.png`, 4 pose
  (mazza caricata / braccio in alto / colpo in orizzontale / fine corsa in basso), animazione
  `hero_melee_a` che NON si ripete e la cui DURATA la decide la cadenza dell'arma (col coton
  fioc rapido, 165ms, una durata fissa sarebbe ancora a meta' quando parte il colpo dopo).
  ⚠️ L'arma non e' piu' mossa da un tween per conto suo: mano e inclinazione vengono dal
  FOTOGRAMMA corrente (`MANO.mischia` + `MISCHIA_ANGOLO`, presi dagli angoli spalla-mano
  misurati sui disegni), quindi non possono sfasarsi rispetto al corpo. Prima si vedeva un
  bastoncino che ruotava da solo davanti a un personaggio immobile.
  Il colpo ha la PRECEDENZA sulle altre animazioni: muoversi a meta' bastonata non rimette la
  camminata. Parte solo a terra e non accovacciato (in aria resta il salto).
  Controllo automatico [32].

## F.D — NEMICI
- [x] **D.1 FATTO.** Causa: i nemici inseguono la X del giocatore, e quando gli stai sopra la
  differenza oscilla attorno allo zero, quindi il segno si ribalta a ogni fotogramma. Nuovo
  `versoIlGiocatore()` con ZONA MORTA di 16px che restituisce 0 = "sto fermo". E' uno stato
  STABILE: da fermo il nemico non si sposta, quindi non puo' rientrare in oscillazione da solo.
  Controllo [30] (conta le inversioni di verso: devono essere zero).
- [x] **D.2 FATTO.** Aggiunto a `bossAI` il cancello `inQuadro` che il gorgogliante aveva da
  sempre e al boss mancava. Cammina lo stesso (deve avvicinarsi) ma non sputa, non telegrafa e
  non evoca sgherri. In piu' il conto alla rovescia dello sputo viene RIMANDATO mentre e' fuori
  inquadratura: se no il boss entrava in scena scaricando in un colpo solo tutti gli sputi che
  si era risparmiato.
- [x] **D.3 RIFATTA.** La chiave non era la forma, era la PROFONDITA': prima tutto stava dietro
  alla creatura (4,4 contro l'8 dei nemici), quindi a schermo si vedeva un nemico che cresceva
  DAVANTI al pavimento. Ora ci sono due pezzi: il BUCO scuro che si allarga in ORIZZONTALE
  (un'apertura che si dilata si legge come un varco, una cupola che si alza no) e il LABBRO, il
  bordo sollevato, disegnato a profondita' 9,6 cioe' DAVANTI al nemico e dietro al giocatore
  (10). Finche' un pezzo di terreno copre la parte bassa, l'occhio conclude da solo che sta
  salendo da sotto. Piu' `schizzoDalBuco()`: pezzetti scagliati in alto a ventaglio che
  ricadono per gravita' — diverso dallo sbuffo tondo che c'era gia', e sono le due cose insieme
  a vendere il colpo (la nuvola dice "il pavimento si e' mosso", lo schizzo dice "da sotto").
- [x] **D.4 FATTO.** Il sospetto scritto qui sopra era giusto, e va oltre: la tinta NON POTEVA
  funzionare. `setTint` MOLTIPLICA, e l'arte dei nemici e' ambra (tanto rosso, pochissimo blu):
  moltiplicando non si puo' AGGIUNGERE un colore che nel disegno non c'e', quindi il corazzato
  "azzurro" usciva marroncino. Provata anche la somma in modalita' ADD: stesso limite, il colore
  aggiunto e' comunque proporzionale ai pixel di partenza.
  SOLUZIONE: `creaLavaggioElite()` — una COPIA della creatura riempita di tinta piatta
  (`setTintFill`) e stesa sopra al 55%. Il colore non dipende piu' da cosa c'era sotto: e'
  identico su tutti i tipi di nemico, ed e' saturo sul serio. `ELITE_LAVAGGIO` sono i colori che
  il giocatore vede davvero; `ELITE_TINT` resta come sfumatura di fondo.

## F.E — LEGGIBILITA' E ASSEDIO
- [x] **E.1 FATTA, ed e' una REGOLA GENERALE del gioco: finche' c'e' un banner a schermo non
  entra nient'altro.** In `create` c'e' ora `avvioAl`: per 1,2s (1,9 se c'e' anche il banner
  del modificatore, 2,6 nella corsa dove l'annuncio e' il 3-2-1) non nasce nessun nemico, i
  cronometri non partono e il contatore non compare. L'attesa NON e' la durata intera del
  banner (3,1s: il livello sembrerebbe rotto), e' il tempo perche' finisca di entrare e si
  legga. Controllo [29].
  In assedio oggi arrivano insieme due banner, il contatore, il cronometro e i nemici. Il
  giocatore deve avere un secondo per capire cosa deve fare.
- [x] **E.2 FATTO.** `updateHud()` chiamata PRIMA di `levelComplete()`: da li' in poi `locked` fa
  uscire subito da update() e l'interfaccia non si ridisegnerebbe mai piu'.
- [x] **E.3 FATTO, e su OGNI livello, non solo il primo:** il banner d'apertura ora dice
  "PULISCI L'80% DEL CONDOTTO", con la percentuale LETTA da `cleanGoal` invece che scritta a
  mano (se un domani si tara la soglia, il cartello si aggiorna da solo). Colta l'occasione
  anche per l'assedio, che diceva ancora "Falli fuori tutti" invece di dire la quota.

## F.F — BILANCIAMENTO E CONTENUTI
- [x] **F.1 FATTI**, come tre manopole in `CONFIG` e non come venti numeri sparsi:
  `DANNO_NEMICI: 0.7`, `DURATA_CORSA: 0.9`, `WAX_GAIN` da 0,55 a 0,385.
  ⚠️ CONSEGUENZA DA TENERE D'OCCHIO sul −30% al cerume: la misura dell'economia (blocco A.4b)
  diceva ~6-10 run normali per comprare tutto; con questo taglio diventano ~9-14. Restano dentro
  la finestra sana per il genere, ma se la progressione risultasse lenta la manopola da rialzare
  e' `WAX_GAIN`, una sola, non i dodici prezzi.
  Nota sulla CORSA: il cronometro ora parte al VIA. Prima girava gia' durante il 3-2-1 e lo si
  compensava sommando 2,6s al totale; col respiro d'apertura (E.1) quella compensazione sarebbe
  diventata un regalo di 2,6s.
- [x] **F.2 FATTO senza togliere niente dal gioco.** Dentro la fascia di rarita' la pesca non e'
  piu' uniforme: ogni carta ha un peso (1 se non scritto). Le 6 carte di corpo a corpo hanno
  `peso: PESO_MISCHIA` = 0,5, quindi escono la meta' delle volte. Chi vuole giocare di mazza le
  trova ancora, e c'e' una manopola sola per rimetterle dov'erano.
- [x] **F.3 FATTO, e il "ritardo" non era un ritardo.** Spinta da 0,72 a 0,95 di un salto vero
  (cosi' si riesce anche a incatenare due nemici uno dopo l'altro).
  Ma la sensazione di ritardo veniva da altrove: uccidendo un nemico la fisica si CONGELA 85ms
  per dare peso al colpo, e nel rimbalzo quel congelamento arriva DOPO che la spinta verso l'alto
  e' gia' stata impostata — quindi si restava appesi in aria un decimo di secondo e solo dopo si
  schizzava su. Ora nel rimbalzo il congelamento e' 30ms: l'impatto si sente ancora, l'attesa no.
  Piu' la soglia di caduta abbassata da 60 a 45 (~15ms guadagnati in cima all'arco del salto;
  45 e' ancora al sicuro perche' da fermi la velocita' verticale non supera ~18 a 60 fotogrammi
  al secondo, ~37 a 30).
- [x] **F.4 FATTO.** Carta `radial` (rara, impilabile): ogni 2,6s parte una corona di palline
  tutt'attorno, +4 direzioni a ogni pesca. Danno ridotto al 55% APPOSTA — e' un'arma che lavora
  da sola mentre pensi ad altro, se picchiasse quanto il getto renderebbe inutile mirare.
  Nel gioco copre l'unico punto debole di un'arma che spara in una direzione sola: i nemici che
  ti si appiccicano ai fianchi mentre stai mirando altrove. Controllo [31].

---

# MAPPATURA DI GameScene.js ✅ FATTA (2026-08-02) — base per la revisione

**Perche' prima la mappa.** Rivedere un file da 4.144 righe senza sapere dov'e' il peso vuol
dire aprirlo dall'inizio e perdersi. Misurato invece che stimato:

| | |
|---|---|
| righe | 4.144 (2.834 di codice, **1.036 di commento = 25%**, 274 vuote) |
| funzioni | 130 |
| campi di stato sulla scena | 120, toccati 1.128 volte |
| chiamate a funzioni proprie | 319 |

**LA SCOPERTA: non e' la dimensione delle AREE il problema, sono due SINGOLE funzioni.**
Un'area da 561 righe divisa in 25 funzioni si legge benissimo. Ma `create()` (465) e `update()`
(460) sono due funzioni sole, e insieme fanno il **22% del file**. Gli 8 metodi da 60+ righe
valgono il 40% del totale.

Peso per area (righe): costruzione del livello 561 · combattimento 511 · IA nemici 483 · nascita
nemici 473 · **create() 465** · **update() 460** · personaggio/armi 330 · eventi e modificatori
281 · interfaccia e fine partita 272 · cerume 222 · utilita' 40.

**Le giunture** (perche' non si spezza con un taglio netto): `this.player` usato 141 volte,
`heroVisual` 36, `worldW` 30, `blocks` 29, `enemies` 27, `levelKind` 23, `locked` 20.
Verso gli altri moduli: `GameState` 74 usi, `CONFIG` 71, `I18n` 34, `Sfx` 33, `GameGfx` 18.

**`update()` e' la piu' pericolosa**: gira 60 volte al secondo e contiene almeno 18 blocchi
distinti (assedio, corsa, aggancio al terreno, salto sui nemici, accovacciamento, pose di mira,
movimento, attacco, IA di ogni nemico, proiettili, calamita, juice, macchie, arma in mano).
Quasi tutti i difetti degli ultimi giorni sono nati li' dentro.

## Ordine della revisione (da fare, 🧠)
- [x] **1. Spezzare `update()` ✅ FATTO (2026-08-02): da 460 righe a 27.** Nove blocchi con un
  nome — `aggiornaCronometri`, `controllaTraguardo`, `agganciaAlTerreno`, `aggiornaAmbiente`,
  `comandiDelGiocatore`, `animaPersonaggio`, `aggiornaNemici`, `aggiornaAbilita`,
  `chiudiFotogramma`. Nessuna riga di logica riscritta: i corpi sono stati SPOSTATI tali e quali
  (script in `scratchpad/spezza_update.py`).
  **Come si e' verificato che non e' cambiato niente**, oltre ai 68 controlli: confronto delle
  righe di codice prima/dopo. Sparite 2 righe, ed erano i due `return` che fermavano update() —
  ricompaiono entrambe come `return true`. Tutto il resto sono solo intestazioni, chiusure,
  cinque `const p` e le nove chiamate.
  ⚠️ Due errori fatti e corretti durante l'estrazione, da sapere se si rifa' lo stesso giro:
  (1) sbagliare di UNA riga il confine finale si mangia la parentesi di chiusura del metodo;
  (2) far assorbire a un blocco i commenti che lo precedono e' giusto (se no restano orfani a
  spiegare codice che non c'e' piu'), ma va messo un LIMITE al blocco precedente, se no si porta
  via anche la riga di chiamata di quello dopo.
  Restano solo `now` e `dt` come variabili locali di update(): `p` e `k` sono diventate morte
  e sono state tolte.
- [ ] **2. Spezzare `create()`**, stessa cura e meno urgenza: e' la porta d'ingresso al gioco.
- [ ] **3. Portare fuori la costruzione del livello**: 561 righe che non toccano ne' nemici ne'
  combattimento, il pezzo che si stacca piu' pulito (-14% al file).
- [ ] **4. Cercare il codice morto** lasciato da nove mesi di sostituzioni. Solo a controlli verdi.
- [ ] **5. Riesaminare i pezzi grossi**: `spawnEnemy` (237), `bossAI` (169), `damageEnemy` (98).

⚠️ **Si puo' fare senza rompere niente per due motivi, e solo per quelli:** i 68 controlli
automatici rieseguono il gioco vero, e il 25% del file e' commento con accanto il motivo di ogni
scelta strana (spesso col bug che l'ha causata). Se un domani questi due appoggi si indebolissero,
la revisione tornerebbe una scommessa.

---

- [ ] **Revisione completa del codice** 🧠: da fare DOPO che l'estetica si è assestata, con i
  controlli a fare da rete. Conviene prima mappare `GameScene.js` (3300 righe) con un subagente.
- [ ] **Freeze sul PC allo Start Run**: aperto e depriorizzato (l'utente gioca dal telefono), ma da
  chiarire prima dello store.
