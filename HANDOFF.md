# Earwax War — Handoff (nuova sessione)

> 📄 **A cosa serve questo file:** è il "punto della situazione" da leggere a INIZIO sessione
> (stato attuale, come collaudare, regole, rischi). Il **piano dettagliato del blocco di lavoro
> in corso** (con le caselle da spuntare) sta in **`ROADMAP.md`**. La descrizione del gioco per
> chiunque lo trovi sta in **`README.md`**. Regola d'oro: ogni informazione ha UNA casa sola,
> niente sezioni duplicate tra i tre file.

_Ultimo aggiornamento: 2026-07-13 · Ultimo commit: `afd6b5c` (idle+salto integrati, cartella spritesheets).
Pushato. Non ancora committato: prototipo arma-in-mano era gia' `b2e167c` (quello si')._
_**Personaggio NUOVO di qualita' (immagine AI) con animazioni VERE: idle/camminata/corsa/salto, +_
_prototipo arma-in-mano durante l'attacco.** L'utente ha FATTO IL PRIMO PLAYTEST completo su telefono:_
_21 segnalazioni annotate e raggruppate nel **nuovo blocco `ROADMAP.md` "Correzioni playtest — round 1"**_
_(bug con causa gia' trovata + feature/redesign piu' grandi). Da lì si riparte, un gruppo alla volta._

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

**Telefono (per l'utente):** doppio-click su `GIOCA-SU-TELEFONO.cmd` sul PC → sul telefono
(stesso Wi-Fi) aprire `http://<IP-PC>:8123` (di recente `192.168.1.193:8123`; l'indirizzo
esatto è stampato nella finestra nera). Consentire il firewall su rete PRIVATA.

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
- `src/touch.js` — comandi touch (stick analogico + tasti). `src/sfx.js` — audio procedurale.
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

### Correzioni playtest — BLOCCO IN CORSO (piano dettagliato in `ROADMAP.md`)
Dopo il primo playtest completo su telefono (2026-07-13), l'utente ha dato **21 segnalazioni**
(bug + migliorie), tutte **annotate e raggruppate** in `ROADMAP.md` con causa probabile (file:riga)
dove trovata con una verifica veloce. Riassunto dei gruppi (dettagli in ROADMAP):
- **Gruppo A** (bug rapidi, causa già individuata): coton fioc doppio nel corpo a corpo; moscerini
  attraversano il cerume; Seconda Vita si ricarica troppo; potenziamenti one-shot (es. doppio salto)
  riproposti anche se già garantiti da uno sblocco permanente; nemici Esplosivi non danneggiano
  altri nemici/cerume; scatto (dash) fa sparire le torri di cerume istantaneamente; proiettili rotti
  nei livelli a poca gravità.
- **Gruppo B**: Fuggitivo Dorato bloccato nel cerume (proposta: farlo volante — MA decisione legata
  al Gruppo A, vedi nota lì) + valutare nemici che saltano.
- **Gruppo C**: boss noioso/troppo sicuro con pedana comoda, dovrebbe droppare cure alla morte.
- **Gruppo D**: scatto-con-danno deve essere visivamente distinto dallo scatto normale.
- **Gruppo E** (grande): variante "cerume che cade" da rifare con lo sprite vero; livelli monotoni →
  più sfondi, soffitto visibile, condotto ondulato, protuberanze/burroni; pedane non sempre
  raggiungibili.
- **Gruppo F** (grande): shop troppo facile → ridurre cerume per livello, drop-da-raccogliere invece
  di auto-pickup, più progetti sbloccabili.
- **Gruppo G**: audio da rifare completamente (standalone, sessione a parte).
- **Gruppo H**: note per il futuro (PG che si sporca di cerume; aure élite spariranno con sprite
  nemici veri) — non azioni immediate.

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
