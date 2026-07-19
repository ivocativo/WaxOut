# Earwax War — Piano esecutivo (blocco "Round 4 — Condotto a larghezza variabile")

> 📄 **A cosa serve questo file:** è la "lista di lavoro" del blocco in corso (caselle da spuntare),
> usa e getta. Stato generale + backlog completo in **`HANDOFF.md`**; descrizione gioco in `README.md`.
> Regole: god-mode nei test MA anche ≥1 prova SENZA god-mode (bug di danno/traversabilità), i18n EN+IT
> per stringhe nuove, commit solo su richiesta.

_Preparato 2026-07-18 da Opus. Scelto dall'utente come primo blocco di "contenuti nuovi" — non serve_
_grafica nuova, usa il rendering e la fisica che ci sono già._

---

## Obiettivo e decisioni di design
Oggi il condotto è un tunnel di **altezza fissa** (soffitto piatto y≈50, pavimento piatto y=360 →
apertura 310px per tutto il livello). Vogliamo che la **larghezza (apertura verticale) VARI** lungo il
livello: tratti **ampi** (arene aperte) e tratti **stretti** (passaggi angusti). Rinfresca ogni livello.

**Decisioni (per tenere il rischio basso):**
- **Il PAVIMENTO resta PIATTO e walkable ovunque** (niente pendii/gradini → zero rischio "player
  incastrato"). La variazione viene **dal SOFFITTO che ondeggia** e scende (pinch) in alcuni tratti.
- **Regola di SICUREZZA ASSOLUTA — traversabilità:** l'apertura al pavimento (`360 - ceilingYAt(x)`)
  non deve MAI scendere sotto ~90px, così il giocatore passa SEMPRE camminando (corpo PG ~60px). Un
  pinch non può mai chiudere il condotto. (Opzione futura: pinch un filo più bassi che obbligano ad
  accovacciarsi — solo se garantiamo che l'accovacciato passi; RIMANDATO a dopo.)
- **Niente pinch** sopra l'area di partenza (primi ~600px) né sopra il timpano/goal (ultimo tratto).
- Il **bordo alto del mondo fisico resta a `CEIL_Y`** (il punto più alto); i pinch sono collider
  statici che scendono sotto di esso.

## Come funziona (profilo del soffitto)
- Nuovo `buildCeilingProfile()` (in `create()` prima di `buildLevel`) genera 2-5 "pinch" per livello
  (cresce col livello), a x casuali (fuori da partenza/goal), ciascuno con **profondità** e **larghezza**
  casuali entro limiti sicuri; rampe morbide (coseno) tra ampio e stretto.
- Helper `ceilingYAt(x)` → y del BORDO BASSO del soffitto in quel punto (default `CEIL_Y`, più in basso
  nei pinch). Tutto ciò che "pende dal soffitto" userà questo invece del vecchio `CEIL_Y` fisso.

---

## GRUPPO VC-A — Profilo + disegno del soffitto  🎨(codice)
- [ ] **VC-A.1** `buildCeilingProfile()` + `ceilingYAt(x)` (con clamp di sicurezza sull'apertura min).
- [ ] **VC-A.2** Ridisegnare il soffitto come **forma piena che segue il profilo** (Graphics, stessa
  palette carnosa `C.ground`/`C.groundDark`, campionando ogni ~16px) al posto della fascia piatta
  attuale (`create()` righe ~132-135). Verifica visiva: tratti ampi e stretti ben leggibili.

## GRUPPO VC-B — Collisione del soffitto ondulato  🧱
- [ ] **VC-B.1** Nei pinch, **collider statici** (gruppo dedicato `ceilingBlocks`, come `platforms`)
  che scendono da `CEIL_Y` fino a `ceilingYAt(x)` — una "scaletta" di 3-5 rettangoli per pinch che
  approssima la rampa morbida (collisione AABB). Collider un filo più ALTI del bordo visivo (~4-6px)
  così non si vede il PG "entrare" nel soffitto. Aggiungere i collider a player + enemies +
  projectiles (come i `blocks`).
- [ ] **VC-B.2** Verifica CHIAVE — **traversabilità automatica**: su molte generazioni (≥20 livelli),
  simulare/controllare che il PG possa andare da spawn al goal (nessun pinch invalica l'apertura min).
  + prova SENZA god-mode: il PG non muore/incastra nei pinch. Il salto sbatte il soffitto nei tratti
  bassi (blocked.up) ma a terra passa sempre.

## GRUPPO VC-C — Agganciare tutto ciò che dipende dal soffitto al profilo LOCALE  🔗
Sostituire il `CEIL_Y` fisso con `ceilingYAt(x)` dove qualcosa pende/è ancorato in alto:
- [ ] **VC-C.1** Pedane (`buildPlatforms`, `clampAbove`): il tetto minimo diventa
  `ceilingYAt(px) + 56` invece di `CEIL_Y + 56` (nessuna pedana dentro il soffitto locale).
- [ ] **VC-C.2** Stalattiti terremoto (`addStalactite`, y=`CEIL_Y`) e chunk frana (`CEIL_Y+4`) →
  `ceilingYAt(cx)`.
- [ ] **VC-C.3** Gocce dal soffitto (`addDripHazard`/`updateDrips`, `topY`) → `ceilingYAt(cx)`.
- [ ] **VC-C.4** Cumuli di cerume a soffitto (`buildCeilingMound`) → ancorare a `ceilingYAt(mx)`.
- [ ] **VC-C.5** Controllare volanti (restY 90-170): nei pinch profondi assicurarsi che non restino
  sopra il soffitto locale (clamp la quota di hover a `ceilingYAt+margine`).

## GRUPPO VC-D — Tuning, sicurezza, chiusura  🎚️
- [ ] **VC-D.1** Tarare numero/profondità/larghezza dei pinch per livello (crescono col livello ma
  restano equi). Garantire: partenza e goal sempre ampi; apertura min rispettata ovunque.
- [ ] **VC-D.2** Giro finale: nessuna stringa i18n nuova prevista; niente errori console;
  performance ok (i collider extra sono pochi e statici). Aggiornare `HANDOFF.md`.

---

## Ordine: VC-A → VC-B → VC-C → VC-D
Ciclo per gruppo: implementa → collaudo DAL VIVO (god-mode + una prova senza) → screenshot/dati →
riferisci in italiano semplice → chiedi se committare. Numeri (n. pinch, profondità, larghezze) da
TARARE col playtest dell'utente. **Priorità assoluta: il condotto resta sempre attraversabile.**

### PROTOTIPO TERRENO stile Terraria (2026-07-18) — l'utente ha bocciato i rilievi-rettangolo
Feedback utente: i rilievi a rettangolo erano brutti, le buche non si notavano. Nuova direzione
approvata: **terreno irregolare a gradini** (montagnole, saliscendi, cunette). Fatto un PROTOTIPO
(solo personaggio):
- `buildTerrain()` genera un profilo di ALTEZZA a pendenze dolci (colline sopra il pavimento),
  quantizzato a gradini di `TERR_STEP=18`; disegno VISIVO a mattoni (`terrainHeightAt`/`terrainTopAt`).
- Camminata via **MAPPA DI ALTEZZE** (heightmap-snap) nel player update: aggancio i piedi a
  `terrainTopAt` frame per frame (sposto `body.y`, NON lo sprite — l'orizzontale resta al motore).
  Niente blocchi-collisione → niente "cuciture" che incastravano. Cap salita 26/frame, discesa 34.
- **Trappole tecniche risolte:** (1) blocchi separati catturavano il PG sugli spigoli → passato a
  heightmap; (2) `body.updateFromGameObject()` ogni frame CONGELA l'orizzontale → uso `body.y -= …`.
- Rilievi-rettangolo e pozze-buca del round 4 DISABILITATI (bumpCount/pitCount = 0); il codice
  `addBump`/`addPit` resta finche' il terreno non e' confermato, poi si rimuove.
- Verificato: PG cammina su/giu' colline fino a 108px, mai incastrato. **DA FARE se approvato:**
  nemici sul terreno, cunette SOTTO il pavimento (serve togliere il pavimento piatto), rifinitura
  visiva (ora colline color-carne + bordo scuro), taratura ampiezza/frequenza.

---

## STATO: FATTO E VERIFICATO (2026-07-18) — poi rifiniture su richiesta utente
Implementato e collaudato dal vivo (dati + screenshot, god-mode e prove senza):
- **VC-A** profili IRREGOLARI (spezzata) di soffitto e pavimento; pavimento irregolare SOLO VISIVO
  (camminata piatta = sicuro). Generatore condiviso `_makeProfile` (stesso ritmo = coerenti).
- **Rifinitura utente 1:** restringimenti soffitto più DELICATI e coerenti col pavimento.
- **Rifinitura utente 2:** soffitto MOLTO più variabile — componente "lenta" che crea **stanze ampie**
  (soffitto fin quasi al bordo alto, apertura ~350) alternate a tratti raccolti; apertura min ~227
  (sempre attraversabile).
- **VC-B** collisione soffitto = scaletta di collider statici (`ceilBlocks`) che segue il profilo;
  bordo alto mondo → 0 così le stanze ampie sono raggiungibili. Verificato: zona alta raggiungibile,
  zona bassa ferma la testa.
- **VC-C** pedane clampate sotto il soffitto LOCALE (0 conflitti su test); stalattiti/frane/gocce/
  cumuli-a-soffitto ancorati a `ceilingYAt`; moscerini tenuti sotto il soffitto locale.
- **RILIEVI** (`terrainBumps`): gobbe solide saltabili, collidono col SOLO giocatore (nemici le
  sorpassano). **BUCHE** (`pitZones`): pozze scure che feriscono se ci stai a terra → si saltano.
  Verificato: rilievo blocca la camminata e si scavalca col salto; buca toglie ~20 HP in ~2s.
- Zero errori console. **Look organico VERO da fare dopo con l'arte** (ora è la FORMA, spigolosa).
NON ancora committato al momento della scrittura di questa riga.
