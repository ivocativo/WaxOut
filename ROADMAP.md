# Earwax War — Piano esecutivo (blocco "Round 3 — Audio, rifacimento synth")

> 📄 **A cosa serve questo file:** è la "lista di lavoro" del blocco in corso (con le caselle da
> spuntare), usa e getta. Per lo **stato generale** del progetto, come collaudare e le regole vedi
> **`HANDOFF.md`**; per la descrizione del gioco vedi **`README.md`**.

_Preparato 2026-07-17 da Opus. **Blocchi precedenti "Correzioni playtest round 1 e round 2" CHIUSI e_
_pushati** (fino a `75df562` su `origin/main`); il loro dettaglio è nella cronologia git, non più qui._
_Regole invariate: god-mode nei test SEMPRE, i18n EN+IT per stringhe nuove, commit solo su richiesta._

---

## Decisioni dell'utente (2026-07-17) che guidano tutto il blocco
- **Ambito:** rifare SIA la musica SIA gli effetti sonori.
- **Approccio:** **restare PROCEDURALI** (WebAudio, nessun file audio) ma alzare MOLTO la qualità.
  Motivo scelto dall'utente: peso zero (cruciale per il build Android/Google Play) e nessun
  abbonamento a servizi di musica. → NON si introducono file `.mp3/.ogg`, tutto resta sintetizzato.
- **Varietà:** la musica deve **cambiare in base alla situazione** — almeno 3 atmosfere:
  **menu**, **livello normale**, **boss/assedio**.

## Da dove partiamo (stato attuale di `src/sfx.js`)
Tutto già procedurale, ma "povero, tipo vecchia console":
- **Effetti** (~13: hit/crack/smash/jump/dash/hurt/enemyDie/spit/spray/pick/win/lose/emerge): quasi
  tutti un SOLO oscillatore + una `slide`/`noise`, **nessuna stratificazione**, **nessuna variazione**
  (identici a ogni colpo → stancano), buste (envelope) grezze, niente spazio/riverbero.
- **Musica:** UN solo loop di 16 passi (`LEAD`+`BASS`+tick) via `setInterval(165ms)`, **sempre lo
  stesso ovunque** (menu = gioco = boss), niente percussioni, niente accordi, niente sezioni.
- **Buono da tenere:** l'architettura bus (`master`→`sfxBus`/`musicBus`), i controlli volume/musica
  salvati in localStorage, i pulsanti a schermo, lo `unlock()` al primo gesto. **NON rifare questi.**

## ⚠️ Nota sul collaudo (importante, l'audio è un caso speciale)
Il preview mi fa verificare la **LOGICA** (nessun errore, scheduler che gira, tracce che partono/
cambiano, guadagni che rampano, note schedulate nei tempi giusti) — **NON il GUSTO del suono**: la
qualità musicale vera la giudica l'utente ASCOLTANDO sul telefono. Quindi per ogni gruppo: verificare
a fondo la logica in preview (god-mode, `game.step()`/interrogazione stato via `javascript_tool`,
ispezione dei nodi WebAudio), poi **dire chiaramente che il giudizio finale di gusto è dell'utente**.
Non spacciare "gira senza errori" per "suona bene".

---

## GRUPPO AU-A — Fondamenta del synth (toolkit + spazio)  ⚙️
_Base tecnica su cui poggiano B e C. Solo `src/sfx.js`. Nessun cambiamento udibile "da solo": è_
_infrastruttura, si collauda col Gruppo B._
- [x] **AU-A.1 — Mattoni sonori migliori.** FATTO (busta ADSR, `synth`/`noiseBurst`, detune, filtri, `noteToFreq`, jitter). Ampliare il toolkit interno (accanto a `tone/slide/
  noise`, che restano): busta ADSR vera (attacco/decay/sustain/release parametrici) invece delle due
  rampe esponenziali fisse; `osc` con **detune**/voci sovrapposte (suono più "grasso"); rumore con
  filtro passa-alto oltre al passa-basso (per hi-hat/aria); un `pluck` corto (osc+filtro che si
  chiude) per note percussive. Piccoli helper `noteToFreq(nome)` e un jitter deterministico-ma-vario
  (NB: `Math.random()` è OK qui, è audio a runtime, non un test da rendere riproducibile).
- [x] **AU-A.2 — Un po' di "spazio".** FATTO (bus `fxBus`→delay smorzato + riverbero a convoluzione con impulso sintetico → `fxReturn`; mandata per-suono). Aggiungere un bus effetti economico (un **feedback-delay**
  corto + eventualmente un riverbero a convoluzione con impulso sintetico di rumore ~0.3s) come
  **mandata** condivisa, con dosatura per-suono. Serve a togliere il "secco da beep". Tenerlo leggero
  (CPU su telefono). Restare sotto `sfxBus`/`musicBus` esistenti, non toccare il mix generale.
- **Verifica:** nessun errore; i nuovi nodi esistono e sono collegati al grafo; il delay/riverbero si
  sente come coda su un suono di prova. (Il grosso si collauda in AU-B.)

## GRUPPO AU-B — Effetti sonori rifatti  🔊
_Solo `src/sfx.js`. **NON cambiare i NOMI** dei metodi (hit/jump/smash/…) né le firme: le scene li_
_chiamano già, così non si tocca `GameScene.js`._
- [x] **AU-B.1 — Stratificare + variare i 13 effetti esistenti.** FATTO (tutti a 2-3 strati con jitter; nomi/firme invariati → scene non toccate). Ognuno diventa 2-3 strati (es.
  `smash` = sbuffo di rumore + "thud" che scende di tono + piccolo "squish" gommoso) con la busta/
  filtri di AU-A, e **jitter casuale a ogni colpo** (±piccola % su tono e tempo) così ripetuti non
  stancano. Mantenere il **tono comico/gommoso** del gioco (non realismo). Dosare la mandata spazio
  di AU-A.2 con parsimonia (gli effetti restano "in faccia", la coda è un velo).
- [~] **AU-B.2 — (opzionale) 2-3 effetti in più.** RIMANDATO: avrebbe richiesto nuovi punti di
  chiamata in GameScene, fuori dall'obiettivo di questo blocco. Gli effetti esistenti bastano. Solo se
  aggancio già presente e a costo quasi nullo: es. differenziare `spray` del getto perforante, o un
  suono per la parata scudo se c'è già un punto di chiamata comodo. **Se richiede toccare GameScene
  in più punti → RIMANDARE**, non è l'obiettivo di questo blocco.
- **Verifica:** in preview innescare ogni effetto (chiamata diretta) → nessun errore, si sente la
  differenza (più corposo, con variazione tra due colpi ravvicinati). **Giudizio di gusto: utente.**

## GRUPPO AU-C — Motore musicale (scheduler + voci)  🎛️
_Solo `src/sfx.js`. È il "motore" (parte più delicata del blocco)._
- [x] **AU-C.1 — Scheduler a "lookahead".** FATTO (`schedTick` ogni 25ms schedula ~100ms in anticipo sull'orologio audio; `startMusic`/`stopMusic` ok). Sostituire il `setInterval(165ms)` che suona un passo
  alla volta con lo schema standard WebAudio (loop di controllo ~25ms che **schedula in anticipo**
  ~100ms di note sull'orologio audio): timing molto più stabile, niente sfarfallii, regge il cambio
  scheda/tab. Mantenere `startMusic/stopMusic/toggleMusic` funzionanti.
- [x] **AU-C.2 — Voci multiple + percussioni.** FATTO (basso/accordi-pad/lead + batteria sintetica kick/snare/hat; swing sui passi dispari; note per nome). Un "brano" diventa un dato: `{ bpm, swing, voci }`
  dove le voci sono pattern di passi. Voci previste: **basso** (saw/tri filtrato), **accordi/pad**
  (triangoli detunati, attacco lento), **lead/arpeggio** (pluck di AU-A), **batteria** sintetica
  (kick = sinusoide che cala di tono; snare = rumore + tono corto; hat = rumore passa-alto breve).
  Helper note→frequenza + swing sui tempi pari. Tutto su `musicBus`.
- [x] **AU-C.3 — `setMusic(nome)` con dissolvenza.** FATTO (fade-out 0.35s → cambio brano → fade-in 0.35s via nodo `musicFade`; ricorda il brano se l'audio non è ancora sbloccato). Nuova API pubblica: cambia brano
  rampando a zero il guadagno del brano corrente (~0.6s) e avviando il nuovo, senza fermare lo
  scheduler; se l'audio non è ancora sbloccato, ricorda il brano voluto e parte allo `unlock()`.
  Compatibile con l'attuale `musicOn`/volume.
- **Verifica:** lo scheduler avanza sull'orologio audio (note schedulate con `when` corretti);
  `setMusic('a')`→`setMusic('b')` rampa un guadagno giù e l'altro su; nessun errore; con musica OFF
  resta muto. **Giudizio di gusto: utente.**

## GRUPPO AU-D — Le 3 atmosfere + agganci nelle scene  🎵
_`src/sfx.js` (i 3 brani come dati) + agganci minimi in `MenuScene.js` e `GameScene.js`._
- [x] **AU-D.1 — Scrivere i 3 brani.** FATTO (menu 92bpm maggiore rilassato / livello 130bpm spinto / boss 150bpm minore teso). BOZZE da tarare col gusto dell'utente. (a) **menu**: rilassato/giocoso, tempo medio, pentatonica
  allegra, batteria leggera. (b) **livello** (normale + corsa): più spinto/ritmato, batteria piena,
  senso di "missione di pulizia". (c) **boss/assedio**: teso, tonalità minore, basso/batteria più
  pesanti, più veloce. Sono BOZZE da iterare col gusto dell'utente.
- [x] **AU-D.2 — Agganciare le atmosfere.** FATTO (`MenuScene`→'menu'; `GameScene.create`: boss/siege→'boss', resto→'level'). Toccate 2 righe in tutto nelle scene. `MenuScene` → `Sfx.setMusic('menu')`. `GameScene.create`
  → in base a `levelKind`: boss→`'boss'`, siege→`'boss'` (o `'siege'` se distinto), resto→`'level'`.
  Alla vittoria/game over la musica può abbassarsi un attimo sotto la fanfara/trombetta (facoltativo).
  **Toccare le scene il minimo indispensabile** (1-2 righe per aggancio).
- [~] **AU-D.3 — (facoltativo) Boss infuriato = musica più intensa.** RIMANDATO a dopo il playtest:
  prima l'utente giudica se le 3 atmosfere base convincono, poi eventualmente si aggiunge la variante. Se a costo basso: in
  `bossAI` quando `_enraged`, alzare un layer o passare a una variante più carica. Se complica →
  RIMANDARE.
- **Verifica:** entrando nel menu parte 'menu'; avviando un livello normale parte 'level'; un livello
  boss parte 'boss'; il cambio è una dissolvenza pulita, nessun errore, controlli volume/musica
  ancora ok. **Giudizio di gusto: utente sul telefono.**

## GRUPPO AU-E — Mix, rifiniture e chiusura  🎚️
- [x] **AU-E.1 — Bilanciare il mix.** FATTO (volumi relativi per voce impostati; musica sotto gli
  effetti via `musicBus` 0.5; i 3 livelli volume + muto ricontrollati). Fine taratura al playtest. Volumi relativi tra le voci e tra musica ed effetti (la musica
  deve stare "sotto" senza sparire); controllare che nulla clippi; ricontrollare i 3 livelli volume
  e il muto. Eventuali manopole `window.__` per far tarare all'utente in fretta.
- [x] **AU-E.2 — Giro finale.** FATTO (nessuna stringa i18n nuova necessaria; rimosso il vecchio
  loop musicale `LEAD/BASS/playMusicStep` e la funzione morta `tone`; `HANDOFF.md` aggiornato). Nessuna stringa i18n nuova prevista (i pulsanti esistono già); se ne
  servisse una, EN+IT. Rilettura per togliere codice morto (il vecchio `LEAD/BASS`/`playMusicStep` se
  rimpiazzati). Aggiornare `HANDOFF.md` (§Cosa c'è già → audio) e chiudere questo file.

---

## Stato: TUTTO FATTO E VERIFICATO (logica) 2026-07-17 — NON ancora committato
Implementati AU-A→AU-E in un'unica passata (quasi tutto in `src/sfx.js` + 2 righe negli agganci
scena). **Verifica LOGICA in preview** (god-mode): zero errori console; tutti i 13 effetti partono;
il motore musicale genera davvero note (~28 oscillatori/s + batteria durante 'level') e prosegue tra
i cambi scena; le dissolvenze menu→livello→boss e muto/riattiva funzionano; agganci scena
(menu→'menu', assedio→'boss') ok. RIMANDATI (non necessari ora): AU-B.2 (effetti extra) e AU-D.3
(boss infuriato). **Il GUSTO del suono lo deve giudicare l'utente ascoltando sul telefono** — le 3
atmosfere sono bozze da tarare.

> **Nota flusso:** questo è il piano di Opus. L'esecuzione può passare a **Sonnet** (`/model
> claude-sonnet-5`) per risparmiare token, come da prassi — oppure procede Opus se l'utente preferisce
> (il motore audio, AU-C, è la parte "da motore", più adatta a Opus).
