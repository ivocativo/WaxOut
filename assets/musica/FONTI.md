# Musica — provenienza e licenza

I quattro brani del gioco sono **CC0** (pubblico dominio): si possono usare in un gioco
commerciale, modificare e pubblicare **senza citare nessuno e senza pagare nulla**.

⚠️ **Da compilare prima di pubblicare sullo store.** Anche se il CC0 non obbliga a citare la
fonte, avere qui scritto da dove arriva ogni brano e' l'unica difesa se un domani qualcuno
contestasse un pezzo. Servono trenta secondi adesso e valgono un sacco dopo.

| file | usato per | da dove | link |
|---|---|---|---|
| `menu.ogg` | schermata iniziale | _(da compilare)_ | |
| `livello.ogg` | livelli normali | _(da compilare)_ | |
| `boss.ogg` | boss e assedio | _(da compilare)_ | |
| `vittoria.ogg` | run vinta | _(da compilare)_ | |

## Come sono stati preparati

Sorgenti originali (MP3/WAV, 39 MB in tutto) convertiti con:

```
python tools\bake_musica.py <sorgente> assets\musica\<nome>.ogg 1 [secondi_max]
```

Lo strumento converte in OGG Vorbis (il formato che il webview Android legge da solo),
**normalizza il volume** con lo standard EBU R128 — i brani CC0 arrivano da autori diversi e
hanno livelli molto lontani tra loro — toglie il silenzio iniziale e, se si passa un tetto di
secondi, taglia con una dissolvenza di 2,5 secondi.

Tagli applicati:

- **menu**: da 5:37 a **2:00**. Nel menu si sta una ventina di secondi: tenere cinque minuti e
  mezzo di musica erano 3 MB di app per una coda che nessuno avrebbe mai sentito.
- **vittoria**: da 2:40 a **1:40**.
- **livello** (1:24) e **boss** (2:51): interi.

Totale: **4,4 MB**. Gli originali non stanno nel repository: se servono ri-tagli diversi,
rigenerali dai file che hai sul PC.
