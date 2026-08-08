# Earwax War — La Guerra del Cerume 🦻

Action-platformer 2D in pixel art: sei un minuscolo omino-igienista intrappolato in un
condotto uditivo e devi **demolire il muro di cerume**, facendoti strada tra nemici e
oggetti fatti di cerume e sporco. A fine di ogni livello **sblocchi nuove abilità o armi**.

Costruito con [Phaser 3](https://phaser.io/) in puro HTML5 + JavaScript. Nessuna build,
nessuna dipendenza da installare: gira **offline aprendo `index.html`**.

> 📄 Questo file è la **presentazione** del gioco (cos'è, come si gioca, com'è fatto). Per lo
> sviluppo: lo **stato attuale e come si collauda** stanno in `HANDOFF.md`, il **piano del
> lavoro in corso** in `ROADMAP.md`.

## ▶️ Come giocare

Fai **doppio clic su `index.html`** (oppure trascinalo in un browser moderno: Chrome,
Edge, Firefox). Phaser è incluso in locale (`vendor/phaser.min.js`), quindi non serve
connessione né alcun server.

> Se in futuro installi Node o Python e preferisci servire la cartella via HTTP:
> `npx http-server` oppure `python -m http.server`, poi apri `http://localhost:8080`.

## 🎮 Comandi

| Azione    | Tasti / Tocco                          |
|-----------|----------------------------------------|
| Muoviti   | `A` / `D` o frecce ← → · pad a schermo  |
| Salta     | `W` / `Spazio` / ↑ · pulsante ▲         |
| Attacca   | `J` o click sinistro · pulsante ◆       |
| Scatto    | `Shift` (se sbloccato) · pulsante »     |
| Pausa     | `ESC` / `P` o pulsante ∥ in alto a dx   |
| Nuova run | `R` (dopo un game over)                 |

> Su telefono/tablet i comandi a schermo compaiono da soli. Da PC puoi vederli
> aggiungendo `?touch=1` in fondo all'indirizzo.

Obiettivo: **attraversa il condotto da sinistra verso il timpano** (a destra),
**sfondando le membrane di cerume** che sbarrano il passaggio. Raggiungere il timpano
in fondo completa il livello. La barra in alto ("Timpano: %") indica quanto manca.
Occhio ai nemici:
- **Cerumino** — blob veloce, danno al contatto
- **Crosta** — sporco lento ma resistente
- **Gorgogliante** (dal liv. 3) — sta a terra e ti **sputa palline di cerume** a distanza
- **Moscerino** (dal liv. 4) — **vola** e ti insegue in aria
- **Pulce** (dal liv. 2) — saltella di continuo verso di te: fastidiosa più che pericolosa
- **Saltatore** (dal liv. 3) — balzo enorme telegrafato che scarica un'onda d'urto all'atterraggio
- **Tappo di Cerume** (BOSS, ogni 5 livelli) — gigante, coriaceo, sputa e vale tantissimo cerume

Ogni **5 livelli** arriva un **boss**. Una partita ("run") dura **15 livelli**: in fondo c'è il
**GRAN TAPPO**, il boss finale a tre fasi — battilo e hai **vinto**. Dopo la prima vittoria si
sblocca la difficoltà **Infezione** (gradi 0-5): nemici più duri, ma più cerume.

Prima di ogni livello non-boss scegli tra **due porte**: una più sicura e una più rischiosa che
raddoppia il cerume. La carta della porta dice sempre tre cose — l'**obiettivo** (che tipo di
livello è e cosa devi fare), l'eventuale **regola speciale** (un modificatore: nemici più veloci,
più fragili, cerume più duro…) e il **premio**.

Tipi di livello: **Normale** (pulisci e raggiungi il timpano), **Corsa** (arriva prima che scada il
tempo, con countdown 3-2-1-VIA), **Assedio** (resisti fino a fine cronometro), **Sciame** (orde di
nemici), **Boss**. Un cartello a schermo annuncia sempre livello e regola speciale.

## 🔓 Potenziamenti (fine livello)

Scegli 1 di 3 carte: Affilatura (+danno), Fibra Extra (+HP), Riflessi (attacco rapido),
Stivali Veloci, Braccio Lungo (+portata), **Salto Doppio**, **Scatto**, **Martello di
Cerume** (arma ad area). Ogni livello successivo è più difficile (muro più grande,
blocchi più duri, più nemici).

## 📁 Struttura

```
earwaxwar/
├─ index.html              # punto d'ingresso
├─ vendor/phaser.min.js    # libreria Phaser (locale)
├─ assets/                 # sprite/immagini (incorporati come data-URI per girare da file://)
└─ src/
   ├─ main.js              # config Phaser + avvio
   ├─ state.js             # stato globale, costanti e tabelle (abilità, mutatori, eventi…)
   ├─ meta.js              # progressi permanenti (banca, sblocchi) su localStorage
   ├─ i18n.js              # dizionario testi EN/IT
   ├─ sfx.js               # effetti sonori procedurali (WebAudio)
   ├─ gfx.js               # rendering (sfondo, cerume, effetti) — separato dal gameplay
   ├─ pixelart.js          # generatore di texture pixel-art
   ├─ touch.js             # comandi touch (stick + tasti a schermo)
   └─ scenes/
      ├─ BootScene.js      # carica gli sprite e genera le texture mancanti
      ├─ MenuScene.js      # titolo + istruzioni       ├─ PauseScene.js    # pausa
      ├─ GameScene.js      # gameplay del livello       ├─ ShopScene.js     # negozio
      ├─ UpgradeScene.js   # scelta potenziamenti      ├─ DoorScene.js     # scelta tra due porte
      └─ VictoryScene.js   # run vinta (15° livello)
```

La grafica è **mista**: parte disegnata via codice (pixel art in `pixelart.js` / `BootScene.js`),
parte **sprite** veri (cerume, fondali) incorporati come data-URI in `src/*_data.js` così il gioco
gira anche aprendo `index.html` da `file://`.

## 🗺️ Stato del progetto

Roguelite giocabile su PC e su telefono/tablet, **anche come app Android**. _Aggiornato al 2026-07-27._

**Fatto finora (in sintesi):**
- Comandi **touch** a schermo per giocare da cellulare, **menu di pausa**, canvas che si ri-adatta
  alla rotazione. **App Android** (APK) compilata automaticamente da GitHub.
- Struttura **roguelite** con **banca permanente** del cerume e **negozio** di potenziamenti e
  progetti permanenti.
- **Run con un finale:** 15 livelli, boss finale a tre fasi, schermata di vittoria e difficoltà
  **Infezione** crescente che si sceglie dopo aver vinto.
- **Scelta del percorso:** due porte (sicura / rischiosa) prima di ogni livello non-boss.
- **Combattimento** con hit-stop, colpi telegrafati, **salto sui nemici** alla Mario, tanti **nemici**
  (Cerumino, Crosta, Gorgogliante, Moscerino, Pulce, Saltatore, boss) con **varianti élite**
  (Corazzato, Esplosivo, che-si-sdoppia).
- **Rigiocabilità:** carte potenziamento con **rarità**, **evoluzioni** (fusioni di abilità),
  **tipi di livello** (corsa/assedio/boss/sciame), **11 modificatori** e **eventi casuali**.
- **Livelli esplorabili** (scrolling): un mondo largo da attraversare verso il **timpano**, con
  telecamera che segue, terreno a colline e cunette, membrane di cerume da sfondare, pedane e ostacoli.
- **Estetica:** sfondi pittorici a 3 strati in parallax, personaggio e **tutti i nemici** da immagini
  disegnate (stile organico), terreno/soffitto/pedane dipinti come tessuto vivo.

> Lo stato di dettaglio, cosa è già collaudato e cosa no, e il piano dei prossimi passi sono nei
> file di sviluppo **`HANDOFF.md`** e **`ROADMAP.md`** (per non ripetere le stesse cose in due posti).

**Prossimi grandi traguardi:** rifinire l'estetica (animazioni dei nemici, timpano incastonato nella
carne), **rifare musica ed effetti sonori**, poi la pubblicazione su **Google Play Store** (telefoni
e tablet Android) — l'impacchettamento con **Capacitor** è già funzionante.

> Nota tecnica: il salvataggio (`localStorage`) funziona quando il gioco è servito via HTTP o
> nell'app Android; aprendo `index.html` da `file://` alcuni browser non lo permettono.

## 🔁 Riprendere lo sviluppo in una nuova sessione

Apri Claude Code **nella cartella `C:\Users\ivanf\Claude\code`** e scrivi qualcosa come
_"riprendiamo earwax war, da dove eravamo?"_. Il punto della situazione è in **`HANDOFF.md`**
(inizia da lì), il piano del blocco in corso in **`ROADMAP.md`**. Repository:
[ivocativo/WaxOut](https://github.com/ivocativo/WaxOut).

## 📜 Licenza

Codice del gioco: libero uso personale. Phaser è distribuito sotto licenza MIT.
