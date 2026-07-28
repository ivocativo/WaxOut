# Musica — provenienza e licenza

Tutti i brani vengono da **OpenGameArt.org**. Verificati il 2026-07-28 confrontando la durata dei
file originali con quella dei brani caricati sul sito: la corrispondenza e' al centesimo di secondo
su tutti e quattro, quindi l'abbinamento qui sotto e' certo.

| file | usato per | brano | autore | pagina | licenza |
|---|---|---|---|---|---|
| `menu.ogg` | schermata iniziale | *New Age* (album "BullHit", 2009) | Rabbit´n Foxes | ⚠️ non trovata (vedi sotto) | ⚠️ **da confermare** |
| `livello.ogg` | livelli normali | *Race of the Wasp* | OwlishMedia | [race-of-the-wasp](https://opengameart.org/content/race-of-the-wasp) | **CC0** ✅ |
| `boss.ogg` | boss e assedio | *Boss Battle Theme* | CleytonKauffman (CleytonRX) | [boss-battle-theme](https://opengameart.org/content/boss-battle-theme) | **CC0** ✅ |
| `vittoria.ogg` | run vinta | *Midnight Explosion* | iamoneabe | [midnight-explosion](https://opengameart.org/content/midnight-explosion) | **CC0** ✅ |

Scartato, NON nel gioco: *Crate Punks OST* di Shuhei Yasuda (9:13, punk) — il file
`cratePunksOST_5.mp3`, sostituito da *Boss Battle Theme*.

## ⚠️ UN CONTROLLO ANCORA DA FARE (prima di pubblicare)

La pagina di origine di **`menu.ogg`** non si e' riusciti a ritrovarla: la ricerca di OpenGameArt
non trova ne' il titolo ("New Age") ne' l'autore ("Rabbit´n Foxes") ne' l'album ("BullHit"), e il
link diretto al file (`.../sites/default/files/New%20age_1.mp3`) non porta alla scheda.

**Perche' conta:** OpenGameArt **non e' un sito di solo CC0**. Ospita anche CC-BY (che obbliga a
citare l'autore), GPL e altre licenze. Gli altri tre brani hanno la scheda con scritto CC0 nero su
bianco; questo no. Se fosse CC-BY servirebbe una schermata CREDITI, che il gioco non ha.

**Cosa fare:** ritrovare la scheda da cui e' stato scaricato (dovrebbe essere nella cronologia del
browser) e scriverla qui. In alternativa, sostituirlo con un altro brano di cui si e' certi.

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
