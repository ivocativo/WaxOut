# Earwax War — Handoff (nuova sessione)

> 📄 **A cosa serve questo file:** è il "punto della situazione" da leggere a INIZIO sessione
> (stato attuale, come collaudare, regole, rischi). Il **piano dettagliato del blocco di lavoro
> in corso** (con le caselle da spuntare) sta in **`ROADMAP.md`**. La descrizione del gioco per
> chiunque lo trovi sta in **`README.md`**. Regola d'oro: ogni informazione ha UNA casa sola,
> niente sezioni duplicate tra i tre file.

_Ultimo aggiornamento: 2026-07-17 · Ultimo commit pushato: `75df562` su `origin/main`._
_**DUE giri di correzioni da playtest telefono CHIUSI e PUSHATI:**_
_· **Round 1** (dopo il 1° playtest, 21 segnalazioni) — tutti i gruppi fatti, fino a `9b43c73`._
_· **Round 2** (dopo il 2° playtest, 15 segnalazioni) — tutti gli 8 gruppi A–H fatti, fino a `75df562`:_
_arco coton fioc, balzo pulci, texture proiettili ostili, gate scatto-danno, soffitto tangibile,_
_scia scatto, salto boss verticale, terremoto a stalattiti, Corsa a tempo + timer condiviso, carte_
_melee chiarite + "Getto Rapido", menu principale rifatto. (Dettaglio: `ROADMAP.md`, ora chiuso.)_
_**SI RIPARTE dal playtest dell'utente (round 3):** provare i due giri di fix sul telefono, tarare i_
_numeri "sensati" e decidere il prossimo grande asse (vedi §DA FARE)._

Gioco: **run-and-gun / roguelite 2D** (stile Metal Slug + Vampire Survivors/Gungeon) a tema
"pulizia del condotto uditivo". Obiettivo finale: pubblicazione su **Google Play** (Android,
telefono + tablet) via Capacitor. Giocabile su PC (tastiera) e telefono (comandi touch).

- **Stack:** JavaScript + **Phaser 3** (in `vendor/`), niente build, gira anche da `file://`
  (script classici `window.*`, no moduli ES). HTML in `index.html`.
- **Repo:** `C:\Users\ivanf\Claude\code\earwaxwar` · GitHub `ivocativo/earwax-war` (branch `main`).
- **Utente:** non tecnico, italiano. Spiegare in modo semplice, confermare prima di passi grossi.
- **Regola file:** ogni file del gioco va in `code/earwaxwar/` (usare percorsi assoluti; la shell
  parte da `code/`).
- **Modo di lavorare (dal 2026-07-11):** **Opus pianifica** (scrive/aggiorna `ROADMAP.md`),
  **Sonnet esegue** a basso consumo token. Ciclo fisso per ogni fase: implementa → `/code-review`
  → collaudo dal vivo → riferisci → chiedi se committare. Niente subagenti se non per casi decisi
  con l'utente (vedi memoria `earwaxwar-subagent-reminder`).

---

## ✅ COLLAUDO: ora si VEDE (aggiornato 2026-07-12)

**Il preview ADESSO mostra l'immagine.** Con lo strumento **Browser pane** (`preview_start {url|name}`
poi `computer {action:"screenshot"}`) si ottengono screenshot LIVE puliti sia del menu sia della
GameScene → l'assistente **vede** e itera su grafica/animazioni. Superato il vecchio blocco "preview
cieco" (era: la scheda perdeva il focus / il canale corrompeva le immagini).

Distinzione:
- **Logica** (assegnazioni/danni/tempi/niente crash): verificabile con loop-pumping + `javascript_tool`.
- **Aspetto/feel**: ora l'assistente lo vede a schermo, ma il giudizio finale di GUSTO (e il feel su
  touch) resta il **playtest dell'utente sul telefono**.

**⚠️ Instabilita' del preview (da sapere):** il server `serve.ps1` (porta 8123) a volte MUORE → la
scheda finisce su pagina vuota (`window.game` assente, titolo vuoto). Rimedio: `preview_start
{name:"earwaxwar"}` per RIAVVIARE il server (non basta riaprire l'URL se il server e' morto). Anche:
un `location.reload()` puo' chiudere la scheda del preview → riaprirla. Dopo `scene.start('GameScene')`
il `create` gira al tick DOPO: non leggere subito `heroVisual`/`player` (aspetta o verifica `isActive`).
Per i test in preview vale la regola god-mode robusta (metterlo nel hook `events.once('create')`, o il
PG muore durante i riavvii e parte il game-over).

### Ancora da far playtestare sul telefono all'utente (dal più vecchio)
Arretrato mai provato dal vivo (verificato solo staticamente in sessioni precedenti):
- `5a52325`→`00ec955` — gocce dal soffitto, mutatori, tipi di livello (corsa/**assedio**),
  varianti élite Corazzato/Esplosivo, reset progressi, vari fix.
Lavoro nuovo di questa sessione (logica ok, feel/aspetto da provare):
- `c0d6bdc` — élite **SPLIT** (si sdoppia in 2 figli alla morte).
- `f0f2273` — **rarità carte** (comune/rara/leggendaria colorate) + eventi **Fuggitivo Dorato**
  e **Frana di cerume**.
- `06b4b6b` — evento **Sciame improvviso** (+ riordino dei `.md`).
- `5490cc5` — **game feel**: accel/decel del movimento. Due cose SOGGETTIVE da giudicare col
  playtest (non bug): dopo lo scatto il PG "scivola" un attimo verso la velocità normale; il
  rinculo da colpo subito dura un filo di più. Se stonano: `MOVE_ACCEL_GROUND`/`AIR` in `state.js`.
- `257c2a5` — **juice procedurale** (il PG si schiaccia/allunga a salto/atterraggio/inversione/colpo)
  + **carattere comico** (fumetto con battute a inizio livello/uccisione/colpo/boss). Da giudicare:
  quanto marcato il juice (`JUICE_*` in `state.js`), se le battute fanno ridere/stonano (in `state.js`
  `SPEECH` + `i18n.js`). Punto specifico: accovacciandosi può vedersi un micro-"assestamento" (effetto
  collaterale già preesistente, ora visibile) — segnalare se stona.

---

## Come provare il gioco

**Preview per l'assistente:** `preview_start {name:"earwaxwar"}` (porta 8123) da `.claude/launch.json`
→ apre la scheda e RENDERIZZA (screenshot ok, vedi §COLLAUDO). Per collaudare la LOGICA a fondo, o se il
tab perde il focus, si puo' anche **pompare il loop a mano** e interrogare lo stato con `javascript_tool`:
```js
// base sull'orologio INTERNO del gioco (NON performance.now(): divergono e falsano i tempi)
const loop = window.game.loop; let t = loop.time;
const pump = (n) => { for (let i=0;i<n;i++){ t+=16.6; loop.step(t); } };
// avvio livello + god-mode, poi pump(30) per far girare create()/scene, poi i test
```
GOTCHA loop-pumping:
- **Ri-arma sempre il god-mode dopo un reset**, o in un pump lungo il giocatore muore e la scena
  si blocca (`gs.locked = true`) → i `delayedCall` non partono più e i test "falliscono" a torto.
- Il riferimento alla scena (`getScene('GameScene')`) resta valido tra i restart, ma i gruppi
  (`enemies`, ecc.) vengono ricreati: ri-prendi i figli dopo ogni `scene.start`.

**Telefono (per l'utente):** doppio-click su `GIOCA-SU-TELEFONO.cmd` sul PC (deve restare
aperta la finestra nera) → sul telefono (stesso Wi-Fi) aprire l'indirizzo `http://<IP>:8123`
**stampato in quella finestra nera**. ⚠️ L'IP del PC CAMBIA (DHCP): non fidarsi di un indirizzo
memorizzato — il 2026-07-13 era `192.168.1.193`, il 2026-07-18 era `192.168.1.10`. Leggere sempre
quello mostrato dalla finestra. Consentire il firewall su rete PRIVATA. Se "non funziona" da
telefono, la causa n.1 è l'indirizzo vecchio o la finestra nera non avviata.

**God-mode nei test (OBBLIGATORIO, tranne quando si testa la morte):**
```js
window.GameState.player.hp = 999999; gs.invulnUntil = 1e12;
```
Avvio rapido di un livello: `window.GameState.reset(); window.GameState.level = 4;
window.game.scene.getScene('MenuScene').scene.start('GameScene');`

GOTCHA test: `enemies.getChildren().find(active)` becca anche i GUARDIANI (non solo il nemico
appena spawnato) → filtrare per `x.kind`/`x.swarmling`/`x.fugitive` o distruggere prima i guardiani.

---

## Struttura del codice (dove sta cosa)
- `src/state.js` — costanti (`CONFIG`), `newPlayer()`, e le TABELLE: `UNLOCKS` (potenziamenti
  shop), `BLUEPRINTS` (progetti/abilità sbloccabili), `EVOLUTIONS` (fusioni), `MUTATORS`
  (modificatori di livello), `EVENTS` (eventi casuali). `Meta` sta in `src/meta.js` (localStorage).
- `src/scenes/GameScene.js` — cuore del gioco (~2400 righe): build livello, spawn nemici, IA,
  combattimento, abilità, mutatori, tipi di livello, gocce, élite, **eventi casuali**, update loop.
  **Personaggio animato:** `this.player` (fisica) reso invisibile + `this.heroVisual` (sprite animato che
  lo segue, scala `HERO_SCALE`, origin `HERO_ORIGIN_Y`, riceve il juice); anim per stato in `update()`.
- `src/scenes/UpgradeScene.js` — carte di fine livello (pool `ALL` + evoluzioni + **rarità** + filtro).
- `src/scenes/ShopScene.js` — negozio (2 colonne: Potenziamenti + Progetti) + pulsante reset.
- `src/scenes/MenuScene.js` / `PauseScene.js` — menu e pausa. `src/scenes/BootScene.js` — carica gli
  sprite PNG (assets), gli **sprite sheet animati del personaggio** (`hero_walk`/`hero_run`/`hero_idle`/
  `hero_jump`, frame 84) e genera via codice le texture non ancora ridisegnate.
- `src/gfx.js` (`GameGfx`) — SOLO rendering (sfondo, cerume, splat, `showBanner`, ecc.). Tenere
  grafica separata dal gameplay: sessione "grafica" tocca gfx.js, "gameplay" GameScene.js.
- `src/i18n.js` — dizionario EN (default) + IT. Ogni stringa passa da `I18n.t('chiave')`.
- `src/touch.js` — comandi touch (stick analogico + tasti). `src/sfx.js` — audio procedurale
  (WebAudio): synth con ADSR/filtri/detune + mandata delay-riverbero, effetti stratificati, e un
  motore musicale a lookahead con 3 atmosfere (`Sfx.setMusic('menu'|'level'|'boss')`).
- `assets/` — sprite/immagini (incorporati come data-URI in `sprites_data.js`/`assets_data.js`
  per girare da `file://`). **`assets/spritesheets/<entita'>/`** = home DEDICATA per TUTTI gli sprite
  sheet animati del gioco (separata da `assets/sprites/` che resta per immagini singole) — oggi
  `assets/spritesheets/hero/`: `hero_walk`/`hero_run`/`hero_idle`/`hero_jump` (sheet AutoSprite 256) +
  `_px` (pixellati, USATI dal gioco). **Gli sheet NON sono ancora incorporati** → si vedono via
  server/LAN, non da `file://`. La sorgente singola `hero_ai.png` resta in `assets/sprites/hero/`.
  `tools/` — script PowerShell: `cutout_bg.ps1` (sfondo trasparente), `scale_sprite.ps1` (ridimensiona),
  `bake_sheet_pixel.ps1` (pixelate), + serve LAN / embed assets. (`gen_hero*.ps1` = esperimento
  procedurale SCARTATO, file non committati, lasciati solo come riferimento.)

---

## Cosa c'è già (sistemi principali)
- **Combattimento:** attacco unico "intelligente" (mazza da vicino / getto da lontano),
  hit-stop + shake, salto ad altezza variabile + coyote/buffer, accovacciamento, scatto.
- **Movimento:** accelerazione/decelerazione morbida (a terra `MOVE_ACCEL_GROUND` 0.3, in aria
  `MOVE_ACCEL_AIR` 0.15); lo scatto resta istantaneo. **Juice procedurale**: il PG si schiaccia/
  allunga a salto/atterraggio/inversione/colpo (`JUICE_*` in `state.js`, `jx`/`jy` + `setJuice` in GameScene).
- **Carattere comico:** fumetto con battute a inizio livello/uccisione/colpo/boss (`SPEECH` in
  `state.js`, `speech_*` in i18n; `maybeSpeech`/`showSpeech` in GameScene, `GameGfx.showSpeech` per il rendering).
- **Personaggio (grafica/animazione, dal 2026-07-12/13):** esploratore da **immagine AI** (Leonardo),
  **animato** con **AutoSprite**: idle/camminata/corsa/salto (sprite sheet in `assets/spritesheets/hero/`,
  pixellati). Fisica/hitbox invariati (`this.player` invisibile, `this.heroVisual` segue). **Attacco:**
  prototipo **arma-in-mano** (`this.heroWeapon`, layer separato e intercambiabile via tabella `WEAPONS`) —
  a distanza punta la mira, corpo a corpo rotea; il braccio/testa del corpo NON seguono (serve una posa
  dedicata per quello, rimandata). **BUG NOTO (da correggere, vedi ROADMAP §A.1):** nel corpo a corpo il
  coton fioc compare DUE VOLTE (vecchio `GameGfx.showWeaponSwing` + nuovo layer, entrambi attivi).
- **Nemici:** blob (cerumino), crust (crosta, corazzata anti-getto), spit (gorgogliante),
  fly (moscerino, picchiata telegrafata), boss (Tappo di Cerume, si infuria a metà vita).
  **Varianti élite** (dal lvl 3): Corazzato (aura azzurra), Esplosivo (aura rossa),
  **SPLIT** (aura viola, si sdoppia in 2 figli più deboli alla morte).
- **Abilità di run** (carte UpgradeScene): ventaglio (impilabile), perforante, vita rubata,
  scudo (alone visibile), mira guidata, seconda vita, cerume extra (impilabile), scatto
  offensivo, sapone corrosivo, rimbalzo (impilabile), + bolla-aiutante (impilabile, blueprint).
  **Rarità** delle carte: comune (grigio) / rara (blu) / leggendaria (oro), pesca pesata 60/30/10.
- **Evoluzioni** (fusioni di 2 abilità): Lama d'Acqua, Nube Tossica, Buco Nero, Sciame.
- **Meta/negozio:** cerume in banca → potenziamenti permanenti (UNLOCKS) + progetti (BLUEPRINTS).
  Pulsante "Azzera progressi" (2 tocchi).
- **Varietà livelli:** tipi (normale / corsa / assedio / boss / sciame) + **modificatori** casuali
  (`MUTATORS`: fretta, orda, corazza, poca gravità, cuccagna, cerume ostinato) + **eventi casuali**
  (`EVENTS`, ~25%, indipendenti dai mutatori): Fuggitivo Dorato, Frana di cerume, Sciame improvviso.
- **Ostacoli:** pozze scivolose + gocce dal soffitto. Membrane di cerume con fisica a celle (collasso).
- **Mobile:** touch, canvas che si ri-adatta alla rotazione, tool per giocare da telefono.

---

## DA FARE

### Correzioni playtest — DUE GIRI CHIUSI E PUSHATI ✅
Round 1 (21 segnalazioni) e Round 2 (15 segnalazioni) entrambi completati e pushati (fino a
`75df562`). Il dettaglio di entrambi è nella **cronologia git** (il file `ROADMAP.md` è "usa e
getta" ed è già stato ripreso dal blocco successivo, vedi sotto). **Prossimo passo su questo
fronte:** aspettare il round 3 di playtest dell'utente per tarare i numeri e giudicare le parti
soggettive (look nuovo menu, durata Corsa, altezza salto boss, cadenza terremoto).

### 🩹 HOTFIX dal playtest utente (2026-07-18) — NON ancora committati
Emersi giocando SENZA god-mode (che nei test li nascondeva — vedi `earwaxwar-sim-godmode`):
- **Morte istantanea allo spawn ("freeze" allo Start Run):** a caso un nemico nasceva incollato al
  punto di partenza e uccideva il PG prima che potesse muoversi. Fix in `GameScene.js`: (1)
  `pickGroundX` non piazza mai un nemico < 130px dal PG (nei ripieghi sceglie il bordo piu' lontano);
  (2) protezione allo spawn `invulnUntil = now + 1400`. Verificato: su 12 gen. del lvl 1 distanza
  minima nemico-spawn 212px (era 36), PG sopravvive i primi ~3,4s fermo.
- **Boss ancorato a terra (il fix D.1 del round 2 non funzionava DAVVERO in gioco):** al lancio del
  salto il boss veniva "stirato" con `setScale(…, 1.25)` — che in questa build ingrandisce anche il
  CORPO fisico — mentre era ancora appoggiato a terra: il motore lo ri-separava dal suolo e ANNULLAVA
  la velocita' di salto (da -600 a ~0 in un frame). Fix: applicare lo stiramento ~50ms DOPO il decollo
  (via `delayedCall`), quando e' gia' in aria. Verificato dal vivo: il boss ora salta ad apice 151px
  (era 7px), confermato anche a schermo. **Perche' sfuggito in round 2:** il test con `game.step`
  forzava condizioni che non riproducevano il conflitto setScale-a-terra → falso positivo.
- **FREEZE totale allo "Start Run" su PC (schermo congelato, non morte):** causato dal NUOVO motore
  musicale. Lo scheduler a lookahead aveva un `while` di "recupero passi persi" che, se il thread
  aveva un intoppo caricando il livello (PC piu' lenti), poteva rincorrere all'infinito
  (`currentTime` avanza piu' in fretta della schedulazione) → pagina bloccata. Sul PC veloce/telefono
  non capitava. Fix in `sfx.js` `schedTick`: se resta troppo indietro RISINCRONIZZA (salta i passi
  persi) invece di rincorrerli + TETTO rigido di 32 passi per giro (il ciclo ora e' provabilmente
  limitato). ⚠️ NON riproducibile sul mio ambiente (troppo veloce) → fix ragionato e reso a prova di
  loop, ma da CONFERMARE dall'utente sul suo PC.
- **Telefono "non funziona":** era solo l'IP del PC cambiato (DHCP). Nessuna modifica al codice.
Tutti da riprovare a fondo dall'utente (senza god-mode).

### 🎵 Audio (rifacimento synth) — FATTO E VERIFICATO (logica), NON ancora committato
Rifatto `src/sfx.js` (2026-07-17): sintesi più ricca (busta ADSR, filtri, detune, mandata
delay+riverbero), **13 effetti stratificati con variazione** a ogni colpo, e un **vero motore
musicale** (scheduler a lookahead, voci basso/accordi/lead + batteria sintetica) con **3 atmosfere
che cambiano da sole**: menu (rilassato), livello (ritmato), boss/assedio (teso), con dissolvenza.
Agganci: `MenuScene`→'menu', `GameScene`→'level'/'boss' per tipo. Resta PROCEDURALE (peso zero).
Verifica LOGICA in preview ok (zero errori, note davvero generate, cambi atmosfera ok). **Il GUSTO
lo giudica l'utente sul telefono** — le 3 atmosfere sono bozze da tarare. Piano in `ROADMAP.md`.
RIMANDATI: effetti extra (AU-B.2) e boss-infuriato = musica più intensa (AU-D.3).
**Iterazione 2026-07-18 (feedback utente):** (1) meno ripetitiva — melodie a 4 battute (64 passi)
con frasi diverse, backing a 2 battute (32), batteria con fill, umanizzazione volume lead/hat;
(2) piu' ACUSTICA/calda — accordi STRUMMATI (note sfasate ~18ms), timbri triangle su menu+livello,
lieve detune sul lead; (3) BOSS PUNK — power chord + basso a crome + batteria tirata + DISTORSIONE
(waveshaper, opzione `dist` in synth, attiva solo per i brani `punk:true`). Ancora bozze da
rigiudicare dall'utente.

**Unico strascico di design ancora aperto dal round 2:**
- **F.2b — arena dedicata per l'Assedio** (`siege`): oggi l'Assedio riusa un livello normale col
  timer. Renderlo un vero spazio chiuso/ad arena e' un pezzo di design grosso → **da pianificare a
  fondo con Opus prima di implementare**, non toccato di proposito.

### Grandi assi ancora da fare (scelta del prossimo blocco, dopo il playtest)
In ordine NON vincolante — da decidere con l'utente qual e' la priorita':
- **AUDIO da rifare completamente** (era il "Gruppo G" del round 1, sempre rimandato): musica +
  effetti, sessione dedicata a parte.
- **Sprite + animazioni dei NEMICI** (stesso trattamento del PG: immagine AI → AutoSprite →
  pixelate): uniforma l'estetica e fara' sparire le aureole élite (che oggi sono un ripiego).
  Include le animazioni chieste: cerumino/gorgogliante che strisciano, crosta "asciutta" diversa.
- **Posa d'attacco coordinata corpo+arma** del PG (braccio/testa che seguono la mira): serve
  generarla su AutoSprite → **richiede l'abbonamento** (i crediti gratis sono finiti). Oggi c'e' il
  ripiego "arma-in-mano" su layer separato.
- **STRADA VERSO GOOGLE PLAY** (l'obiettivo finale): ottimizzare/alleggerire `assets_data.js` +
  incorporare gli sprite sheet → **Capacitor** → build Android. Serve installare **Node** (oggi
  assente). Vedi §Grandi assi in fondo.

### Personaggio & animazioni — quasi chiuso, resta:
- **Attacco coordinato corpo+arma:** serve una POSA DEDICATA (braccio/testa che seguono la mira),
  generabile su AutoSprite quando l'utente fa l'abbonamento (walk/run/idle/jump erano gratis, i
  crediti sono finiti). Nel frattempo resta il prototipo **arma-in-mano** (layer separato, vedi
  sopra) — **ma con il bug del coton-fioc-doppio da correggere prima** (Gruppo A.1).
- **Embed + peso:** gli sprite sheet NON sono in `assets_data.js` → si vedono via server/LAN (preview
  + telefono ok) ma NON da doppio-click `file://`. Da incorporare e/o ottimizzare il peso prima del
  build Android.
- **Stesso trattamento sui nemici** (AI + AutoSprite + pixelate) per uniformare l'estetica — quando
  si arriva a quel lavoro, farà sparire le aureole élite (Gruppo H.2).

### Pipeline arte (collaudata 2026-07-12/13) — sostituisce il procedurale
Look di qualita' = **immagini AI (Leonardo)**, NON procedurale a codice (bocciato dall'utente: "qualita'
bassa"). Flusso: **l'utente genera** su Leonardo (prompt scritti dall'assistente) → **l'assistente**
ritaglia/scala/pixela/integra. Tool: `cutout_bg.ps1`, `scale_sprite.ps1`, `bake_sheet_pixel.ps1`.
Animazioni = **AutoSprite** (1 immagine → sprite sheet per stato, preserva il design). Sheet salvati in
`assets/spritesheets/<entita'>/`. Stesso metodo riusabile per **nemici/ambiente**.

### Grandi assi (dopo il blocco correzioni)
- **Strada verso Google Play:** ottimizzare `assets_data.js` (cresce con gli sheet) → **Capacitor** →
  build Android. (Node servira' lì; ora NON installato — non piu' bloccante per l'arte.)

### Backlog estetico/futuro (dettagli in memoria `earwaxwar-backlog`)
- Alternative ostacoli (peli oscillanti, geyser) — probabilmente assorbite dal Gruppo E (livelli).
  Monetizzazione (non decisa).

---

## RISCHI / punti aperti da tenere d'occhio
- **Tipo di livello ASSEDIO (`siege`):** mai provato dal vivo. Verificare che il countdown parta e
  che il livello si completi allo scadere (win a tempo, timpano disattivato).
- **Volanti vs pedane (`00ec955`):** le pedane sono solide anche ai moscerini; se in playtest si
  "incastrano", limitare la collisione alla sola picchiata. **Collegato:** i volanti invece NON
  collidono col cerume (`notFlyer` sul collider blocks) — segnalato come bug playtest (ROADMAP §A.2),
  da decidere insieme alla proposta "Fuggitivo Dorato = volante" (§B.1): stessa regola fisica, non va
  decisa due volte in modo incoerente.
- **Tante manopole numeriche da tarare col playtest** (valori "sensati" non collaudati): danni/durate
  élite e dei 3 eventi (bottino/tempo del fuggitivo, cadenza/danno della frana, numero dello sciame),
  cadenza gocce, prezzi shop, durata assedio.

---

## Convenzioni
- Commit in italiano; in fondo `Co-Authored-By:` col modello che ha fatto il lavoro
  (Opus per la pianificazione, Sonnet per l'esecuzione).
- Committare/pushare solo quando l'utente lo chiede (di solito a fine blocco).
- i18n: ogni nuova stringa in EN + IT (niente accenti nelle stringhe, il font pixel non li rende).
- God-mode nei test SEMPRE (vedi sopra), MAI lasciarlo nel codice committato.
- La memoria di progetto dettagliata è in `earwaxwar-backlog` (auto-memory dell'assistente).
