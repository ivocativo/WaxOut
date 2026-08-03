# Due animazioni da disegnare (playtest round 5)

Qui dentro ci sono i fotogrammi da modificare e i riferimenti. Stessa procedura delle pose di
mira: tu generi o modifichi le immagini, io le cucio e le monto nel gioco.

**Regola che vale per tutti i fotogrammi:** deve restare **esattamente lo stesso personaggio**
(stesso casco, stesso zaino, stesso tubo, stessi colori, stesso spessore del contorno). Cambia
solo la posa. Se cambia il personaggio si vede a schermo che "diventa un altro" appena parte
l'animazione.

Fondo **magenta pieno** (`#FF00FF`) in tutte le immagini: è quello che la lavorazione si aspetta
per ritagliare il personaggio.

---

## 1. Sparo mentre cammini accovacciato — 8 fotogrammi

**File:** `crouchwalk_0.png` … `crouchwalk_7.png`.

Sono i fotogrammi **originali del video** `crouch move.mp4` (i numeri 74, 78, 81, 85, 88, 92, 95,
99), quelli veri da cui è nata la camminata accovacciata che c'è nel gioco — circa 500×570 pixel
l'uno. La versione di prima era ricavata dallo sprite già lavorato: minuscola e sgranata, giusto
buttarla.

**Cosa cambiare, e SOLO questo:** il **braccio davanti** deve stendersi in avanti, orizzontale,
con la **mano aperta e vuota** (l'arma la disegna il gioco e ci si infila dentro dopo). Tutto il
resto — gambe, busto, casco, zaino, inclinazione — deve restare **identico** al fotogramma di
partenza: sono le gambe a raccontare il passo, e se cambiano anche loro l'animazione va a scatti.

**Riferimento di come deve venire il braccio:** `riferimento_braccio_accovacciato.png` (è la posa
di mira accovacciata che il gioco già usa). Copia quel braccio, quella mano e quell'altezza del
gomito.

> Modifica questa immagine pixel art: mantieni identico il personaggio (stesso casco, stesso
> zaino, stesso tubo, stessi colori, stesso contorno) e identiche le gambe e la posizione del
> corpo. Cambia soltanto il braccio anteriore: stendilo in avanti in orizzontale, con la mano
> aperta e vuota, come se puntasse un'arma che non si vede. Sfondo magenta pieno (#FF00FF). Non
> aggiungere ombre, testo o cornici.

L'ombra sotto ai piedi che vedi nei file va bene così: la lavorazione la gestisce già, non serve
toglierla né ridisegnarla.

---

## 2. Attacco corpo a corpo — 4 fotogrammi

Questa è nuova, si disegna da zero. **La prima l'hai già fatta** — l'immagine `ChatGPT Image 2
ago 2026, 20_24_56.png` è esattamente la posa 0, ed è giusta anche la mano chiusa a pugno (sta
impugnando il bastoncino, che disegna il gioco).

Servono **4 pose** in questo ordine: è una bastonata che parte da dietro e finisce in basso.

| n. | posa | cosa deve leggersi | stato |
|---|---|---|---|
| 0 | **carica**: braccio alzato indietro sopra la spalla, busto ruotato indietro, peso sul piede posteriore | "sta per menare" | ✅ fatta |
| 1 | **partenza**: braccio a metà corsa, all'altezza della testa, busto che comincia a ruotare in avanti | il colpo è partito | da fare |
| 2 | **impatto**: braccio disteso in avanti in orizzontale, busto proteso, peso sul piede anteriore | è il fotogramma del colpo | da fare |
| 3 | **fine corsa**: braccio disteso in basso-avanti, busto ancora proteso | il colpo si è scaricato | da fare |

In tutte e quattro: **mano chiusa a pugno**, personaggio rivolto a destra, a figura intera,
piedi appoggiati alla stessa altezza. Usa la posa 0 che hai già come riferimento del
personaggio — così le quattro vengono tutte uguali fra loro.

> Disegna questo personaggio in pixel art, identico all'immagine di riferimento (stesso casco,
> stesso zaino, stesso tubo, stessi colori, stesso spessore del contorno), rivolto a destra, a
> figura intera, in piedi. Posa: [INCOLLA QUI LA POSA DELLA TABELLA]. La mano è chiusa a pugno.
> Sfondo magenta pieno (#FF00FF). Niente ombre, testo o cornici.

---

## Quando hai finito

Rimetti i file in questa cartella e dimmelo. Da lì in poi faccio io: cucitura in un foglio unico
registrato sul "rig" del personaggio (celle 84×84, piedi al 86% dell'altezza, se no il
personaggio salta a ogni cambio di animazione), riduzione alla tavolozza a sei livelli, misura
della posizione della **mano** fotogramma per fotogramma (serve per infilarci l'arma),
registrazione dell'animazione e controlli automatici.
