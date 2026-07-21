# Earwax War — Handoff (nuova sessione)

> 📄 **A cosa serve questo file:** è il "punto della situazione" da leggere a INIZIO sessione
> (stato attuale, come collaudare, regole, rischi). Il **piano dettagliato del blocco di lavoro
> in corso** (con le caselle da spuntare) sta in **`ROADMAP.md`**. La descrizione del gioco per
> chiunque lo trovi sta in **`README.md`**. Regola d'oro: ogni informazione ha UNA casa sola,
> niente sezioni duplicate tra i tre file.

_Ultimo aggiornamento: 2026-07-20 · Ultimo commit di lavoro pushato: `be4eb3c` (sfondo a 3 strati)._
_**Fatti e pushati:** Round 1 e 2 (correzioni playtest, fino a `75df562`); Round 3 AUDIO (synth +_
_3 atmosfere, boss punk); hotfix freeze-spawn e salto boss; **APP ANDROID via GitHub Actions** (APK_
_installabile dal telefono, larghezza adattiva); **Round 4 — CONDOTTO/TERRENO:** soffitto ondulato_
_con stanze ampie + collisione, e **TERRENO stile Terraria** (colline + cunette) su cui camminano_
_PG e nemici via "mappa di altezze" (heightmap-snap); **✅ BUG CERUME su terreno RISOLTO** (`d6e50cd`);_
_**✅ fix corpo a corpo** (`ae6abd4`: cerume e nemici non tornano piu' al vecchio livello piatto);_
_**✅ ROUND 5 — SFONDO a 3 strati** (`be4eb3c`: parallax pittorico a set, soffitto piu' alto,_
_protuberanze vecchie disattivate). Dettaglio in `ROADMAP.md`._
_**STATO ORA:** sfondo fatto e approvato. Prossimi passi: **BUG salto nelle cunette** (§DA FARE),_
_rigenerare le protuberanze in stile, rifinitura terreno, integrare il **crouch** (§Asset nuovi),_
_tarare i numeri col playtest. L'utente RIMANDA lo store; rifinisce gameplay/estetica._

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
- **Sfondo (dal 2026-07-20):** SET di 3 immagini **pittoriche** (far/mid/near) in parallax dietro
  soffitto e terreno. Volutamente NON pixelate: il contrasto con i personaggi pixel-art e' una
  scelta approvata dall'utente. Un set ogni 5 livelli (cambia dopo il boss). Manopole per strato
  in `GameGfx.BG_LAYERS` (y, velocita', scala, opacita', tinta: il lontano smorzato e il vicino a
  colori pieni = prospettiva atmosferica). **Per aggiungere set c'e' una procedura pronta in
  memoria (`earwaxwar-background-pipeline`): basta che l'utente dica "voglio altri sfondi".**
  Pipeline in `tools/bake_background_set.ps1` (ridimensiona, scontorna il magenta, specchia).
- **Mobile:** touch, canvas che si ri-adatta alla rotazione, tool per giocare da telefono.

---

## DA FARE

### ✅ BUG CUNETTE (salto bloccato) — RISOLTO 2026-07-20
L'ipotesi era giusta ed e' stata confermata riproducendo il bug: il bordo inferiore del mondo
fisico stava a `H - gh` = **360**, mentre le cunette scendono a **396**. Dentro una cunetta il
corpo era fuori dal mondo e, avendo `collideWorldBounds`, ogni frame veniva rispinto dentro **con
la velocita' verticale azzerata** → l'impulso del salto spariva all'istante. Misurato prima del
fix: apice del salto **0px** nella cunetta (il PG non si staccava di un pixel) contro un salto
regolare sul piano. **Fix:** bordo del mondo portato a `H - gh + 48` = 408, cioe' alla quota del
collider di sicurezza `this.ground`, che resta la rete di protezione.
Verificato dopo il fix: cunetta piu' profonda possibile (396) → apice **141px**, come sul piano;
3 cunette in 3 livelli diversi → apice 106 e riatterraggio esatto sulla superficie (scarto 0);
rete di sicurezza ok (PG lanciato a y=700 viene ripreso, non sfonda); nemici sprofondati 0px;
61 fps, zero errori console.

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
- **⚠️ APERTO — FREEZE totale allo "Start Run" SUL PC (schermo congelato, non morte):** persiste
  ANCHE dopo aver reso lo scheduler musicale provabilmente limitato (risync + tetto 32 passi/giro in
  `sfx.js` `schedTick`) → quindi **NON era (solo) l'audio**. Non riproducibile sul mio ambiente
  (preview gira a 60fps senza bloccarsi). **DEPRIORITIZZATO dall'utente (2026-07-18): gioca dal
  TELEFONO, dove funziona** (menu, boss, musica ok). Piste da indagare quando si riprende: (a) e'
  specifico del browser/hardware del PC dell'utente? (b) postFX WebGL del cerume (`WaxMetaballFX`) su
  quella GPU? (c) driver audio del PC? **Da chiarire PRIMA del build Android** (verificare che il
  webview mobile/Capacitor non erediti lo stesso blocco — finora il browser del telefono e' ok). Il
  fix dello scheduler resta comunque una robustezza sensata (tenerlo).
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

### ✅ APP ANDROID (Capacitor via GitHub Actions) — FATTA (2026-07-18)
Il gioco si impacchetta in APK **nel cloud** (nessuno strumento locale): `package.json` +
`capacitor.config.json` (webDir=www) + workflow `.github/workflows/build-android.yml`. Ciclo: push su
main → GitHub compila → `gh run download` scarica l'APK → messo in `EarwaxWar.apk` (root, gitignored) →
l'utente lo prende dal telefono via `GIOCA-SU-TELEFONO.cmd` (`http://<IP>:8123/EarwaxWar.apk`) e lo
installa. **Larghezza ADATTIVA** (main.js) → niente bande nere ai lati. L'app parte e gira sul telefono.
Resta: **icona app personalizzata** (ora generica), e la pubblicazione vera sullo store (rimandata).

---

## BACKLOG CONSOLIDATO (raggruppato) — l'utente rimanda lo STORE, prima rifinisce gameplay/estetica/audio
_Aggiornato 2026-07-20 raccogliendo i punti aperti di tutte le sessioni. Da qui si sceglie il prossimo
blocco; il blocco scelto va poi dettagliato in `ROADMAP.md`. Molti "numeri" restano da tarare col
playtest dell'utente sul telefono._

**🚧 QUASI CHIUSO — ROUND 4 (condotto + terreno) — riparti da QUI.** Piano dettagliato + stato in
`ROADMAP.md`. Fatto e pushato (fino a `d6e50cd`): soffitto ondulato con stanze ampie + collisione;
**TERRENO stile Terraria** (colline + cunette) disegnato da `buildTerrain` seguendo `terrainTopAt`;
PG e nemici ci camminano via **heightmap-snap** (in `update()`: aggancio `body.y` a `terrainTopAt`;
`e._grounded` sostituisce `blocked.down` nell'IA nemici); **✅ BUG CERUME su terreno RISOLTO**. Da fare:
- ✅ **BUG CERUME su terreno — RISOLTO 2026-07-20 (`d6e50cd`).** Tutto cio' che "sta sul pavimento"
  ora usa `terrainTopAt(x)` invece della quota fissa 360: cumuli (`buildFloorMound`/`addWaxBlock`),
  membrane (`buildMembrane`), pozze scivolose (`addSlimeZone`), comparsa/sbuffo nemici, ombra boss,
  splat di frane/gocce. Anche `buildTerrain()` spostato PRIMA delle membrane. Verificato dal vivo
  (errore 0px su 30 blocchi, 22 su colline/cunette). I pickup NON servivano fix (gia' agganciati).
- **Rifinitura terreno:** look organico (con l'arte); taratura ampiezza/frequenza colline+cunette;
  togliere codice morto (`floorEdgeYAt`/`buildFloorProfile`, `addBump`/`addPit` disabilitati).
- **Asset nuovi da integrare** (vedi sezione dedicata sotto): crouch + sfondo parallax.

**1. GAMEPLAY — tarature (serve il PLAYTEST dell'utente, poco codice)**
- Tarare i numeri "sensati" mai collaudati dal vivo: durata Corsa, `vy` salto boss, cadenza terremoto,
  bilanciamento spawn, durata Assedio, cadenza gocce, prezzi shop, danni/durate élite e dei 3 eventi.
- Verificare dal vivo il tipo **Assedio** (mai giocato davvero). Volanti vs pedane: se si "incastrano",
  limitare la collisione alla sola picchiata.

**2. GAMEPLAY — contenuti/feature**
- **F.2b — arena dedicata per l'Assedio** (oggi riusa un livello normale col timer): design grosso, da
  pianificare a fondo prima.
- Più **varietà di nemici / varianti boss**; più **eventi/potenziamenti**.
- **Condotto a larghezza variabile → diventato ROUND 4 (terreno):** IN CORSO, vedi il blocco 🚧 in
  cima a questo backlog + `ROADMAP.md`. (I "rilievi/buche" a rettangolo del primo tentativo sono stati
  BOCCIATI dall'utente e sostituiti dal terreno a colline/cunette.)
- Altri **segreti/easter egg** (ce n'è uno: lo scrigno in alto).
- (da VERIFICARE nel codice) il boss dovrebbe droppare cure alla morte — controllare se già fatto.

**3. ESTETICA — uniformare al look di qualità (il fronte più grosso)**
- **Uniformare TUTTO** allo stile AI/pixel-art: oggi solo **sfondo** e **personaggio** sono di qualità;
  **nemici, armi, cumuli di cerume, timpano, pavimento, particelle, UI** stonano ancora.
- **Sprite + animazioni dei NEMICI** (immagine AI → AutoSprite → pixelate): farà **sparire le aureole
  élite** (oggi un ripiego); include strisciamento cerumino/gorgogliante, crosta "asciutta" diversa.
- **Posa d'attacco coordinata corpo+arma** del PG (braccio/testa seguono la mira): serve AutoSprite →
  **richiede abbonamento**. Oggi solo il layer "arma-in-mano".
- **Cerume più gooey**; **protuberanze** provvisorie da migliorare; **varianti sfondo** per livello;
  cerume "candela".
- Restyle coerente di **Shop / Upgrade / Pause / game-over** (il menu principale è già rifatto, bozza).
- **Icona app** personalizzata. Dettaglio: il PG che si sporca di cerume.
- _Pipeline arte (collaudata): l'utente genera su **Leonardo** (prompt scritti da me) → io ritaglio/
  scalo/pixelo/integro (`cutout_bg.ps1`, `scale_sprite.ps1`, `bake_sheet_pixel.ps1`); animazioni via
  **AutoSprite**, sheet in `assets/spritesheets/<entità>/`. Il procedurale-a-codice è stato bocciato._

### 🆕 Asset nuovi da integrare (l'utente li ha aggiunti, 2026-07-20)
- **CROUCH (animazione accovacciamento):** 36 frame PNG in
  `assets/spritesheets/hero/Nuova cartella/` (`Image1.png`..`Image36.png`), 708×1298, personaggio
  accovacciato su **sfondo NERO**. Da fare: (1) togliere il nero → trasparente (tipo `cutout_bg.ps1`,
  qui la chiave e' il nero puro), (2) montare i frame in UN spritesheet + pixelare/ridimensionare
  come le altre anim (`hero_*_px`), (3) caricarlo in `BootScene`, (4) agganciare l'anim quando
  `this.crouching` in `GameScene.update` (oggi c'e' solo uno "schiacciamento" segnaposto via scale).
  **Dubbi da chiedere all'utente:** 36 frame sono tanti per un accovacciamento — e' un CICLO (giu'→su)
  o una posa tenuta? Sostituire del tutto lo schiacciamento attuale?
- ✅ **SFONDO PARALLAX — FATTO 2026-07-20** (`be4eb3c`), ma per una strada diversa da quella
  ipotizzata qui: il primo tentativo (tagliare a mano i layer da UNA immagine e upscalarli con
  chainner) e' stato **abbandonato** — quei layer avevano solo 139-250px di altezza vera e a
  schermo venivano poltiglia. Ora si generano **3 immagini separate gia' grandi** con chiave
  magenta. Vedi §Cosa c'e' gia' e la memoria `earwaxwar-background-pipeline`.

**4. AUDIO**
- Musica: migliorata (acustica + boss punk) ma l'utente la trova ancora **un filo ripetitiva/asettica**
  → continuare a variare/arricchire dopo il suo riascolto.
- Effetti extra (AU-B.2); **boss infuriato = musica più intensa** (AU-D.3).

**5. TECNICO / PIATTAFORMA (per lo più rimandato dall'utente)**
- **Freeze PC allo Start Run** (aperto, deprioritizzato; NON è l'audio; indagare prima dello store).
- **Embed** degli sprite sheet in `assets_data.js` (per il doppio-click `file://`; l'APK li include già).
- Ottimizzare il **peso** degli asset (APK ~14MB, ok per ora).
- **Pubblicazione Play Store** + **ads** (AdMob): rimandati dall'utente a quando il gioco è rifinito.

---

## RISCHI / punti aperti da tenere d'occhio
- **FREEZE PC allo Start Run:** aperto e deprioritizzato (vedi §HOTFIX e Backlog gruppo 5). Non è
  l'audio; specifico del PC dell'utente. Da chiarire prima di puntare allo store.
- **Volanti vs pedane (`00ec955`):** pedane solide anche ai moscerini; se in playtest si "incastrano",
  limitare la collisione alla sola picchiata. I volanti NON collidono col cerume (`notFlyer` sul
  collider blocks) — decidere insieme (regola fisica coerente).
- **God-mode nasconde i bug di DANNO:** i due hotfix del 2026-07-18 sono sfuggiti in round 2 proprio
  per questo → per ogni blocco che tocca spawn/nemici/danni, fare anche ≥1 prova SENZA god-mode
  (vedi memoria `earwaxwar-sim-godmode`).
- **Manopole numeriche da tarare** e verifica dal vivo dell'Assedio: vedi Backlog gruppo 1.

---

## Convenzioni
- Commit in italiano; in fondo `Co-Authored-By:` col modello che ha fatto il lavoro
  (Opus per la pianificazione, Sonnet per l'esecuzione).
- Committare/pushare solo quando l'utente lo chiede (di solito a fine blocco).
- i18n: ogni nuova stringa in EN + IT (niente accenti nelle stringhe, il font pixel non li rende).
- God-mode nei test SEMPRE (vedi sopra), MAI lasciarlo nel codice committato.
- La memoria di progetto dettagliata è in `earwaxwar-backlog` (auto-memory dell'assistente).
