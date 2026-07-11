# Earwax War — Handoff (nuova sessione)

> 📄 **A cosa serve questo file:** è il "punto della situazione" da leggere a INIZIO sessione
> (stato attuale, come collaudare, regole, rischi). Il **piano dettagliato del blocco di lavoro
> in corso** (con le caselle da spuntare) sta in **`ROADMAP.md`**. La descrizione del gioco per
> chiunque lo trovi sta in **`README.md`**. Regola d'oro: ogni informazione ha UNA casa sola,
> niente sezioni duplicate tra i tre file.

_Ultimo aggiornamento: 2026-07-11 · Ultimo commit: `f0f2273` (rarità carte + primi 2 eventi)._
_In attesa di commit: evento **Sciame improvviso** (2B.3, fatto e verificato) + questo riordino dei `.md`._

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

## ⚠️ COLLAUDO: cosa è verificato e cosa no

**Il preview nel browser NON mostra l'immagine** (la scheda risulta "nascosta/senza focus", il
browser sospende il ciclo di animazione → screenshot e click vanno in timeout). Il gioco però
**non è rotto**: il codice gira. Vedi sotto la **tecnica che funziona** (pompare il loop a mano)
per collaudare tutta la LOGICA senza vederla.

Quindi la distinzione da tenere a mente:
- **Logica verificata** (assegnazioni, conteggi, danni, tempi, niente crash): fatta con la
  tecnica del loop-pumping in questa sessione per SPLIT, rarità carte, i 3 eventi.
- **Aspetto e "sensazione" (feel) NON verificati**: colori a schermo, leggibilità, come si
  "sente" giocare → **serve il playtest dell'utente sul telefono**.

### Ancora da far playtestare sul telefono all'utente (dal più vecchio)
Arretrato mai provato dal vivo (verificato solo staticamente in sessioni precedenti):
- `5a52325`→`00ec955` — gocce dal soffitto, mutatori, tipi di livello (corsa/**assedio**),
  varianti élite Corazzato/Esplosivo, reset progressi, vari fix.
Lavoro nuovo di questa sessione (logica ok, feel/aspetto da provare):
- `c0d6bdc` — élite **SPLIT** (si sdoppia in 2 figli alla morte).
- `f0f2273` — **rarità carte** (comune/rara/leggendaria colorate) + eventi **Fuggitivo Dorato**
  e **Frana di cerume**.
- (non ancora committato) — evento **Sciame improvviso**.

---

## Come provare il gioco

**Preview per l'assistente:** `preview_start` con config `earwaxwar-8124` (porta 8124) da
`.claude/launch.json`. Il RENDER visivo è indisponibile (vedi sopra), ma si collauda la logica
così — **pompando il loop a mano** e interrogando lo stato con `javascript_tool`:
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
- `src/scenes/UpgradeScene.js` — carte di fine livello (pool `ALL` + evoluzioni + **rarità** + filtro).
- `src/scenes/ShopScene.js` — negozio (2 colonne: Potenziamenti + Progetti) + pulsante reset.
- `src/scenes/MenuScene.js` / `PauseScene.js` — menu e pausa. `src/scenes/BootScene.js` — carica gli
  sprite PNG (assets) e genera via codice le texture non ancora ridisegnate.
- `src/gfx.js` (`GameGfx`) — SOLO rendering (sfondo, cerume, splat, `showBanner`, ecc.). Tenere
  grafica separata dal gameplay: sessione "grafica" tocca gfx.js, "gameplay" GameScene.js.
- `src/i18n.js` — dizionario EN (default) + IT. Ogni stringa passa da `I18n.t('chiave')`.
- `src/touch.js` — comandi touch (stick analogico + tasti). `src/sfx.js` — audio procedurale.
- `assets/` — sprite/immagini (incorporati come data-URI in `sprites_data.js`/`assets_data.js`
  per girare da `file://`). `tools/` — script PowerShell (serve LAN, embed assets, ecc.).

---

## Cosa c'è già (sistemi principali)
- **Combattimento:** attacco unico "intelligente" (mazza da vicino / getto da lontano),
  hit-stop + shake, salto ad altezza variabile + coyote/buffer, accovacciamento, scatto.
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
Il piano dettagliato del blocco in corso è in **`ROADMAP.md`** (con le caselle spuntate). In sintesi:
- **Fase 1 — élite SPLIT** ✅ fatto (`c0d6bdc`).
- **Fase 2 — rarità carte + 3 eventi casuali** ✅ fatto (rarità+2 eventi in `f0f2273`; Sciame da committare).
- **Fase 3 — game feel (accel/decel del movimento)** ⏳ prossima. Il movimento usa `setVelocityX`
  istantaneo (= "legnoso") → aggiungere accelerazione/decelerazione. Ritocco veloce, alto ritorno.

### Backlog estetico / futuro (dall'utente) — dettagli nella memoria `earwaxwar-backlog`
- **Animazioni** (migliorano il "legnoso"): entrata personaggio, camminata, strisciamento nemici,
  carattere comico del personaggio.
- **Sprite dedicati** per goccia/emettitore del soffitto (ora procedurali).
- **Alternative ostacoli** ancora da fare (una alla volta): peli oscillanti, geyser di cerume.
- **Idea "condotto a dimensione variabile"** (larghezza del corridoio non sempre uguale) — piaciuta
  all'utente, da approfondire.
- Ottimizzare `assets_data.js` (~4.6MB) prima del build Android. Monetizzazione (non decisa).

---

## RISCHI / punti aperti da tenere d'occhio
- **Tipo di livello ASSEDIO (`siege`):** mai provato dal vivo. Verificare che il countdown parta e
  che il livello si completi allo scadere (win a tempo, timpano disattivato).
- **Volanti vs pedane (`00ec955`):** le pedane sono solide anche ai moscerini; se in playtest si
  "incastrano", limitare la collisione alla sola picchiata.
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
