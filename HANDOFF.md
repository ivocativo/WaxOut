# Earwax War — Handoff (nuova sessione)

_Ultimo aggiornamento: 2026-07-11 · Ultimo commit: `00ec955`_

Gioco: **run-and-gun / roguelite 2D** (stile Metal Slug + Vampire Survivors/Gungeon) a tema
"pulizia del condotto uditivo". Obiettivo finale: pubblicazione su **Google Play** (Android,
telefono + tablet) via Capacitor. Giocabile su PC (tastiera) e telefono (comandi touch).

- **Stack:** JavaScript + **Phaser 3** (in `vendor/`), niente build, gira anche da `file://`
  (script classici `window.*`, no moduli ES). HTML in `index.html`.
- **Repo:** `C:\Users\ivanf\Claude\code\earwaxwar` · GitHub `ivocativo/earwax-war` (branch `main`).
- **Utente:** non tecnico, italiano. Spiegare in modo semplice, confermare prima di passi grossi.
- **Regola file:** ogni file del gioco va in `code/earwaxwar/` (usare percorsi assoluti; la shell
  parte da `code/`).

---

## ⚠️ LA COSA PIÙ IMPORTANTE: collaudo live ARRETRATO

Nelle ultime sessioni il **preview nel browser è stato indisponibile** (il tool `preview_eval`
rimandava alle ext-tool `claude-in-chrome`, risultate "not connected", poi il tool è proprio
sparito). Perciò **tutto il blocco "variabilità" + i fix recenti sono stati verificati SOLO
staticamente** (rilettura del codice), **mai provati dal vivo**.

**PRIMO COMPITO della nuova sessione:** riprovare il preview in-browser. Se funziona, fare il
**collaudo live** di tutto l'arretrato non verificato (lista sotto). Se non funziona, chiedere
all'utente l'esito del suo playtest sul telefono.

### Commit da verificare dal vivo (dal più recente)
- `00ec955` — Fix playtest: gocce/volanti attraverso pedane, dash self-damage, scrigno, banner
- `7872ce1` — Varianti ELITE nemici (Corazzato + Esplosivo)
- `d873daa` — Pulsante "Azzera progressi" nel negozio
- `eeb2384` — Rimosso livello "pulizia profonda" + fix soglia 80% + banner più visibile
- `31b299e` — Tipi di livello (corsa / assedio)
- `80ddbb5` — Modificatori di livello (mutatori)
- `5a52325` — Gocce attaccate al soffitto + no cura auto a fine livello + shop più caro

Tutto ciò che è **prima** di `5a52325` era stato verificato dal vivo nelle sessioni precedenti.

---

## Come provare il gioco

**Preview (per il collaudo dell'assistente):** `preview_start` con config `earwaxwar-8124`
(porta 8124) da `.claude/launch.json`. Se il renderer si impunta dopo molti reload, riavviare
il server di preview. Se `preview_eval` non è disponibile, provare le ext-tool `claude-in-chrome`.

**Telefono (per l'utente):** doppio-click su `GIOCA-SU-TELEFONO.cmd` sul PC → sul telefono
(stesso Wi-Fi) aprire `http://<IP-PC>:8123` (di recente `192.168.1.193:8123`; l'indirizzo
esatto è stampato nella finestra nera). Consentire il firewall su rete PRIVATA.

**God-mode per i test (OBBLIGATORIO in ogni simulazione, tranne quando testo la morte):**
appena avviata la GameScene, in un eval:
```js
(()=>{const g=window.game; const apply=()=>{const gs=g.scene.getScene('GameScene');
  if(!gs||!gs.player) return; window.GameState.player.hp=999999; gs.invulnUntil=1e12;};
  const gs=g.scene.getScene('GameScene'); gs.events.once('create', apply); apply();
  return 'godmode armed';})()
```
Avvio rapido di un livello per test:
```js
window.GameState.reset(); window.GameState.level = 4;
window.game.scene.getScene('MenuScene').scene.start('GameScene');
```
GOTCHA test: `enemies.getChildren().find(active)` becca anche i GUARDIANI (non solo il nemico
appena spawnato) → filtrare per `x.kind` o distruggere prima i guardiani.

---

## Struttura del codice (dove sta cosa)
- `src/state.js` — costanti (`CONFIG`), `newPlayer()`, e le TABELLE: `UNLOCKS` (potenziamenti
  shop), `BLUEPRINTS` (progetti/abilità sbloccabili), `EVOLUTIONS` (fusioni), `MUTATORS`
  (modificatori di livello). Anche `Meta` sta in `src/meta.js` (localStorage: banca, sblocchi).
- `src/scenes/GameScene.js` — cuore del gioco (~2100 righe): build livello, spawn nemici, IA,
  combattimento, abilità, mutatori, tipi di livello, gocce, élite, update loop.
- `src/scenes/ShopScene.js` — negozio (2 colonne: Potenziamenti + Progetti) + pulsante reset.
- `src/scenes/UpgradeScene.js` — carte di fine livello (pool `ALL` + evoluzioni + filtro).
- `src/scenes/MenuScene.js` / `PauseScene.js` — menu e pausa.
- `src/gfx.js` (`GameGfx`) — SOLO rendering (sfondo, cerume, splat, `showBanner`, ecc.). Tenere
  grafica separata dal gameplay: sessione "grafica" tocca gfx.js, "gameplay" GameScene.js.
- `src/i18n.js` — dizionario EN (default) + IT. Ogni stringa passa da `I18n.t('chiave')`.
- `src/touch.js` — comandi touch (stick analogico + tasti).

---

## Cosa c'è già (sistemi principali)
- **Combattimento:** attacco unico "intelligente" (mazza da vicino / getto da lontano),
  hit-stop + shake, salto ad altezza variabile + coyote/buffer, accovacciamento, scatto.
- **Nemici:** blob (cerumino), crust (crosta, corazzata anti-getto), spit (gorgogliante),
  fly (moscerino, picchiata telegrafata), boss (Tappo di Cerume, si infuria a metà vita).
  **Varianti élite** (dal lvl 3): Corazzato (aura azzurra) ed Esplosivo (aura rossa).
- **Abilità di run** (carte UpgradeScene): ventaglio (impilabile), perforante, vita rubata,
  scudo (alone visibile), mira guidata, seconda vita, cerume extra (impilabile), scatto
  offensivo, sapone corrosivo, rimbalzo (impilabile), + bolla-aiutante (impilabile, blueprint).
- **Evoluzioni** (fusioni di 2 abilità): Lama d'Acqua, Nube Tossica, Buco Nero, Sciame.
- **Meta/negozio:** cerume in banca → potenziamenti permanenti (UNLOCKS) + progetti (BLUEPRINTS).
  Pulsante "Azzera progressi" (2 tocchi). Prezzi alzati di recente.
- **Varietà livelli:** tipi (normale / **corsa** / **assedio** / boss / sciame) + **modificatori**
  casuali (fretta, orda, corazza, poca gravità, cuccagna, cerume ostinato). Banner d'annuncio.
- **Ostacoli:** pozze scivolose + **gocce dal soffitto** (emettitore attaccato al soffitto,
  goccia a lacrima che cade). Membrane di cerume con fisica a celle (collasso).
- **Mobile:** touch, canvas che si ri-adatta alla rotazione, tool per giocare da telefono.

---

## DA FARE (in ordine deciso con l'utente)
1. **Completare la variante élite "SPLIT" (si sdoppia):** rimandata perché serve spawnare 2
   nemici-figli nel punto del genitore. `spawnEnemy` è tarato per far EMERGERE i nemici dal suolo
   a distanza → serve un percorso "figlio istantaneo alla posizione del genitore". `opts.splitChild`
   è già predisposto nel filtro élite (esclude i figli dal diventare a loro volta élite).
2. **Eventi casuali + rarità delle carte** (comune/rara/leggendaria colorate): il gusto
   dell'imprevisto. Prossimo asse di variabilità dopo lo split.
3. **Game feel / "legnoso":** il movimento usa `setVelocityX` istantaneo → aggiungere
   accelerazione/decelerazione. Ritocco veloce, alto ritorno.

### Backlog estetico / futuro (dall'utente)
- **Animazioni** (l'utente sa che miglioreranno il "legnoso"): entrata personaggio, camminata,
  strisciamento nemici, carattere comico del personaggio (versetti/frasi).
- **Sprite dedicati** per goccia/emettitore del soffitto (ora procedurali).
- **Animazione dardi perforanti** su nemici/cerume (solo estetica, rimandata dall'utente).
- **Alternative ostacoli ancora da fare** (una alla volta, su ok utente): peli oscillanti,
  geyser di cerume, cerume che cade. (Le "gocce dal soffitto" sono la 1a, già fatta.)
- Ottimizzare `assets_data.js` (~4.6MB) prima del build Android.
- Monetizzazione (ads vs skin sbloccabili) — non deciso.

---

## RISCHI / punti aperti da tenere d'occhio
- **Fix#2 di `00ec955` (volanti vs pedane):** ora le pedane sono solide anche ai moscerini. Se
  in playtest si "incastrano" contro una pedana, limitare la collisione alla sola picchiata
  (invece che sempre).
- **Tipo di livello ASSEDIO (`siege`):** il più nuovo/rischioso. Verificare che il countdown
  parta e che il livello si completi allo scadere (win a tempo, il timpano è disattivato).
- Molte manopole numeriche (danni élite, cadenza gocce, raggi, prezzi shop, durata assedio,
  altezza scrigno) sono **da tarare col playtest** — sono valori "sensati" non collaudati.

---

## Convenzioni
- Commit in italiano, in fondo: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Committare/pushare solo quando l'utente lo chiede (di solito lo chiede a fine blocco).
- i18n: ogni nuova stringa in EN + IT.
- God-mode nei test SEMPRE (vedi sopra), MAI lasciarlo nel codice committato.
- La memoria di progetto dettagliata è in `earwaxwar-backlog.md` (auto-memory dell'assistente).
