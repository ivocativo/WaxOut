# Earwax War — Handoff (nuova sessione)

> 📄 **A cosa serve questo file:** è il "punto della situazione" da leggere a INIZIO sessione
> (stato attuale, come collaudare, regole, rischi). Il **piano dettagliato del blocco di lavoro
> in corso** (con le caselle da spuntare) sta in **`ROADMAP.md`**. La descrizione del gioco per
> chiunque lo trovi sta in **`README.md`**. Regola d'oro: ogni informazione ha UNA casa sola,
> niente sezioni duplicate tra i tre file.

_Ultimo aggiornamento: 2026-07-30 · Ultimo commit pushato: `69244e3`._
_**Fatti e pushati:** Round 1 e 2 (correzioni playtest, fino a `75df562`); Round 3 AUDIO (synth +_
_3 atmosfere, boss punk); **APP ANDROID via GitHub Actions**; **Round 4 — CONDOTTO/TERRENO:**_
_soffitto ondulato + **TERRENO stile Terraria** (colline e cunette) percorso via "mappa di altezze";_
_**Round 5 — SFONDO** a 3 strati pittorici a set (`be4eb3c`)._
_**✅ ESTETICA UNIFICATA (2026-07-21/22):** terreno e soffitto (`50329e1`), pedane (`31f6b3d`) e_
_pozza scivolosa (`145e0ea`) ridisegnati VIA CODICE come massa di tessuto, in tinta col fondale._
_Nel codice non resta piu' nessun colore della vecchia palette marrone/senape._
_**✅ RETE DI SICUREZZA:** `python tools\controlla.py` — 66 controlli automatici (§sotto)._
_**✅ Bug risolti:** cerume sul terreno (`d6e50cd`); cerume e nemici che tornavano al livello piatto_
_dopo un colpo (`ae6abd4`); **salto morto nelle cunette** (`676cf35`); **pedane ancorate alla quota_
_fissa** — sepolte nelle colline o irraggiungibili; **nemici che nascevano dentro il cerume** e_
_**nemici che sprofondavano comparendo** (`145e0ea`, `5bee03d`). Diversi trovati DAI controlli._
_**✅ BLOCCO A COMPLETO:** la run ha un FINALE (15 livelli → `VictoryScene`, prima si poteva solo_
_morire) e una **scelta tra due porte** sicura/rischiosa prima di ogni livello non-boss (`db4c1eb`,_
_Sonnet); **difficoltà "Infezione"** 0–5 sbloccata dalla vittoria (`f59befd`); **boss FINALE** con_
_più vita e una terza fase "crollo" — frana di cerume dal soffitto (`7eff829`). Dettaglio in `ROADMAP.md`._
_**✅ BLOCCO B COMPLETO:** timpano (`ae123a9`) e tutti e 7 i **nemici** (`4a135cd`) ora sono immagini_
_AI su fondo magenta, stile organico/gore, scontornate con `tools/bake_sprite.ps1`. Sorgenti in_
_`art_sources/` (fuori dall'APK), baked in `assets/`. Restano rimandati: aureole elite da togliere,_
_ANIMAZIONI dei nemici (servirebbe AutoSprite — **l'utente le ha chieste al playtest**)._
_**✅ BLOCCO D COMPLETO — playtest round 3 (2026-07-25/27):** nemici che cadevano sotto il suolo +_
_pozze nei punti angolosi (`8c397ae`); **giro difficolta'** — meno nemici insieme, **salto sui nemici**_
_alla Mario, invulnerabilita' dopo il colpo 0,9→1,2s (`59dab7e`); **Corsa** con countdown 3-2-1-VIA,_
_piu' tempo e molto meno frequente (`2ff0337`); **crash musica sul telefono** — nodi audio mai_
_liberati, ora si autodistruggono + musica sospesa a schermo spento (`5527c96`); **4 modificatori_
_nuovi** (11 in tutto) + carta **Getto Potente** (`6a5dc76`); **porta piu' chiara** a tre sezioni_
_OBIETTIVO / REGOLA SPECIALE / PREMIO (`d48b2f6`). Dettaglio in `ROADMAP.md` §BLOCCO D._
_**✅ Dopo il round 3:** **timpano incastonato** nella carne (`918725d`); **cerumino ANIMATO**, primo_
_nemico con spritesheet, animato dall'utente con Claude Design + nuovo `tools/bake_sheet.py`_
_(`6b4886c`); **salto sui nemici che rimbalza al contatto** e non piu' 48px per aria (`519bdb1`)._
_**✅ ARSENALE (2026-07-27):** 5 **kit** di armi (mischia + getto insieme) che si sbloccano al negozio_
_e si scelgono a inizio run — nuova `ArmiScene`, terzo pulsante nel menu. Manca solo l'ARTE._
_**✅ GIRO IN AUTONOMIA (2026-07-27, `3b72dbb`):** aureole elite tolte (ora e' il NEMICO a cambiare_
_colore); elite dal livello 6 e non piu' dal 3; Fuggitivo Dorato di nuovo riconoscibile (oro quasi_
_bianco + scia di scintille); **UN BOSS PER TRATTO DI 5 LIVELLI** — nuova **Regina delle Croste**_
_al 10 (corazzata contro il getto, carica invece di saltare, chiama croste); **restyle di TUTTE le_
_schermate di contorno** con un linguaggio unico in `GameGfx` (paintSceneBg/panel/sceneTitle/_
_uiButton); **app da 23 a ~10 MB** (protuberanze non piu' caricate + elenco esplicito nel workflow)._
_**✅ MUSICA** a brani veri CC0 (`27463ae`) + **CREDITI** nel pannello "?" (`6b300bf`)._
_**✅ PLAYTEST ROUND 4 (2026-07-29, `238d6af`): 19 segnalazioni chiuse** — proiettili che_
_attraversavano le colline, cronometro che non si fermava in pausa, pannello del game over fuori_
_schermo, assedio che smetteva di generare nemici, cerume che sbucava dal soffitto, pedane_
_irraggiungibili, elite che perdevano il colore, boss attraversabili col salto, cartelli che_
_dicevano sempre "Tappo di Cerume", carta di potenziamento al 15o livello. Piu' il giro di_
_BILANCIAMENTO (danno PG x1,5, vita cerume e nemici x0,8, meno membrane dal livello 8)._
_**✅ ARSENALE CHIUSO** (decisione dell'utente dopo il playtest): si pubblica col kit unico._
_**✅ TUTTI E OTTO I NEMICI ANIMATI** (`6b300bf`, `7f05bde`, `69244e3`): non resta piu' nessuna_
_immagine ferma. Il saltatore ha un SALTO legato ai suoi stati, non una camminata._
_**✅ ARMI DISEGNATE (2026-07-31):** coton fioc e spruzzino sono immagini vere. **Nel gioco non_
_resta piu' nessuna texture disegnata a codice.** Nello stesso giro: il RIMBALZO dei proiettili_
_ora funziona anche sulle colline (si specchia sulla perpendicolare del pendio, non piu'_
_invertendo la sola velocita' verticale) e la COMPARSA dei nemici dura ~1s in due tempi —_
_il pavimento si gonfia, poi la creatura ne esce coi piedi a terra._
_**✅ ACCOVACCIAMENTO (2026-07-31):** era fermo dal 20 luglio in attesa di due risposte, che si_
_sono risolte guardando disegni e codice. **6 frame dei 36** (a 60fps un accovacciamento di 180ms_
_ne regge 11 in tutto), piu' la CAMMINATA accovacciata a 8 fotogrammi presi dal video._
_Nuovo `tools/bake_hero_sheet.py`. Vedi §Asset nuovi._
_**STATO ORA:** restano gli **EASTER EGG** da scegliere e il **BLOCCO C** (Assedio: la tattica_
_del cumulo-rifugio). Poi si va allo STORE._

**NOME:** l'utente ha scelto **WAXOUT** (2026-07-27) al posto di "Earwax War": "earwax" da solo
porta al party game di Jackbox e a Earwax Clinic gia' su Play. Il nome NON e' ancora stato
applicato al codice — vedi `ROADMAP.md` §N. Cartella e repository restano `earwaxwar`.

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

## ✅ CONTROLLI AUTOMATICI (dal 2026-07-21) — lanciarli PRIMA di ogni commit

```
python tools\controlla.py
```
66 controlli in ~3m. Apre il gioco in un browser invisibile (Playwright), inietta
`tools/checks.js` ed esce con codice 1 se qualcosa e' rotto. **Ogni controllo nasce da un bug
realmente successo** (e' annotato nel file quale): cerume sospeso sul terreno, salto morto nelle
cunette, nemici sotto il pavimento o incastrati nelle membrane, pedane irraggiungibili o sepolte,
volanti bloccati, spawn addosso al giocatore, boss incollato a terra, condotto non attraversabile,
piu' una passata **senza god-mode** (col god-mode acceso i bug di DANNO restano invisibili).

Serve una tantum: `python -m pip install playwright` e `python -m playwright install chromium`
(gia' fatto su questo PC; Node NON e' installato, Python 3.12 si').

**Schermate senza aprire finestre:** `python tools\schermata.py [livello] [x] [file.png]` salva un
fotogramma del gioco (predefinito: `schermata.png` nella cartella del gioco, gia' in .gitignore).
Serve a giudicare l'aspetto ed e' il RIPIEGO quando il pannello del preview si impunta — successo.

Quando un controllo fallisce: **prima capire se e' rotto il gioco o il controllo.** E' successo 3
volte su 3 al primo giro — il boss "non saltava" solo perche' il test non gli avvicinava mai il
giocatore. Verificare il caso a mano in preview prima di toccare il gioco.

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

## 🎛️ PANNELLO DI TARATURA (dal 2026-07-27) — per far tarare i numeri all'UTENTE

Pulsantino **TARATURA** in basso a sinistra nel MENU e in basso a destra nella PAUSA. Apre un
pannello con dieci manopole (nemici insieme, velocita'/danno/vita nemici, vita e danno del PG,
tempo della Corsa, cerume raccolto, spinta del rimbalzo, fps della strisciata del cerumino) piu'
vita infinita, **sblocca tutte le armi** e +3000 cerume. I valori stanno in `src/taratura.js`
(moltiplicatori, 1 = gioco normale, salvati in localStorage) e il gioco li legge in `newPlayer`,
`applyInfezione`, `maxEnemies`, `startRushCountdown`, `stompEnemy`, `hurtPlayer`.

**Perche' esiste:** il giro "l'utente prova → me lo scrive → cambio un numero → ricompilo l'APK →
riprova" costava mezz'ora per singolo valore. Ora i numeri li gira lui mentre gioca.

⚠️ **DA TOGLIERE PRIMA DI PUBBLICARE** (da' vita infinita e cerume gratis): bastano il pulsante in
`MenuScene`/`PauseScene` e la scena `TaraturaScene`. Nel menu il pulsante si accende in rosso con
un `*` se una manopola e' stata girata — se no ci si dimentica e si giudica il gioco coi numeri finti.

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
- `src/scenes/GameScene.js` — cuore del gioco (~3500 righe): build livello, spawn nemici, IA,
  combattimento, abilità, mutatori, tipi di livello, gocce, élite, **eventi casuali**, update loop.
  **Personaggio animato:** `this.player` (fisica) reso invisibile + `this.heroVisual` (sprite animato che
  lo segue, scala `HERO_SCALE`, origin `HERO_ORIGIN_Y`, riceve il juice); anim per stato in `update()`.
- `src/scenes/UpgradeScene.js` — carte di fine livello (pool `ALL` + evoluzioni + **rarità** + filtro).
  Decide anche dove si va dopo: `VictoryScene` al livello `RUN_LEVELS`, `GameScene` diretta se il
  prossimo è un boss, altrimenti `DoorScene`.
- `src/scenes/DoorScene.js` — la **scelta tra due porte** (sicura/rischiosa) prima di ogni livello
  non-boss; scrive `GameState.prossimoLivello`, che `GameScene.create` legge e consuma.
- `src/scenes/VictoryScene.js` — fine run vinta (riepilogo + grado Infezione sbloccato).
- `src/scenes/ShopScene.js` — negozio (2 colonne: Potenziamenti + Progetti) + pulsante reset.
- `src/scenes/MenuScene.js` / `PauseScene.js` — menu e pausa. `src/scenes/BootScene.js` — carica gli
  sprite PNG (assets: personaggio, **7 nemici**, timpano), gli **sprite sheet animati del personaggio**
  (`hero_walk`/`hero_run`/`hero_idle`/`hero_jump`, frame 84) e **le due armi**
  (`assets/sprites/weapons/`). Dal 2026-07-31 non resta nessuna texture di gioco disegnata a
  codice: sopravvive solo `PA.hammer`, per il kit dormiente dell'arsenale.
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
  `tools/` — script PowerShell: **`bake_sprite.ps1`** (LA pipeline di oggi per un singolo sprite AI:
  ridimensiona + scontorna il magenta + posterizza + rifila; la chiave prende magenta puro E rosa
  acceso, perché una generazione usava rosa), `bake_background_set.ps1` (i 3 strati di sfondo),
  `cutout_bg.ps1` (sfondo trasparente), `scale_sprite.ps1`, `bake_sheet_pixel.ps1` (pixelate),
  + serve LAN / embed assets. (`gen_hero*.ps1` = esperimento procedurale SCARTATO, file non
  committati, lasciati solo come riferimento.)

---

## Cosa c'è già (sistemi principali)
- **Combattimento:** attacco unico "intelligente" (mazza da vicino / getto da lontano),
  hit-stop + shake, salto ad altezza variabile + coyote/buffer, accovacciamento, scatto,
  **salto sui nemici** alla Mario (rimbalzo + ricarica salto + danno; `stompEnemy` in GameScene).
  ⚠️ Lo stomp va rilevato **PRIMA** dell'aggancio al terreno in `update()`, altrimenti lo snap
  risucchia il PG a terra attraverso il nemico e il contatto non avviene mai.
- **Movimento:** accelerazione/decelerazione morbida (a terra `MOVE_ACCEL_GROUND` 0.3, in aria
  `MOVE_ACCEL_AIR` 0.15); lo scatto resta istantaneo. **Juice procedurale**: il PG si schiaccia/
  allunga a salto/atterraggio/inversione/colpo (`JUICE_*` in `state.js`, `jx`/`jy` + `setJuice` in GameScene).
- **Carattere comico:** fumetto con battute a inizio livello/uccisione/colpo/boss (`SPEECH` in
  `state.js`, `speech_*` in i18n; `maybeSpeech`/`showSpeech` in GameScene, `GameGfx.showSpeech` per il rendering).
- **SPORCARSI DI CERUME (2026-07-31, idea dell'utente):** nel corpo a corpo lo schizzo torna
  addosso e il personaggio si insozza (`sporcati`/`posizionaMacchie` in GameScene, tetto
  `GameScene.MACCHIE_MAX` = 10). **Solo estetica**, deciso con l'utente: non tocca velocita', mira
  ne' danno. Una macchia ogni due colpi andati a segno (misurato: 10 macchie in ~31 bastonate,
  cioe' un livello), e si riparte puliti al livello dopo — lo stesso momento in cui viene
  restituita un po' di vita. Non serve arte: sono ellissi nei colori del cerume che si ricordano
  dove stanno RISPETTO al corpo e lo seguono, come il vestito animato e l'arma in mano.
  Tre cose imparate facendolo, tutte visibili solo a schermo:
  (1) la posizione NON si puo' indovinare con un rettangolo — la sagoma e' stretta in cima e larga
  in mezzo, e le macchie finivano per aria di fianco al PG. Ora si sorteggia un punto e si chiede
  a `textures.getPixelAlpha()` se e' corpo, riprovando se e' vuoto: funziona da solo anche se un
  domani il personaggio viene ridisegnato;
  (2) vanno SPECCHIATE col verso, se no una macchia sul petto finisce sulla schiena appena ti giri;
  (3) vanno ALZATE quando ci si accovaccia (il disegno accovacciato e' 51px invece di 62), se no
  restano sospese sopra la testa.
  Colori del cerume, mai verso il rosso: il PG lampeggia quando incassa, e le macchie non devono
  confondersi con quel segnale. Controllo automatico [25].
  💡 Sblocca anche l'**icona dell'app**, che in lista aveva gia' annotata l'idea "il personaggio
  che si sporca di cerume": ora e' un fotogramma vero del gioco, non un disegno inventato.
- **Personaggio (grafica/animazione, dal 2026-07-12/13):** esploratore da **immagine AI** (Leonardo),
  **animato** con **AutoSprite**: idle/camminata/corsa/salto (sprite sheet in `assets/spritesheets/hero/`,
  pixellati). Fisica/hitbox invariati (`this.player` invisibile, `this.heroVisual` segue). **Attacco:**
  prototipo **arma-in-mano** (`this.heroWeapon`, layer separato e intercambiabile via tabella `WEAPONS`) —
  a distanza punta la mira, corpo a corpo rotea; il braccio/testa del corpo NON seguono (serve una posa
  dedicata per quello, rimandata). Dal 2026-07-31 le due armi sono **immagini disegnate**, non piu'
  texture generate a codice: nella tabella `WEAPONS` l'`origin` e' il punto dell'immagine dove sta
  la MANO (cioe' il perno della rotazione) e `scale` 0,5 perche' sono baked a doppia risoluzione.
  (Il vecchio doppione del coton fioc — `GameGfx.showWeaponSwing` attivo insieme al layer — non
  c'e' piu'.)
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
- **ARSENALE (dal 2026-07-27):** 5 **kit** di armi (`window.ARMI` in `state.js`) che cambiano INSIEME
  il corpo a corpo e il getto — il tasto d'attacco e' uno solo e sceglie da se' in base alla distanza,
  quindi due mezze armi separate non si sentirebbero. Si sbloccano col cerume in banca e si sceglie
  quale portarsi a ogni run (`ArmiScene`, terzo pulsante del menu). Lo sblocco vive in
  `Meta.unlocks['arma_<id>']`, la scelta in `Meta.arma`. I danni nei kit sono MOLTIPLICATORI applicati
  dopo i potenziamenti del negozio, cosi' il carattere dell'arma si sente a ogni punto della
  progressione. ⚠️ Un kit tocca TRE punti lontani (`newPlayer`, `meleeSwing`, `spawnPellet`): il
  controllo automatico [19] verifica che il kit scelto arrivi davvero in tutti e tre.
- **Varietà livelli:** tipi (normale / corsa / assedio / boss / sciame) + **11 modificatori**
  (`MUTATORS`: fretta, orda, corazza, poca gravità, cuccagna, cerume ostinato, terremoto, cristallo,
  frenesia, furia, cerume di ferro) + **eventi casuali** (`EVENTS`, ~25%, indipendenti dai
  mutatori): Fuggitivo Dorato, Frana di cerume, Sciame improvviso.
  La **porta** (`DoorScene`) mostra la scelta in tre sezioni etichettate — OBIETTIVO (tipo di livello
  + cosa fare), REGOLA SPECIALE (il modificatore, nel colore del suo banner), PREMIO. `bonanza` e
  `ironwax` sono esclusi dal pool della porta: toccano il moltiplicatore cerume e renderebbero
  bugiarda l'anteprima "cerume ×2".
- **Ostacoli:** pozze scivolose + gocce dal soffitto. Membrane di cerume con fisica a celle (collasso).
- **Terreno, soffitto, pedane, pozze (dal 2026-07-21, VIA CODICE — nessun asset):**
  `GameGfx.paintOrganicMass` disegna terreno e soffitto come sezione di tessuto (massa quasi buia
  in profondita', velature di crosta satura verso la superficie, filo di luce sul bordo);
  `paintLedge` fa le pedane a mensola (piano d'appoggio illuminato, sottopancia scuro);
  `paintSlick` la pozza scivolosa come patina verde-acqua che SEGUE il profilo del terreno.
  Tavolozza condivisa in `GameGfx.CARNE`. ⚠️ Tutto questo e' solo ASPETTO: forma e collisione
  restano quelle del gameplay. Trappole gia' pagate, annotate nel codice: tinte piene sovrapposte
  = gradini visibili (servono velature trasparenti); sfumatura troppo profonda = tinta unita
  slavata (il buio deve entrare nei ~180px visibili); confine interno dritto = sembra una fascia
  dipinta sopra (deve ondeggiare). Il verde-acqua della pozza non e' un vezzo: il senape di prima
  si confondeva col cerume da raccogliere.
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

### Correzioni playtest — TRE GIRI CHIUSI ✅
Round 1 (21 segnalazioni) e Round 2 (15 segnalazioni) completati e pushati (fino a `75df562`); il
dettaglio è nella **cronologia git**. **Round 3** (2026-07-25, dopo Blocco A + nemici nuovi) chiuso
come **BLOCCO D** in `ROADMAP.md` — bug, giro difficoltà, Corsa, crash musica, più modificatori,
porta più chiara. **Prossimo passo su questo fronte:** round 4 di playtest per tarare i numeri
(densità nemici, forza del salto sui nemici, durata Corsa) e giudicare le parti soggettive.
Segnalazioni del round 3 **non ancora chiuse**: timpano scollegato (prossimo lavoro) e spritesheet
animati per i nemici (serve AutoSprite).

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
**✅ CRASH SUL TELEFONO RISOLTO (2026-07-26, `5527c96`):** la musica bloccava il gioco dopo qualche
minuto. Causa: **accumulo di nodi audio** — ogni nota creava oscillatore/filtro/gain che non venivano
mai scollegati. Ora `cleanupOnEnd` li scollega su `onended` (~96% liberati, prima ~0%). Aggiunta anche
la **sospensione a schermo spento** (`visibilitychange` → `ctx.suspend`, lo scheduler non lavora
mentre e' sospesa) e la ripresa al ritorno / al primo tocco.
**⚠️ L'utente vuole RIFARE musica ED effetti da capo** (detto il 2026-07-26): il synth attuale e'
materiale di passaggio, **non investirci altro tempo** oltre alle correzioni di stabilita'.

### ✅ APP ANDROID (Capacitor via GitHub Actions) — FATTA (2026-07-18)
Il gioco si impacchetta in APK **nel cloud** (nessuno strumento locale): `package.json` +
`capacitor.config.json` (webDir=www) + workflow `.github/workflows/build-android.yml`. Ciclo: push su
main → GitHub compila → `gh run download` scarica l'APK → messo in `EarwaxWar.apk` (root, gitignored) →
l'utente lo prende dal telefono via `GIOCA-SU-TELEFONO.cmd` (`http://<IP>:8123/EarwaxWar.apk`) e lo
installa. **Larghezza ADATTIVA** (main.js) → niente bande nere ai lati. L'app parte e gira sul telefono.
Resta: **icona app personalizzata** (ora generica), e la pubblicazione vera sullo store (rimandata).

### 📦 APK da SFOLTIRE (misurato 2026-07-22, non urgente ma cresce)
L'APK e' passato da 14 a **22 MB** e **~8 MB sono sprecati**: il workflow fa `cp -r assets www/`,
cioe' copia TUTTA la cartella senza distinguere il materiale di LAVORAZIONE da quello di GIOCO.
Dentro l'APK finiscono: le immagini sorgente degli sfondi (`fondale.png`, `mid.png`,
`primo piano.png` = 5,4 MB, servono solo a ri-generare gli asset), le **protuberanze** (1,8 MB, oggi
disattivate ma ancora CARICATE da BootScene — sprecano anche memoria sul telefono) e
`bg_flesh_01.jpg` (0,9 MB, si usa solo la sua versione lavorata). Con altri set di sfondo il
problema cresce. Idea: una convenzione per il materiale di lavorazione (es. non copiare i file
sorgente dei set) invece di una lista di esclusioni fragile.

---

## 🎯 Principi di design (ricerca sulle best practice del genere, 2026-07-22)
Sintesi filtrata su QUESTO gioco: non ripetere l'analisi, è già stata fatta. Fonti in fondo.

**Cosa il gioco fa già bene** (confermato dalle fonti, non toccarlo per "migliorarlo"): scelta tra
3 carte con rarità, evoluzioni che fondono abilità, progressione permanente (banca → potenziamenti
e progetti), varietà di livelli/mutatori/eventi, e soprattutto il **game feel** (hit-stop, coyote
time, salto ad altezza variabile, juice) — che le fonti indicano come la base non negoziabile.

**I tre buchi individuati**, in ordine di importanza:
1. **La run non finisce mai.** `UpgradeScene` fa `level += 1` senza limite: si può solo morire, mai
   vincere. Le fonti: una run ha bisogno di una conclusione (troppo corta = nessuna soddisfazione,
   infinita = tedio). Senza vittoria è anche impossibile la meccanica di ritenzione più forte del
   genere: la **difficoltà crescente che il giocatore sceglie dopo aver vinto** (il "Calore" di
   Hades, le Ascensioni di Slay the Spire) — è ciò che trasforma 5 ore di gioco in 50. → BLOCCO A.
2. **Nessuna scelta di percorso.** Il tipo di livello è deciso da `levelNum % 5`: il giocatore non
   decide mai niente tra un livello e l'altro. La lezione di Dead Cells sono le **due porte**
   ("veloce ma fragile" contro "sicuro ma lento"): stessa roba che c'è già, ma **scelta** invece che
   sorteggiata. Miglior rapporto impatto/lavoro di tutta l'analisi. → BLOCCO A.3.
3. **Un solo personaggio, una sola arma.** Nelle fonti la varietà all'AVVIO (personaggi o armi con
   partenze diverse) è ciò che spinge a rigiocare per *provare*, non solo per progredire. Il sistema
   dell'arma-in-mano intercambiabile esiste già: 2-3 armi con feel diverso moltiplicano le run senza
   toccare i livelli. → non ancora pianificato, candidato naturale dopo il BLOCCO A.

**Quasi gratis:** nel negozio mostrare anche ciò che NON ci si può ancora permettere, con nome e
prezzo. Vedere l'oggetto desiderato poco sopra le proprie possibilità è letteralmente il gancio
dell'"ancora una partita".

**Da NON fare adesso** (da giochi maturi, ruberebbero tempo ai punti sopra): run giornaliere,
obiettivi, statistiche, classifiche.

**Numero da misurare:** quanto dura una run. Riferimento delle fonti: **20-30 minuti**, meno su
telefono. Lo può misurare solo l'utente giocando, e da lì si tara `CONFIG.RUN_LEVELS`.

_Fonti: [Bugnet, meta-progression](https://bugnet.io/blog/how-to-design-a-roguelite-meta-progression) ·_
_[Kokutech, Dead Cells](https://www.kokutech.com/blog/gamedev/design-patterns/flow-state/dead-cells) ·_
_[Medium, "one hour roguelite"](https://medium.com/game-marketing/essay-the-one-hour-roguelite-404e73d0afa9) ·_
_[Medium, lunghezza della run](https://medium.com/@todorovicnik2/video-games-roguelite-restart-length-of-a-perfect-run-ef8078c76495) ·_
_[Kokutech, Vampire Survivors](https://www.kokutech.com/blog/gamedev/design-patterns/power-fantasy/vampire-survivors)_

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
- **Uniformare TUTTO** allo stile AI/pixel-art: sfondo, personaggio, terreno/soffitto/pedane,
  **nemici** e **timpano** sono a posto; stonano ancora **armi, cumuli di cerume, particelle, UI**.
- ⭐ **TIMPANO SCOLLEGATO** (playtest 2026-07-25): l'immagine c'è ed è bella, ma "galleggia" invece
  di essere incastonata nella carne. Piano concordato: cornice di carne via codice (tavolozza
  `GameGfx.CARNE`) + vasi che continuano verso terreno e soffitto. **Prossimo lavoro.**
- **ANIMAZIONI dei NEMICI**: fatto il cerumino (Claude Design + `tools/bake_sheet.py`), mancano
  gli altri 6. ✅ Le **aureole élite sono gia' sparite** (2026-07-27): ora e' il nemico a cambiare
  colore (`GameScene.ELITE_TINT`).
- ⭐ **ARMI del PG — manca solo l'ARTE.** Le meccaniche sono fatte (vedi `ROADMAP.md` §APERTI):
  5 kit nell'ARSENALE. Ma tutti usano ancora le vecchie texture disegnate a codice, ripetute:
  servono i 5 disegni veri (prompt → l'utente genera → `bake_sprite.ps1` → voce nella tabella
  `WEAPONS` di `GameScene`). Da fare DOPO il playtest, per disegnare solo i kit che restano.
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
- ✅ **CROUCH — FATTO (2026-07-31).** I due dubbi si sono risolti guardando i disegni e il codice,
  senza doverli girare all'utente: **e' una posa tenuta**, non un ciclo (i 36 frame vanno in una
  direzione sola, in piedi → accovacciato, e non tornano su — per rialzarsi basta rileggerli al
  contrario, `anims.playReverse`); e **non sostituisce nulla**, perche' lo "schiacciamento" di
  prima era solo sulla SAGOMA invisibile (gameplay: decide se passi sotto un soffitto basso) e il
  disegno restava dritto.
  **Solo 6 frame** dei 36: a 60 fotogrammi al secondo un accovacciamento di 180ms ha spazio per 11
  immagini in tutto, i primi 7 disegni valevano lo 0,8% della discesa e gli ultimi due erano
  identici. Scelti campionando il MOVIMENTO (1,17,21,26,30,35), con le distanze che si accorciano
  verso il fondo: scende di slancio e si assesta.
  Nuovo strumento **`tools/bake_hero_sheet.py`** (i frame arrivano su fondo nero, non trasparenti
  come quelli dei nemici, e vanno registrati sul rig del personaggio: celle 84×84, corpo 62px,
  piedi al 86% — se no il personaggio "salta" al cambio di animazione). ⚠️ posterizzare a **6
  livelli**, la tavolozza del personaggio e' a multipli di 51: con 22 il costume veniva piu' chiaro
  degli altri e si vedeva il cambio. Controllo automatico [23].
  **Limite noto e accettato con l'utente:** il disegno si abbassa al 82% della statura, la sagoma
  al 68% — il personaggio passa sotto pertugi in cui a occhio non ci starebbe. Alzare la sagoma
  renderebbe impraticabili passaggi gia' collaudati.
- ✅ **CAMMINATA ACCOVACCIATA — FATTA (2026-07-31).** 8 fotogrammi presi dal VIDEO
  `assets/spritesheets/hero/crouch move/crouch move.mp4` (i numeri 74,78,81,85,88,92,95,99 sono un
  ciclo intero: misurando l'apertura delle gambe lungo il video si vede un passo ogni ~14
  fotogrammi, quindi il ciclo ne dura 28).
  **Dal VIDEO e non da pose singole**, ed e' la lezione da ricordare: i fotogrammi di un video
  vengono tutti dalla stessa generazione, quindi inquadratura, scala, colori e proporzioni
  combaciano gia'. Le due pose che l'utente aveva generato una per una (restano in
  `assets/spritesheets/hero/crouch walk/`, non usate) avevano richiesto un metro inventato
  apposta (il casco), un riallineamento dei colori — saturazione 110 contro 61, si vedeva
  lampeggiare — e restava comunque la testa disegnata piu' grossa.
  ⚠️ Lo scontorno delle REGISTRAZIONI DI SCHERMO e' un altro mestiere e ha il suo metodo in
  `scontorna_registrazione()`: il fondo non e' nero ma il grigio dell'interfaccia (~30,31,34)
  mentre i contorni del personaggio sono quasi neri, la registrazione ha una FILIGRANA che
  sopravvive, e l'interno dell'ansa del tubo e' un buco CHIUSO che una macchia d'olio dai bordi
  non raggiunge mai (restava un grumo scuro dietro la schiena).
  **12 fotogrammi al secondo non e' un gusto:** accovacciati si va a 99 px/s (220 x 0,45) e il
  passo disegnato copre ~30px, quindi un ciclo vale ~60px di terreno = ~0,6s. Piu' lenta e i
  piedi slittano. Controllo automatico [24], che copre anche il ritorno alla posa ferma — il
  passaggio delicato, perche' rilanciare l'animazione della discesa farebbe rialzare e
  riabbassare il personaggio.
  **Limite noto:** nemmeno il video scambia le gambe (stessa gamba sempre avanti). A 50px le due
  gambe sono lo stesso disegno, quindi quello che si legge e' l'alternanza aperto/chiuso, che c'e'.
- ✅ **SFONDO PARALLAX — FATTO 2026-07-20** (`be4eb3c`), ma per una strada diversa da quella
  ipotizzata qui: il primo tentativo (tagliare a mano i layer da UNA immagine e upscalarli con
  chainner) e' stato **abbandonato** — quei layer avevano solo 139-250px di altezza vera e a
  schermo venivano poltiglia. Ora si generano **3 immagini separate gia' grandi** con chiave
  magenta. Vedi §Cosa c'e' gia' e la memoria `earwaxwar-background-pipeline`.

**4. AUDIO**
- ✅ **MUSICA: FATTA (2026-07-28).** Quattro brani **CC0** scelti dall'utente, in `assets/musica/`
  (menu/livello/boss/vittoria, 4,4 MB in tutto). Preparati con `tools/bake_musica.py` (OGG +
  normalizzazione del volume + tagli). Suonano dallo STESSO AudioContext degli effetti, non dal
  gestore audio di Phaser: cosi' ereditano volume, pulsante musica, dissolvenze e sospensione a
  schermo spento senza codice nuovo. Se un file manca, riparte il synth di prima.
  **Fonti tracciate** in `assets/musica/FONTI.md` (tutte da OpenGameArt, abbinate confrontando le
  durate: corrispondenza al centesimo di secondo). Tutte e quattro **CC0 verificate**
  sulla scheda. ⚠️ L'autore del brano del menu chiede comunque di essere citato: serve una piccola
  sezione CREDITI prima di pubblicare (vedi `ROADMAP.md`).
- **EFFETTI sonori:** restano il synth procedurale, da rivedere insieme all'utente.
- Effetti extra (AU-B.2); **boss infuriato = musica più intensa** (AU-D.3) — solo se si tiene il synth.

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
