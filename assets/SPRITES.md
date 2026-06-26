# Earwax War — Piano sprite (grafica vera)

Passaggio da texture-generate-da-codice a **veri file immagine** (PNG pixel-art).
Stile scelto: **direzione A — viscido/lucido** (vedi mockup). I PNG si disegnano
in **LibreSprite** (sprite/animazioni) e **Krita** (texture organiche di sfondo),
poi si caricano in Phaser col loader (`this.load.image/spritesheet`).

Convenzioni:
- **Risoluzione nativa bassa** (pixel-art vero): le misure sotto sono in pixel
  "veri"; il gioco li ingrandisce (Phaser `pixelArt: true`).
- Sfondo trasparente, **contorno scuro 1px** (`#14161f`) attorno alla silhouette.
- Palette coerente col gioco (cerume miele, pelle, tuta blu, ecc.).
- Per le animazioni: una **sprite sheet** orizzontale (frame affiancati) oppure
  PNG separati `nome_1.png`, `nome_2.png`… (decidiamo quando carichiamo).

Legenda priorità: ⭐ subito · ◾ presto · ▫ dopo.

## Personaggio (l'eroe — "spelunker dell'orecchio")
Idea carattere: piccolo esploratore con **lampada frontale** (sta esplorando un
orecchio!), tuta blu. Espressioni per dargli personalità (backlog).

| Sprite | Dim. nativa | Frame | Animazione | Prio |
|---|---|---|---|---|
| `hero_idle` | 20×30 | 2 | respiro/oscillazione lieve | ⭐ |
| `hero_run`  | 20×30 | 4–6 | corsa | ⭐ |
| `hero_jump` | 20×30 | 1–2 | salto / caduta | ◾ |
| `hero_attack` | 24×30 | 2–3 | colpo cotton fioc | ◾ |
| `hero_hurt` | 20×30 | 1 | colpito (lampeggia) | ◾ |
| `hero_taunt` | 20×30 | 2–3 | gesto buffo / verso (carattere) | ▫ |

## Nemici
| Sprite | Dim. nativa | Frame | Animazione | Prio |
|---|---|---|---|---|
| `cerumino` (blob) | 22×20 | 2 | oscilla/cammina | ⭐ |
| `crosta` (crust)  | 22×18 | 2 | cammina lenta | ◾ |
| `moscerino` (fly) | 20×16 | 2 | battito ali | ◾ |
| `gorgogliante` (spit) | 24×22 | 2–3 | idle + sputo | ◾ |
| `boss_tappo` | 44×40 | 3 | idle + sputo + colpito | ◾ |

## Cerume / muro
| Sprite | Dim. nativa | Frame | Note | Prio |
|---|---|---|---|---|
| `wax_glob` (proiettile) | 12×12 | 1–2 | pallina sputata | ⭐ |
| `wax_drip` (goccia) | 10×18 | 2–3 | goccia che cola | ⭐ |
| `wax_chunk` | 24×24 | 1 | "mattone" gommoso per la massa | ◾ |
| `wax_splat` | 24×24 | 3 | schizzo alla rottura | ▫ |

## Armi
| Sprite | Dim. nativa | Note | Prio |
|---|---|---|---|
| `swab` (cotton fioc) | 40×10 | arma iniziale | ◾ |
| `hammer` (martello cerume) | 42×32 | arma ad area | ▫ |

## Ambiente / sfondo (Krita)
| Sprite | Dim. | Note | Prio |
|---|---|---|---|
| `bg_canal` | grande, panoramico | parete del condotto (dipinto) | ◾ |
| `eardrum` | medio | timpano in fondo | ▫ |
| `floor_tile` | tileable | pavimento del condotto | ◾ |
| `membrane` | medio | diaframma di muco da sfondare (livelli scroll) | ▫ |
| `platform` | tileable | pedana per il platforming | ▫ |

## FX / particelle / UI
| Sprite | Dim. | Note | Prio |
|---|---|---|---|
| `bit_wax/dirt/hard` | 5×5 | particelle (già ok da codice) | ▫ |
| `icon_wax` | 16×16 | icona cerume (HUD/negozio) | ▫ |
| `icon_heart` | 16×16 | icona vita | ▫ |
| `btn_panel` | 9-slice | cornice pulsanti/menu | ▫ |

---
**Generati come bozza (2026-06-26)** in `assets/sprites/`: `hero_idle`,
`cerumino`, `crosta`, `wax_glob`, `wax_drip`. Da rifinire in LibreSprite.
Rigenerabili con `tools/gen_sprites.ps1`.
