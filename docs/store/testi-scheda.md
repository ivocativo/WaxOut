# Testi per la scheda su Google Play

Da incollare in Play Console. I limiti di lunghezza sono quelli imposti da Google: se si superano,
il campo non si salva. Accanto a ogni testo c'è il conteggio dei caratteri, da rifare se si modifica.

I conteggi qui sotto sono MISURATI, non stimati: scrivendoli a occhio si sbaglia — al primo
giro avevo scritto 1638 su una descrizione che ne ha 2148. Per rifarli dopo una modifica c'e'
`tools/conta_scheda.py`, che legge questo stesso file e confronta ogni testo col suo limite.

Play chiede questi testi **per ogni lingua** che si vuole supportare. Il gioco è già in italiano e
inglese, quindi conviene mettere entrambe: la scheda in italiano la vedono gli utenti italiani,
quella in inglese tutti gli altri.

---

## ITALIANO

### Nome dell'app — max 30 caratteri
```
Waxout: The Earwax War
```
*(22 caratteri)*

### Descrizione breve — max 80 caratteri
È la riga che si legge sotto al titolo nei risultati di ricerca: deve dire cosa si fa.
```
Pulisci il condotto uditivo a colpi di spruzzino. E il cerume si difende.
```
*(73 caratteri)*

### Descrizione completa — max 4000 caratteri
```
Sei stato assunto per il lavoro peggiore del mondo: fare pulizia dentro un orecchio.

Waxout è un gioco d'azione a scorrimento in cui ti fai strada lungo un condotto uditivo armato
di spruzzino e coton fioc. Il cerume non sta lì fermo ad aspettarti: si è organizzato, e ha
tirato su delle creature per difendersi.

COME SI GIOCA
Pulisci almeno l'80% del cerume di ogni livello, poi raggiungi il timpano per passare al
successivo. Sembra semplice finché non ti accorgi che qualcosa ti sta salendo dietro la schiena.

- Spruzzino per colpire da lontano e sciogliere il cerume
- Coton fioc per il corpo a corpo, quando ti arrivano addosso
- Salta in testa ai nemici per rimbalzare e schiacciarli
- Abbassati per passare nei cunicoli stretti e per prendere i nemici bassi

OGNI PARTITA È DIVERSA
I livelli si generano ogni volta: colline, cunicoli, pedane sospese e membrane da sfondare non
sono mai negli stessi punti. E a metà strada scegli tu che rischio correre, con una porta sicura
e una che paga il doppio ma non perdona.

Tra un livello e l'altro peschi un potenziamento: getto a ventaglio, colpi che rimbalzano, sapone
corrosivo, una bolla che combatte con te, raffiche in tutte le direzioni. Alcuni si accumulano,
altri si fondono fra loro in versioni più forti.

CINQUE MODI DI SUDARE
- Normale: pulisci e arriva in fondo
- Sciame: ne arrivano tanti insieme
- Assedio: eliminane un tot prima che scada il tempo
- Corsa: il timpano è lontano e il cronometro corre
- Boss: tre bestie diverse, ognuna col suo modo di ammazzarti

NON FINISCE QUANDO PERDI
Il cerume raccolto resta anche se muori, e si spende in potenziamenti permanenti: più vita, più
danno, più velocità, e progetti che sbloccano abilità nuove. Le prime partite servono a
attrezzarsi. E quando finalmente vinci, si apre il grado di Infezione: nemici più cattivi, ma
anche più cerume.

FATTO PER IL TELEFONO
Comandi a schermo pensati per il pollice, partite da una ventina di minuti, funziona senza
connessione.

NIENTE FASTIDI
Nessuna pubblicità. Nessun acquisto dentro l'app. Nessun account da creare. Non raccogliamo
nessun dato: i tuoi progressi restano sul telefono e basta.
```
*(2148 caratteri)*

---

## INGLESE

### Nome dell'app — max 30 caratteri
```
Waxout: The Earwax War
```
*(22 caratteri)*

### Descrizione breve — max 80 caratteri
```
Blast the earwax out of an ear canal. The wax has other plans.
```
*(62 caratteri)*

### Descrizione completa — max 4000 caratteri
```
You got hired for the worst job in the world: cleaning the inside of an ear.

Waxout is a side-scrolling action game where you fight your way down an ear canal armed with a
spray bottle and a cotton swab. The wax is not sitting there waiting for you. It got organised,
and it grew things to defend itself.

HOW IT PLAYS
Clean at least 80% of the wax in each level, then reach the eardrum to move on. Sounds simple,
right up until something climbs up behind you.

- Spray to hit at range and dissolve the wax
- Cotton swab for close quarters, when they get on top of you
- Jump on enemies to bounce off and squash them
- Crouch to slip through tight passages and to hit the low ones

NO TWO RUNS ALIKE
Levels are generated fresh every time: hills, tunnels, floating platforms and membranes to smash
are never in the same place twice. Halfway through you pick your own risk, choosing between a
safe door and one that pays double but does not forgive.

Between levels you draw an upgrade: spread shot, bouncing pellets, corrosive soap, a bubble
companion that fights alongside you, bursts that fire in every direction. Some stack, some fuse
together into stronger versions.

FIVE WAYS TO SWEAT
- Normal: clean it out and reach the end
- Swarm: a lot of them, all at once
- Siege: wipe out a quota before the clock runs out
- Rush: the eardrum is far and the timer is running
- Boss: three different beasts, each with its own way of killing you

LOSING IS PART OF IT
The wax you collect stays with you when you die, and buys permanent upgrades: more health, more
damage, more speed, plus blueprints that unlock new abilities. The early runs are how you kit
yourself out. And when you finally win, Infection tiers open up: nastier enemies, but richer
pickings.

BUILT FOR PHONES
Touch controls made for thumbs, runs of about twenty minutes, works with no connection.

NO NONSENSE
No ads. No in-app purchases. No account to create. We collect no data at all: your progress stays
on your phone and nowhere else.
```
*(2004 caratteri)*

---

## Materiali grafici

| cosa | file | stato |
|---|---|---|
| Icona 512×512 | `android-res/` (generata da `tools/fai_icone.py`) | ✅ |
| Copertina 1024×500 | `docs/store/copertina.png` | ✅ |
| Schermate telefono | `docs/store/schermate/*.png` (1920×1080) | ✅ 5 |

Le schermate si rifanno con `python tools\fai_schermate.py`, la copertina con
`python tools\fai_copertina.py`. Sono catturate dal gioco vero, non montate: quello che si vede
sullo store è quello che ci si trova installato.

---

## ⚠️ Cose da NON scrivere nella scheda

Play rifiuta le schede che promettono cose non vere o che imitano altri. In particolare:
- non scrivere che è "il migliore" o "il numero 1";
- non mettere "scarica ora", frecce o finti pulsanti dentro le immagini;
- non citare altri giochi o marchi;
- non dire che è gratis "per un periodo limitato" se non è vero.

E soprattutto: la riga "nessuna pubblicità, nessun acquisto, nessun dato raccolto" **oggi è vera**
(verificata leggendo il codice, vedi `docs/privacy.html`). Se un domani si aggiungono le
pubblicità, vanno cambiate insieme: questa descrizione, l'informativa sulla privacy e la scheda
"Sicurezza dei dati". Lasciarne indietro una è il tipo di incoerenza che fa sospendere un'app.
