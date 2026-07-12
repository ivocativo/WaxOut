# Earwax War — Piano esecutivo (blocco "Personaggio AI animato")

> 📄 **A cosa serve questo file:** è la "lista di lavoro" del blocco in corso (con le caselle da
> spuntare), usa e getta. Per lo **stato generale** del progetto, come collaudare e le regole vedi
> **`HANDOFF.md`**; per la descrizione del gioco vedi **`README.md`**.

_Aggiornato 2026-07-12. Regole: god-mode nei test SEMPRE, i18n EN+IT per ogni stringa nuova,_
_commit solo su richiesta dell'utente. Ultimo commit: `9c9cf84`._

## Decisione di fondo (bloccata con l'utente 2026-07-12)
Il **procedurale a codice** per il personaggio è stato **bocciato** ("qualità bassa"). Si va con:
- **LOOK = immagini AI (Leonardo).** L'utente genera (prompt scritti dall'assistente), l'assistente
  ritaglia/scala/pixela/integra. Personaggio scelto: esploratore (casco+lampada, occhialoni, tuta blu,
  **bombola di sapone gialla** col tubo, guanti, stivali). Sorgente ritagliata: `assets/sprites/hero/hero_ai.png`.
- **ANIMAZIONE = AutoSprite** (autosprite.io): carichi UNA immagine → sprite sheet per stato
  (camminata/corsa/idle/salto/attacco), preserva il design. Export griglia PNG.
- Dettagli e razionale in memoria `earwaxwar-anim-architecture`. Il vecchio "pupazzo procedurale"
  (`gen_hero*.ps1`, rig da pezzi) è **SUPERATO** — file lasciati su disco come riferimento, non usati.

## Pipeline (come si integra una nuova animazione AutoSprite)
1. L'utente genera l'animazione su AutoSprite dalla stessa `hero_ai.png` (vista di profilo, verso destra)
   e la scarica (PNG sprite sheet, griglia NxN — la walk/run erano **5×5 = 25 frame da 256×256**).
2. Copiala in `assets/sprites/hero/hero_<stato>.png`.
3. **Pixela**: `tools/bake_sheet_pixel.ps1 -In ... -Out ..._px.png -Frames 5 -TargetFrame 84 -Levels 6 -AlphaThreshold 110`
   (allinea `-Frames` alla griglia reale; il frame finale = `TargetFrame`).
4. **BootScene**: `this.load.spritesheet('hero_<stato>', ..._px.png, { frameWidth: 84, frameHeight: 84 })`.
5. **GameScene create**: `this.anims.create({ key:'hero_<stato>_a', frames: generateFrameNumbers(...), frameRate, repeat })`.
6. **GameScene update** (blocco "Animazione"): scegli l'anim in base allo stato (onGround/vx/salto/attacco).
7. Collauda a schermo (god-mode + screenshot), riferisci, chiedi se committare.

Nota: `this.player` (fisica) è **invisibile**; il visual è `this.heroVisual` (segue il player, scala
`HERO_SCALE`, origin `HERO_ORIGIN_Y` per i piedi, riceve il juice jx/jy, flip per direzione).

---

## FASI (casella `[ ]`→`[x]` a verifica fatta)

- [x] **Look personaggio** scelto (AI n.3) e approvato dall'utente; ritagliato pulito (`cutout_bg.ps1`).
- [x] **Camminata + corsa** (AutoSprite) integrate, **pixellate** (`bake_sheet_pixel.ps1`, frame 84) e
      rimpicciolite; fisica/hitbox invariati; verificato a schermo. **Committato `9c9cf84`.**
- [ ] **Idle**: generare su AutoSprite → agganciare (sostituisce il placeholder "frame 0 della camminata").
- [ ] **Salto / caduta**: generare → agganciare (sostituisce il frame fisso in aria). Valutare 2 stati
      (stacco vs caduta) o 1 solo.
- [ ] **Attacco**: DECIDERE prima le **armi in mano** (vedi sotto). Poi o anim "attacco" dedicata (arma in
      pugno, mostrata durante lo sparo) oppure si resta con gli effetti a codice.
- [ ] **Embed + peso**: incorporare gli sheet in `assets_data.js` (per `file://`) e/o ottimizzare il peso,
      prima del build Android. (Ora si vedono solo via server/LAN.)
- [ ] **(poi) Nemici/ambiente**: stesso metodo AI+AutoSprite+pixelate per uniformare l'estetica.

### Decisione aperta — armi in mano
Il gioco ha **più armi** (getto di sapone a distanza, coton fioc/martello corpo a corpo, potenziamenti).
Incollare un'arma ai fotogrammi la **fissa** (non riflette i cambi) e obbliga a rigenerare tutto se cambia.
**Consiglio dato:** personaggio senza arma fissa (bombola sulla schiena + effetti d'attacco a codice);
se si vuole l'arma visibile, un'anim "attacco" dedicata solo durante lo sparo. **Da confermare con l'utente.**

### Manopole rapide (per la taratura col playtest utente)
- Dimensione a schermo: `HERO_SCALE` in `GameScene.create` (ora 1.0, frame 84).
- Allineamento piedi: `HERO_ORIGIN_Y` (ora 0.86).
- Livello "pixel": `bake_sheet_pixel.ps1` `-TargetFrame` (più piccolo = pixel più grossi) e `-Levels`.
- Velocità/fluidità: `frameRate` delle anim; soglia corsa in update (ora `vx > moveSpeed*0.85`).

---

## Dopo questo blocco
Playtest/taratura dell'arretrato di gameplay (vedi `HANDOFF.md` §DA FARE) e **strada verso Google Play**
(ottimizzare assets + Capacitor). Uniformare l'estetica (nemici/ambiente) al nuovo personaggio.
