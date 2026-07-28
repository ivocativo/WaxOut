# Earwax War — Piano esecutivo

> 📄 **A cosa serve questo file:** è la "lista di lavoro" dei blocchi in corso, usa e getta.
> Stato generale + backlog completo in **`HANDOFF.md`**; descrizione gioco in `README.md`.
> Regole fisse: **prima di ogni commit lanciare `python tools\controlla.py`** (60 controlli);
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

# DA DECIDERE CON L'UTENTE (proposte pronte, NON implementate)

## M — MUSICA CON BRANI VERI ✅ FATTA (2026-07-28) — restava solo la scelta dei brani, arrivata
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

## N — NOME DELL'APP: ✅ SCELTO **WAXOUT** (utente, 2026-07-27)
Perche' si cambiava: "Earwax War" non e' occupato, ma **"Earwax" da solo e' il party game di
Jackbox** e su Play c'e' gia' **Earwax Clinic** — cercando "earwax game" si finisce su di loro.
Verificato che **Waxout** non risulta occupato da nessun gioco o app. Limite dello store: 30
caratteri, niente emoji, niente maiuscole tutte tranne il marchio.
- [ ] **Applicare il nome** (lavoro mio, ~1 ora, tutto reversibile finche' non si pubblica):
  `capacitor.config.json` (appName e **appId**, es. `com.ivocativo.waxout` — ⚠️ l'appId dopo la
  pubblicazione NON si puo' piu' cambiare), `package.json`, il titolo nel menu (`i18n.js`), i
  tre `.md`, il nome dell'APK. La cartella e il repository possono restare `earwaxwar`: cambiarli
  romperebbe percorsi e cronologia senza portare niente al giocatore.
- [ ] Valutare un sottotitolo tipo "Waxout - la guerra del cerume" per non perdere la parola
  chiave "earwax" nelle ricerche (la descrizione dello store la indicizza comunque).

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
  - [ ] **ARTE**: le 5 armi usano ancora le vecchie texture disegnate a codice (coton fioc /
    martello / spruzzino, ripetute). Servono i disegni veri — prompt da scrivere, l'utente genera,
    poi `tools/bake_sprite.ps1` e una voce nella tabella `WEAPONS` di `GameScene` (tex, perno,
    scala, mano). **Solo dopo il playtest**, cosi' si disegnano solo i kit che restano.
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
- [ ] **Revisione completa del codice** 🧠: da fare DOPO che l'estetica si è assestata, con i
  controlli a fare da rete. Conviene prima mappare `GameScene.js` (3300 righe) con un subagente.
- [ ] **Freeze sul PC allo Start Run**: aperto e depriorizzato (l'utente gioca dal telefono), ma da
  chiarire prima dello store.
