# Earwax War — Piano esecutivo

> 📄 **A cosa serve questo file:** è la "lista di lavoro" dei blocchi in corso, usa e getta.
> Stato generale + backlog completo in **`HANDOFF.md`**; descrizione gioco in `README.md`.
> Regole fisse: **prima di ogni commit lanciare `python tools\controlla.py`** (51 controlli);
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

## A.1 — Traguardo e vittoria 🤖
- [ ] `CONFIG.RUN_LEVELS = 15` in `state.js` (numero da tarare dopo, vedi A.4).
- [ ] In `UpgradeScene`, dove oggi c'è `level += 1`: se il livello appena finito è `RUN_LEVELS`,
  andare a una **nuova `VictoryScene`** invece che al livello successivo.
- [ ] `src/scenes/VictoryScene.js`: titolo, riepilogo (livelli, cerume in banca, tempo totale),
  pulsanti **Nuova run** / **Menu**. Stesso stile di `MenuScene`.
- [ ] `Meta` (`src/meta.js`): salvare `vittorie` (contatore) e `miglioreLivello`.
- [ ] i18n EN+IT per tutte le stringhe nuove.
- **Fatto quando:** si arriva a fine run e si vede la vittoria; il cerume viene messo in banca come
  a fine livello normale; `controlla.py` verde.

## A.2 — Boss finale 🧠 poi 🤖
- [ ] Il livello `RUN_LEVELS` è un boss, ma **diverso** dal Tappo di Cerume dei livelli 5/10:
  più vita, una fase in più. Design della fase in più: da decidere con l'utente.
- [ ] Riusare `levelKind === 'boss'` con un flag `finale: true`.

## A.3 — Scelta tra DUE PORTE 🤖
Il pezzo con il miglior rapporto impatto/lavoro: **non serve contenuto nuovo**, rende una scelta
del giocatore quello che oggi è un sorteggio.
- [ ] Dopo la carta di potenziamento, mostrare **due opzioni per il livello successivo**, ognuna
  con: tipo di livello (`normale`/`corsa`/`assedio`/`sciame`), eventuale modificatore (`MUTATORS`)
  e una **anteprima della ricompensa** (es. "cerume ×1,5").
- [ ] Le due opzioni devono essere DIVERSE tra loro e contrapposte: una più rischiosa e più ricca,
  una più sicura e più povera.
- [ ] La scelta scrive `GameState.prossimoLivello = { kind, mutator, waxMult }`; `GameScene.create`
  legge quello **invece** di decidere da `levelNum % 5`. Se assente (primo livello), comportamento
  attuale.
- [ ] I livelli **boss restano fissi** (multipli di 5 e finale): lì niente scelta.
- [ ] i18n EN+IT.
- **Fatto quando:** ogni livello non-boss è preceduto da una scelta; il livello generato rispetta
  ciò che è stato scelto (verificabile con un controllo automatico, vedi A.5).

## A.4 — Taratura della durata 🧠
- [ ] **Misurare quanto dura una run** fino a `RUN_LEVELS` (serve il playtest dell'utente).
  Riferimento dalle fonti: 20-30 minuti, meno su telefono. Se 15 livelli sono troppi, abbassare.

## A.5 — Difficoltà crescente dopo la vittoria 🧠 poi 🤖
- [ ] Dopo la prima vittoria si sblocca un livello di difficoltà opzionale (nome a tema, es.
  "Infezione 1, 2, 3…"), scelto nel menu prima di partire. Ogni gradino aggiunge un peggioramento
  (nemici più duri / meno cerume / comparse più fitte) e aumenta la ricompensa.
- [ ] `Meta` salva il gradino più alto superato.
- [ ] Nuovi controlli in `tools/checks.js`: la run finisce a `RUN_LEVELS`; la scelta tra porte
  produce davvero il livello scelto; la difficoltà scelta viene applicata.

---

# BLOCCO B — Restyling NEMICI e TIMPANO

**Perché.** Sono gli ultimi elementi con la vecchia estetica: i nemici sono pixel-art generata da
codice (`PixelArt.fromGrid` in `BootScene`) e il timpano è uno sprite vecchio. Ora che sfondo,
terreno, soffitto, pedane e pozze parlano la stessa lingua, stonano loro.

## B.1 — Timpano: VIA CODICE 🧠
Il timpano è una membrana astratta, quindi **non serve arte nuova**: si disegna come abbiamo fatto
per terreno e soffitto, ed è coerente per costruzione.
- [ ] `GameGfx.paintEardrum(scene, x, y, w, h)`: membrana ovale con la tavolozza `CARNE`, anelli
  concentrici, velature, e il "respiro" già presente (tween di scala).
- [ ] Sostituire lo sprite `eardrum` in `buildGoal`, tenendo invariati posizione e area del
  traguardo. **Non toccare la logica di vittoria del livello.**

## B.2 — Nemici: immagini AI 🧠 (poi 🤖 per l'integrazione)
I nemici sono personaggi: il procedurale non basta, serve arte. **Stessa pipeline degli sfondi**
(vedi memoria `earwaxwar-background-pipeline`), che ha già funzionato:
- [ ] Opus scrive i prompt (uno per nemico: cerumino, crosta, gorgogliante, moscerino, pulce,
  saltatore, boss), con le regole già collaudate: **vista piatta di lato**, **sfondo MAGENTA puro
  #FF00FF** come colore-chiave, formato più largo possibile, stessa tavolozza tra tutti.
- [ ] L'utente genera; io scontorno e ridimensiono (lo scontorno stretto esiste già in
  `tools/bake_background_set.ps1`, va estratto in uno strumento riusabile).
- [ ] Integrazione in `BootScene` al posto delle texture da codice. **Hitbox e scale NON vanno
  cambiati** (`cfg.body`, `cfg.scale` in `spawnEnemy`): cambia solo l'immagine.
- [ ] ⚠️ **Conseguenza voluta:** con nemici disegnati si possono togliere le **aureole élite**
  (oggi un ripiego): le varianti Corazzato/Esplosivo/Split diventano varianti di colore o dettaglio.
- [ ] Le ANIMAZIONI restano fuori da questo blocco (servirebbe AutoSprite = abbonamento). Prima le
  immagini ferme, che già cambiano tutto.

---

# APERTI, in ordine di quanto sono pronti
- [ ] **Sfoltire l'APK** 🤖: ~8 MB su 22 sono materiale di lavorazione impacchettato per sbaglio.
  Dettaglio in `HANDOFF.md` §APK da SFOLTIRE. Il primo pezzo (togliere il caricamento delle
  protuberanze disattivate) vale 1,8 MB e risparmia memoria sul telefono.
- [ ] **Protuberanze** da rigenerare in stile e riattivare (il meccanismo è intatto in
  `GameGfx.drawProtuberances`, basta rimettere la chiamata in `buildLevel`).
- [ ] **Crouch**: 36 frame già forniti, servono 2 risposte dell'utente (vedi `HANDOFF.md`
  §Asset nuovi): è un ciclo o una posa tenuta? sostituisce lo schiacciamento attuale?
- [ ] **Tarature col playtest** e verifica dal vivo dell'**Assedio**, mai giocato davvero.
- [ ] **Altri set di sfondo**: procedura pronta, basta che l'utente dica "voglio altri sfondi".
- [ ] **Revisione completa del codice** 🧠: da fare DOPO che l'estetica si è assestata, con i
  controlli a fare da rete. Conviene prima mappare `GameScene.js` (3300 righe) con un subagente.
- [ ] **Freeze sul PC allo Start Run**: aperto e depriorizzato (l'utente gioca dal telefono), ma da
  chiarire prima dello store.
