# Earwax War — Piano esecutivo (blocco "Animazioni + carattere")

> 📄 **A cosa serve questo file:** è la "lista di lavoro" del blocco in corso (con le caselle da
> spuntare), usa e getta: quando il blocco è chiuso e playtestato, i risultati si travasano in
> `HANDOFF.md` e questa lista si azzera per il blocco dopo. Per lo **stato generale** del progetto,
> come collaudare e le regole vedi **`HANDOFF.md`**; per la descrizione del gioco vedi **`README.md`**.

_Pianificato con Opus il 2026-07-11. Pensato per essere ESEGUITO da Sonnet, un passo alla volta._
_Regole: god-mode nei test SEMPRE, i18n EN+IT per ogni stringa, commit solo su richiesta dell'utente,_
_mai lasciare il god-mode nel codice committato._

> ⚠️ **VINCOLO DI QUESTO BLOCCO — l'assistente è "cieco" sull'aspetto.** Il preview renderizza ma
> l'immagine NON arriva integra all'assistente (canale di trasferimento che corrompe i frame). Perciò:
> l'assistente costruisce e verifica la **LOGICA** dell'animazione (i valori di scala cambiano nel modo
> giusto al momento giusto, i tempi tornano, niente crash, la scala torna a riposo), e **l'UTENTE giudica
> come APPARE e si SENTE** con un playtest sul telefono, dicendo cosa ritoccare. Tenere quindi i "numeri"
> (ampiezze/durate) in costanti facili da cambiare.

## Come usare questo file (per Sonnet)
- Esegui le FASI in ordine. Ogni fase è un blocco piccolo e auto-contenuto, con questo ciclo FISSO:
  1. implementa;
  2. **controllo qualità automatico** sulla modifica (`/code-review` e/o skill *verify*); correggi prima di chiudere;
  3. collauda dal vivo la LOGICA col god-mode (loop-pumping — vedi `HANDOFF.md` §Come provare);
  4. riferisci all'utente in italiano semplice, elencando cosa deve GUARDARE lui al playtest;
  5. chiedi se committare.
- Se un dettaglio non torna col codice reale, fermati e chiedi all'utente invece di improvvisare.
- Aggiorna la casella `[ ]`→`[x]` quando una fase è verificata (logica), annotando ostacoli/decisioni.

---

## FASE A — "Juice" procedurale (schiacciamento/allungamento). NIENTE nuovi sprite.
_Il primo passo: dare "vita" col codice sugli sprite già esistenti. Alto ritorno, tutto verificabile
dall'assistente; l'utente giudica solo la sensazione. Completa l'accel/decel del blocco precedente._

**Idea:** il personaggio si **allunga** quando salta (alto/sottile), si **schiaccia** quando atterra
(largo/basso) e rimbalza indietro a riposo; piccola schiacciata anche quando inverte la corsa e quando
incassa un colpo. Effetto morbido e discreto (aliveness, non gomma da cartone).

**Nodo tecnico da rispettare:** la scala del PG è impostata OGNI FRAME a
`src/scenes/GameScene.js` riga ~2277 (`this.player.setScale(1.5, this.crouching ? 1.02 : 1.5)`), per
l'accovacciamento. Quindi NON usare tween di scala (confliggerebbero): usare un sistema a **molla** con
due moltiplicatori che decadono verso 1 ogni frame, e ripiegarli in QUELL'UNICA riga di setScale.

**Passi:**
1. **Costanti** in `src/state.js` `CONFIG` (accanto a `MOVE_ACCEL_*`), così l'utente le tara facile:
   `JUICE_SPRING: 0.2` (quanto in fretta torna a riposo), `JUICE_LAND: 0.22`, `JUICE_JUMP: 0.14`,
   `JUICE_TURN: 0.08`, `JUICE_HIT: 0.25` (ampiezze massime).
2. **Stato** in `create()` (dopo aver creato `this.player`): `this.jx = 1; this.jy = 1;`
   `this._wasOnGround = true; this._prevVelY = 0; this._lastFacing = 1;`
3. **Molla + scala finale**: sostituire la riga 2277 con:
   - prima far tendere i moltiplicatori a 1: `this.jx += (1 - this.jx) * CONFIG.JUICE_SPRING;`
     idem `this.jy` (uguale con jy);
   - poi la scala: `this.player.setScale(1.5 * this.jx, (this.crouching ? 1.02 : 1.5) * this.jy);`
4. **Salto (allungo)** nel blocco `if (wantJump && this.jumpsLeft > 0)` (~riga 2287, dove c'è
   `window.Sfx.jump()`): `this.jx = 1 - CONFIG.JUICE_JUMP; this.jy = 1 + CONFIG.JUICE_JUMP;`
5. **Atterraggio (schiaccio)**: serve la velocità di caduta PRIMA che il pavimento la azzeri → in fondo
   all'update salvare `this._prevVelY = this.player.body.velocity.y;` e rilevare l'atterraggio col
   passaggio aria→terra:
   `const landed = onGround && !this._wasOnGround; this._wasOnGround = onGround;`
   Se `landed`: `const impact = Phaser.Math.Clamp(this._prevVelY / p.jumpVelocity, 0, 1.4);`
   `const a = CONFIG.JUICE_LAND * (0.5 + 0.5 * impact); this.jx = 1 + a; this.jy = 1 - a;`
   (usare `onGround` già calcolato a ~riga 2219; mettere il rilevamento dopo quel calcolo).
6. **Inversione di corsa (piccola schiaccia)**: dopo aver deciso `this.facing`, se
   `onGround && this.facing !== this._lastFacing && Math.abs(this.player.body.velocity.x) > 10` →
   `this.jx = 1 + CONFIG.JUICE_TURN; this.jy = 1 - CONFIG.JUICE_TURN;`. Aggiornare sempre `this._lastFacing = this.facing;`
7. **Colpo incassato (schiaccia netta)**: in `hurtPlayer`, SOLO quando il danno viene davvero applicato
   (non quando lo scudo para, non se invulnerabile): `this.jx = 1 + CONFIG.JUICE_HIT; this.jy = 1 - CONFIG.JUICE_HIT;`
8. (Opzionale, se resta semplice) micro-"bob" in corsa a terra: un `Math.sin` di piccola ampiezza (~0.02)
   su `jy` mentre `onGround && |vx|>10`. Se complica, rimandare alla Fase C.

**Attenzione (da segnalare all'utente per il playtest):** con l'origine dello sprite al centro, lo
schiacciamento "solleva i piedi" di un pelo. Se al playtest stona, la cura è mettere l'origine in basso
(`this.player.setOrigin(0.5, 1)` + ricalcolo dell'offset del corpo) — ma è più invasivo, farlo solo se serve.

**Collaudo LOGICA (god-mode, loop-pumping):**
- salto → `jy > 1` subito dopo, poi torna verso 1 nei frame successivi;
- caduta + atterraggio → `jy < 1` sul frame di atterraggio, poi rimbalza a ~1;
- inversione a terra in corsa → piccola schiaccia;
- colpo (per questo test togliere il god-mode) → schiaccia; scudo attivo → NIENTE schiaccia;
- a riposo la scala torna esattamente a `(1.5, 1.5)`; accovacciato resta `scaleY ≈ 1.02`; nessun crash.

**Da GUARDARE (utente, playtest):** il personaggio sembra più "vivo" senza sembrare di gomma? Salto e
atterraggio "pesano" bene? I piedi restano piantati a terra? Numeri troppo/poco marcati? (si tarano in `CONFIG`.)

- [ ] A juice procedurale implementato, logica verificata; numeri tarati col playtest dell'utente.

---

## FASE B — Carattere comico: "versetti"/frasi (fumetto)
_Quasi tutta logica: un fumetto con una battuta casuale a certi eventi. Tono scherzoso (come vuole l'utente)._

**Bozza (dettagliare quando si arriva qui):** pool di frasi brevi in `i18n.js` (EN+IT), mostrate in un
piccolo fumetto sopra il PG a eventi scelti (inizio livello / uccisione / colpo incassato / boss), con
cooldown per non spammare. Riusare lo stile grafico esistente (`showBanner`/testo). Verificabile: la frase
giusta compare all'evento giusto col cooldown; l'utente giudica tono e piazzamento.

- [ ] B carattere comico (fumetto + frasi) implementato e verificato.

---

## FASE C — Sprite d'animazione veri (camminata, strisciamento nemici)
_Ultima perché è la più dipendente dall'occhio dell'utente (fotogrammi pixel disegnati)._

**Bozza:** oggi `anims.play('walk')` usa `player_a`/`player_b` identici (segnaposto, non si vede nulla).
Servono fotogrammi veri (camminata del PG, strisciamento di cerumino/gorgogliante). Flusso asset come per
il cerume (generazione immagini → ritaglio → embed). Da pianificare in dettaglio con l'utente, che deve
fornire/validare i fotogrammi. Il micro-"bob" della Fase A può fare da ponte nel frattempo.

- [ ] C sprite d'animazione veri implementati e verificati.

---

## Dopo questo blocco (non ora)
Con più "anima" a posto, i prossimi grandi assi restano (vedi `HANDOFF.md` §DA FARE): **rifacimento
estetico** (look gommoso/organico) e/o **strada verso Google Play** (ottimizzare assets + Capacitor).
