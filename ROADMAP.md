# Earwax War — Piano esecutivo (blocco "Gameplay backlog")

_Pianificato con Opus il 2026-07-11. Pensato per essere ESEGUITO da Sonnet, un passo alla volta._
_Riferimento generale: vedi `HANDOFF.md`. Regole: god-mode nei test SEMPRE, i18n EN+IT per ogni stringa,_
_commit solo su richiesta dell'utente, mai lasciare il god-mode nel codice committato._

## Come usare questo file (per Sonnet)
- Esegui le FASI in ordine. Non iniziare la Fase 1 finché la Fase 0 non è chiusa.
- Ogni fase è un blocco piccolo e auto-contenuto, con questo ciclo FISSO:
  1. implementa;
  2. **controllo qualità automatico** sulla modifica appena fatta: `/code-review` (caccia bug nel diff) e/o
     la skill *verify* (prova che la cosa funzioni davvero nel gioco, non solo a rilettura). Correggi ciò
     che emerge prima di considerare la fase finita;
  3. collauda dal vivo col god-mode (preview o telefono);
  4. riferisci all'utente in italiano semplice;
  5. chiedi se committare.
- Se un dettaglio non torna col codice reale, fermati e chiedi all'utente invece di improvvisare.
- Aggiorna la casella `[ ]`→`[x]` quando una fase è verificata dal vivo, e annota qui sotto ostacoli/decisioni.

---

## FASE 0 — Collaudo live dell'arretrato (BLOCCANTE, prima di tutto)
_L'utente NON ha ancora provato sul telefono i commit recenti. Nulla dal commit `5a52325` in poi è stato
verificato dal vivo._

- [ ] 0.1 Riprovare il preview in-browser: `preview_start` config `earwaxwar-8124` (porta 8124). Se il
      renderer si impunta dopo molti reload, riavviare il server.
- [ ] 0.2 Se il preview funziona, armare il god-mode (snippet in `HANDOFF.md` §God-mode) e collaudare, in
      quest'ordine, ciò che era solo verificato staticamente:
  - gocce dal soffitto (emettitore + goccia che cade, non attraversano le pedane sbagliate)
  - mutatori di livello (banner d'annuncio + effetto reale: fretta/orda/corazza/poca gravità/cuccagna/ostinato)
  - tipi di livello: **corsa** e soprattutto **assedio** (`siege`) — il più rischioso: il countdown parte?
    il livello si vince allo scadere del tempo? il timpano è disattivato?
  - varianti élite Corazzato (aura azzurra) ed Esplosivo (aura rossa, scoppio ritardato)
  - negozio: pulsante "Azzera progressi" (2 tocchi), prezzi
  - fix di `00ec955`: dash self-damage, scrigno, banner, volanti vs pedane
- [ ] 0.3 Se il preview NON funziona: chiedere all'utente di fare il playtest sul telefono
      (`GIOCA-SU-TELEFONO.cmd`) e riportare cosa non va. Segnare qui i problemi trovati come sotto-task
      prioritari PRIMA di passare alla Fase 1.

> Nota: se emergono bug, si sistemano qui in Fase 0. Solo con l'arretrato verificato si passa al nuovo lavoro.

---

## FASE 1 — Variante élite "SPLIT" (nemico che si sdoppia)
_Terza aura élite, dopo tank/boom. Alla morte genera 2 nemici-figli piccoli nel punto in cui muore._

**Dove:** `src/scenes/GameScene.js`
- `spawnEnemy(kind, opts)` ~riga 895; blocco élite righe 924-938 (scelta `['tank','boom']` a riga 927);
  posizionamento righe 940-963; gestione morte élite a riga 1547-1548 (`if (e.elite === 'boom') …`).

**Il problema noto (da HANDOFF):** `spawnEnemy` fa EMERGERE i nemici dal suolo lontano dal giocatore
(`emergeFromGround`, riga 1002) o calare dal soffitto. Serve un percorso "figlio istantaneo alla posizione
del genitore". `opts.splitChild` è GIÀ predisposto: a riga 925 esclude i figli dal diventare a loro volta élite.

**Approccio consigliato:**
1. Aggiungere `'split'` alla lista a riga 927. Nel blocco élite, ramo `split`: leggera vita/velocità in più
   ma niente scala extra (il "premio" è la difficoltà del raddoppio, non la stazza). Aura di un 3° colore
   (es. viola `0x9b7bff`) — aggiungere il colore alla mappa a riga 994.
2. In `spawnEnemy`, quando `opts.splitChild === true`:
   - posizione = `opts.x`/`opts.y` esatti (il punto del genitore), NON `pickGroundX`/emerge;
   - statistiche ridotte (hp ~35-45%, scala ~0.7, cerume ridotto) così due figli ≈ un genitore;
   - saltare l'animazione `emergeFromGround`: comparsa istantanea con un piccolo "pop" (tween di scala
     rapido) e `e.spawning=false` subito, così i figli sono attivi e non inerti.
3. Alla morte (riga 1547, accanto al ramo `boom`): `if (e.elite === 'split' && !e.wasChild) { spawna 2 figli
   con `this.spawnEnemy(e.kind, { splitChild:true, x: e.x±offset, y: e.y }) }`. Marcare i figli con un flag
   (`e.wasChild=true`) per evitare che si risplittino all'infinito (anche se non sono élite, meglio blindare).
4. Rispettare `this.maxEnemies`: se siamo già al tetto, spawnare 1 solo figlio o nessuno (evitare ondate infinite).

**Collaudo (god-mode ON):** forzare uno spawn split e ucciderlo; verificare che nascano 2 figli piccoli sul
posto, attivi, che i figli NON si risplittano, e che l'aura viola sparisca col genitore. Attenzione al GOTCHA
dei guardiani (filtrare per `kind`/distruggere i guardiani prima — vedi HANDOFF).

- [x] 1 SPLIT implementato e verificato con test di logica in-preview (god-mode + chiamate dirette);
      controllo qualità (8 agenti) ha trovato e corretto: danno dei figli non ridotto (ora *0.4,
      come l'hp) e mancanza di una guardia anti-doppia-morte in `damageEnemy` (aggiunta, protegge
      anche gli altri tipi di nemico). **Manca ancora il collaudo visivo/di "sensazione" sul
      telefono** (il rendering del preview era bloccato, vedi Fase 0).

---

## FASE 2 — Eventi casuali + rarità delle carte
_Due sotto-parti. Farle come due mini-blocchi separati (2A poi 2B), ciascuno con collaudo._

### 2A — Rarità delle carte di fine livello (comune / rara / leggendaria, colorate)
**Dove:** `src/scenes/UpgradeScene.js` (tutto qui). Pool `ALL` righe 31-61; selezione righe 66-83;
disegno carta righe 91-118; `src/i18n.js` per i tag; colori in `CONFIG.COLORS` se serve.

**Approccio:**
1. Aggiungere un campo `rarity: 'common'|'rare'|'legendary'` a ogni voce di `ALL`. Criterio sensato:
   stat ripetibili = common; abilità che cambiano stile = rare; evoluzioni + abilità da Progetto (locked)
   = legendary. (Decidere caso per caso, tenerlo leggibile.)
2. Selezione PESATA per rarità invece della pura `Shuffle` (righe 73/83): es. pesi common 60 / rare 30 /
   legendary 10, con le evoluzioni che mantengono la priorità attuale. Riempire sempre fino a 3 carte.
3. Colorare la carta per rarità: bordo + fill + colore titolo (righe 93-97, 114). Comune grigio/bianco,
   rara azzurro, leggendaria oro/arancio. Mantenere lo stile "evoluzione" (fucsia) sopra a tutto.
4. Piccolo tag testuale di rarità sotto al nome (riga 108-112 fa già una cosa simile col tag "abilità").
   Stringhe i18n nuove: `rarity_common`/`rarity_rare`/`rarity_legendary` in EN+IT.

**Collaudo:** aprire più volte la UpgradeScene (finire livelli col god-mode) e verificare distribuzione
sensata dei colori e che le leggendarie siano rare ma pescabili.

- [ ] 2A rarità carte implementata e verificata.

### 2B — Eventi casuali di livello
_"Il gusto dell'imprevisto". Sistema fratello dei MUTATORI già esistenti (in `src/state.js` tabella
`MUTATORS`, applicati in GameScene con banner d'annuncio)._

**Approccio (da confermare con l'utente sul tipo di eventi prima di codare):**
1. Studiare come i MUTATORI vengono scelti/annunciati (banner) e applicati in `GameScene.js`, e replicare
   lo stesso schema per un pool di EVENTI (probabilità bassa a inizio livello).
2. Proporre all'utente 3-4 idee di evento semplici (es.: "pioggia di cerume" bonus, "nemico d'oro" che vale
   doppio, "buio" con visione ridotta, "mercante di passaggio"). Implementarne UNO alla volta su ok utente.
3. Ogni evento: banner d'annuncio (riusare `showBanner`), effetto, e i18n EN+IT.

**Collaudo:** forzare l'evento, verificare banner + effetto reale + che il livello resti completabile.

- [ ] 2B eventi casuali: idee proposte all'utente, primo evento implementato e verificato.

---

## FASE 3 — Game feel: accelerazione / decelerazione del movimento
_Ritocco veloce, alto ritorno. Toglie il "legnoso" del movimento istantaneo._

**Dove:** `src/scenes/GameScene.js` movimento giocatore righe 2043-2052 (oggi `this.player.setVelocityX(vx)`
è ISTANTANEO). Costanti in `src/state.js` (`newPlayer()` / `CONFIG`).

**Approccio:**
1. Introdurre una velocità target `vx` (come ora) e far tendere la velocità reale verso il target con
   accelerazione: es. `cur = Phaser.Math.Linear(cur, vx, accel)` per frame, o `Math.approach`, con
   `accelGround` più reattiva e `accelAir` più molle. Fermata con una decelerazione (attrito) quando non
   si preme nulla.
2. Mantenere ISTANTANEI: lo scatto (dash, riga 2051) e i casi speciali (accovacciato ×0.45, slime ×0.5)
   applicandoli al target, non saltando la lerp.
3. Valori di partenza "sensati" (accel terra alta ~0.25-0.35, aria più bassa) da tarare a sensazione col
   collaudo. Non rendere il PG scivoloso: obiettivo è morbidezza, non ghiaccio.

**Collaudo:** provare corsa, inversione di direzione, salto+movimento in aria, dash: deve sembrare più fluido
ma ancora preciso. Chiedere all'utente il "sentore" finale (è soggettivo).

- [ ] 3 accel/decel implementata e verificata; valori tarati con l'utente.

---

## Dopo questo blocco (non ora)
Rarità colori fatta → possibili "eventi casuali" aggiuntivi; poi si valuterà con l'utente se aprire il
**rifacimento estetico** (look gommoso/muro di muco unico/livelli scorrevoli) o la strada **Google Play**
(Capacitor + ottimizzazione `assets_data.js` ~4.6MB). Vedi `HANDOFF.md` §DA FARE e backlog estetico.
