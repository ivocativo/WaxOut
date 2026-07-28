# Musica — provenienza e licenza

Tutti i brani vengono da **OpenGameArt.org**. Verificati il 2026-07-28 confrontando la durata dei
file originali con quella dei brani caricati sul sito: la corrispondenza e' al centesimo di secondo
su tutti e quattro, quindi l'abbinamento qui sotto e' certo.

| file | usato per | brano | autore | pagina | licenza |
|---|---|---|---|---|---|
| `menu.ogg` | schermata iniziale | *Menu / Running Title* (file `New age.mp3`) | **R0B B3RY** (Rob Bery) | [menu-running-title](https://opengameart.org/content/menu-running-title) | **CC0** ✅ ma vedi sotto |
| `livello.ogg` | livelli normali | *Race of the Wasp* | OwlishMedia | [race-of-the-wasp](https://opengameart.org/content/race-of-the-wasp) | **CC0** ✅ |
| `boss.ogg` | boss e assedio | *Boss Battle Theme* | CleytonKauffman (CleytonRX) | [boss-battle-theme](https://opengameart.org/content/boss-battle-theme) | **CC0** ✅ |
| `vittoria.ogg` | run vinta | *Midnight Explosion* | iamoneabe | [midnight-explosion](https://opengameart.org/content/midnight-explosion) | **CC0** ✅ |

Scartato, NON nel gioco: *Crate Punks OST* di Shuhei Yasuda (9:13, punk) — il file
`cratePunksOST_5.mp3`, sostituito da *Boss Battle Theme*.

## ⚠️ L'AUTORE DEL BRANO DEL MENU CHIEDE DI ESSERE CITATO

Scheda ritrovata (2026-07-28, link dell'utente): **licenza CC0 confermata**, con il collegamento
alla dedica di pubblico dominio. Nessun obbligo legale, quindi.

**Pero'** nella stessa scheda l'autore scrive:

> "By using this file you are committed to mention 'Rob Bery' and 'Rob Bery Art'"

Cioe': la licenza dice "fanne quel che vuoi", il testo accanto chiede di citarlo. Le due cose si
contraddicono — il CC0 esiste apposta per NON poter aggiungere condizioni — e in una disputa la
licenza vale piu' della frase. Ma la richiesta e' esplicita, e citare qualcuno costa una riga.

**Decisione da prendere:** aggiungere una schermata (o una riga) di CREDITI. Non serve solo per
lui: gli altri tre autori non lo pretendono, ma citarli e' corretto, e sullo store una sezione
crediti fa buona impressione. Il posto piu' economico e' il pannello "?" gia' presente nel menu.

## Come sono stati preparati

```
python tools\bake_musica.py <sorgente> assets\musica\<nome>.ogg 1 [secondi_max]
```

Converte in OGG Vorbis (il formato che il webview Android legge da solo), **normalizza il volume**
con lo standard EBU R128 — i brani vengono da autori diversi e avevano livelli lontanissimi tra
loro, cosa che il cursore del volume non sistema — toglie il silenzio iniziale e, se si passa un
tetto di secondi, taglia con una dissolvenza di 2,5 secondi.

| brano | originale | nel gioco | perche' |
|---|---|---|---|
| menu | 5:37 | **2:00** | nel menu si sta una ventina di secondi: il resto erano 3 MB di coda mai sentita |
| livello | 1:23 | 1:23 | intero |
| boss | 2:51 | 2:51 | intero |
| vittoria | 2:40 | **1:40** | |

Totale **4,4 MB** (gli originali erano 39). I file sorgente NON stanno nel repository: per rifare
un taglio diverso si riscaricano dai link qui sopra.
