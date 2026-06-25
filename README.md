# Earwax War — La Guerra del Cerume 🦻

Action-platformer 2D in pixel art: sei un minuscolo omino-igienista intrappolato in un
condotto uditivo e devi **demolire il muro di cerume**, facendoti strada tra nemici e
oggetti fatti di cerume e sporco. A fine di ogni livello **sblocchi nuove abilità o armi**.

Costruito con [Phaser 3](https://phaser.io/) in puro HTML5 + JavaScript. Nessuna build,
nessuna dipendenza da installare: gira **offline aprendo `index.html`**.

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

Obiettivo: **distruggi tutti i blocchi del muro di cerume** per completare il livello.
Occhio ai nemici:
- **Cerumino** — blob veloce, danno al contatto
- **Crosta** — sporco lento ma resistente
- **Gorgogliante** (dal liv. 3) — sta a terra e ti **sputa palline di cerume** a distanza
- **Moscerino** (dal liv. 4) — **vola** e ti insegue in aria
- **Tappo di Cerume** (BOSS, ogni 5 livelli) — gigante, coriaceo, sputa e vale tantissimo cerume

Ogni **5 livelli** arriva un **boss**; altri livelli sono di tipo **Sciame** (più nemici,
muro più piccolo). Un cartello a schermo annuncia i livelli speciali.

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
└─ src/
   ├─ main.js              # config Phaser + avvio
   ├─ state.js             # stato globale + costanti
   ├─ sfx.js               # effetti sonori procedurali (WebAudio)
   ├─ pixelart.js          # generatore di texture pixel-art
   └─ scenes/
      ├─ BootScene.js      # genera tutte le texture
      ├─ MenuScene.js      # titolo + istruzioni
      ├─ GameScene.js      # gameplay del livello
      └─ UpgradeScene.js   # scelta potenziamenti
```

Tutta la grafica è **generata via codice** (pixel art disegnata in `pixelart.js` /
`BootScene.js`): niente file immagine da caricare, così il gioco gira da `file://`.
Per integrare in seguito asset pack open-source (CC0), basta sostituire le texture
generate con `this.load.image(...)` in `BootScene` servendo la cartella via HTTP.

## 🗺️ Stato del progetto

Roguelike giocabile su PC e su telefono/tablet. _Aggiornato al 2026-06-25._

**Fatto finora:**
- Comandi **touch** a schermo (pad direzionale, salto, attacco, scatto) per giocare da cellulare
- **Menu di pausa** (`ESC`/`P` o pulsante a schermo)
- Struttura **roguelike**: ogni run riparte dal livello 1; alla sconfitta la run finisce
- **Banca permanente** del cerume (salvataggio nel browser) e **negozio** di potenziamenti permanenti
- **Varietà di nemici e livelli**: Gorgogliante (sputatore), Moscerino (volante), boss
  "Tappo di Cerume" ogni 5 livelli, livelli "Sciame", cartelli per i livelli speciali

**Prossimi passi (in ordine):**
1. Musica di sottofondo e miglioramento degli effetti audio
2. Ancora più varietà: nuovi eventi e potenziamenti
3. Impacchettamento con **Capacitor** → app Android per Google Play

**Obiettivo finale:** pubblicazione su **Google Play Store** (telefoni e tablet Android).

> Nota tecnica: il salvataggio (`localStorage`) funziona quando il gioco è servito
> via HTTP o nell'app Android; aprendo `index.html` da `file://` alcuni browser
> non lo permettono.

## 🔁 Riprendere lo sviluppo in una nuova sessione

Apri Claude Code **nella cartella `C:\Users\ivanf\Claude\code`** (la stessa di
prima) e scrivi qualcosa come _"riprendiamo earwax war, da dove eravamo?"_.
Lo stato e i prossimi passi sono qui sopra e nel repository
[ivocativo/earwax-war](https://github.com/ivocativo/earwax-war).

## 📜 Licenza

Codice del gioco: libero uso personale. Phaser è distribuito sotto licenza MIT.
