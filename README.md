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

| Azione    | Tasti                          |
|-----------|--------------------------------|
| Muoviti   | `A` / `D` o frecce ← →         |
| Salta     | `W` / `Spazio` / ↑             |
| Attacca   | `J` o click sinistro           |
| Scatto    | `Shift` (se sbloccato)         |
| Riprova   | `R` (dopo un game over)        |

Obiettivo: **distruggi tutti i blocchi del muro di cerume** per completare il livello.
Attento ai **Cerumini** (blob di cerume) e alle **Croste** (sporco più resistente): fanno
danno al contatto.

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

Prototipo MVP giocabile. Possibili sviluppi futuri:
- Sprite animati e asset pack pixel-art dedicati
- Boss di fine condotto, livelli con scrolling, più tipi di nemici
- Negozio per spendere il cerume raccolto, salvataggio progressi
- Audio/musica di sottofondo

## 📜 Licenza

Codice del gioco: libero uso personale. Phaser è distribuito sotto licenza MIT.
