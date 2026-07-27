# Earwax War — Piano esecutivo

> 📄 **A cosa serve questo file:** è la "lista di lavoro" dei blocchi in corso, usa e getta.
> Stato generale + backlog completo in **`HANDOFF.md`**; descrizione gioco in `README.md`.
> Regole fisse: **prima di ogni commit lanciare `python tools\controlla.py`** (59 controlli);
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
  - [ ] **ANIMAZIONI:** fuori da questo blocco (servirebbe AutoSprite = abbonamento). Per ora ferme.
    ⚠️ **L'utente le ha CHIESTE esplicitamente al playtest** («servirebbero degli spritesheet»):
    e' il prossimo passo naturale dell'estetica quando ci sara' l'abbonamento.
  - [ ] **TIMPANO SCOLLEGATO** 🧠 (segnalato dal playtest 2026-07-25): l'immagine AI e' bella ma
    "galleggia", non e' attaccata alle pareti del condotto. Proposta concordata: **cornice di carne**
    intorno allo sprite (disegnata via codice, tavolozza `GameGfx.CARNE`) **+ vasi che continuano**
    dal timpano verso il terreno/soffitto, cosi' sembra incastonato. → PROSSIMO LAVORO.

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

# BLOCCO C — ASSEDIO: la tattica migliore contraddice l'obiettivo 🧠
**Scoperto dal playtest dell'utente (2026-07-22):** «per sopravvivere conviene andare in cima a un
cumulo di cerume e resistere da lì». E' una strategia EMERGENTE, di per se' un buon segno — ma
attenzione a cosa implica: **il gioco chiede di PULIRE il cerume, e la mossa vincente è
CONSERVARNE un cumulo per starci sopra.** Se resta l'unica via che funziona, l'Assedio diventa
"sali e aspetta": si risolve una volta e poi si ripete identico.

Tre strade (da decidere con l'utente, la 2 è la proposta):
1. **Punire il camping**: i moscerini volano gia' — se puntassero chi sta in alto, il cumulo
   smetterebbe di essere un rifugio sicuro.
2. ⭐ **Farlo consumare**: il cumulo si sgretola mentre lo si usa come piattaforma. Il giocatore
   guadagna TEMPO, non sicurezza; la posizione diventa una RISORSA che si spende. Mantiene valida
   la scoperta dell'utente ma le mette un prezzo, e soprattutto **riallinea la tattica
   all'obiettivo** invece di contraddirlo.
3. **Accettarla e progettarla**: l'Assedio diventa esplicitamente "difendi una posizione", con
   l'arena dedicata gia' in arretrato (F.2b).

NB: l'utente conferma che **l'Assedio funziona ed e' molto difficile** — quindi non e' rotto, e'
solo da bilanciare. Prima verifica dal vivo di questo tipo di livello.

---

# APERTI, in ordine di quanto sono pronti
- [ ] ⭐ **TIMPANO SCOLLEGATO** 🧠: vedi §B.2 — cornice di carne + vasi che continuano. **In corso.**
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
- [ ] **Revisione completa del codice** 🧠: da fare DOPO che l'estetica si è assestata, con i
  controlli a fare da rete. Conviene prima mappare `GameScene.js` (3300 righe) con un subagente.
- [ ] **Freeze sul PC allo Start Run**: aperto e depriorizzato (l'utente gioca dal telefono), ma da
  chiarire prima dello store.
