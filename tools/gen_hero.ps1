# gen_hero.ps1 — genera SOLO lo sprite dell'eroe (esploratore del condotto) e una
# anteprima ingrandita per ispezione. Pixel-art nativa bassa risoluzione, senza
# antialias, contorno scuro 1px automatico attorno alla silhouette.
#
# Uso:  powershell -NoProfile -File tools\gen_hero.ps1 [-Preview <percorso_png>]
#
param(
  [string]$Preview = ""
)

Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'

$root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\assets\sprites"))
New-Item -ItemType Directory -Force -Path $root | Out-Null

$OUTLINE = [System.Drawing.Color]::FromArgb(255, 0x14, 0x16, 0x1f)

function C([string]$hex) {
  $r = [Convert]::ToInt32($hex.Substring(0,2),16)
  $g = [Convert]::ToInt32($hex.Substring(2,2),16)
  $b = [Convert]::ToInt32($hex.Substring(4,2),16)
  return [System.Drawing.Color]::FromArgb(255,$r,$g,$b)
}
function New-Canvas([int]$w,[int]$h) {
  $bmp = New-Object System.Drawing.Bitmap($w,$h,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
  $g.Clear([System.Drawing.Color]::Transparent)
  return [pscustomobject]@{ bmp = $bmp; g = $g }
}
function Ell($cv,[System.Drawing.Color]$col,$x,$y,$w,$h) {
  $br = New-Object System.Drawing.SolidBrush($col); $cv.g.FillEllipse($br,$x,$y,$w,$h); $br.Dispose()
}
function Rct($cv,[System.Drawing.Color]$col,$x,$y,$w,$h) {
  $br = New-Object System.Drawing.SolidBrush($col); $cv.g.FillRectangle($br,$x,$y,$w,$h); $br.Dispose()
}
function Px($cv,[System.Drawing.Color]$col,$x,$y) {
  if ($x -ge 0 -and $y -ge 0 -and $x -lt $cv.bmp.Width -and $y -lt $cv.bmp.Height) { $cv.bmp.SetPixel([int]$x,[int]$y,$col) }
}
function Add-Outline($cv,[System.Drawing.Color]$col) {
  $w = $cv.bmp.Width; $h = $cv.bmp.Height
  $src = New-Object System.Drawing.Bitmap($cv.bmp)
  for ($y=0; $y -lt $h; $y++) {
    for ($x=0; $x -lt $w; $x++) {
      if ($src.GetPixel($x,$y).A -ne 0) { continue }
      $near = $false
      for ($dy=-1; $dy -le 1 -and -not $near; $dy++) {
        for ($dx=-1; $dx -le 1; $dx++) {
          $nx=$x+$dx; $ny=$y+$dy
          if ($nx -lt 0 -or $ny -lt 0 -or $nx -ge $w -or $ny -ge $h) { continue }
          if ($src.GetPixel($nx,$ny).A -ne 0) { $near=$true; break }
        }
      }
      if ($near) { $cv.bmp.SetPixel($x,$y,$col) }
    }
  }
  $src.Dispose()
}

# ---------------- Palette esploratore ----------------
$SKIN    = C "f2c9a0";  $SKIN_D = C "d69f78"
$SUIT    = C "3f7fd6";  $SUIT_D = C "2c5ea8";  $SUIT_L = C "5f9ae8"
$HELM    = C "e08a2a";  $HELM_D = C "a85f12";  $HELM_L = C "ffb84d"
$LAMP    = C "fff6c0";  $LAMP_C = C "ffffff"
$GOG     = C "9fd8e6";  $GOG_D  = C "2a2f3d";  $GOG_L = C "e8fbff"
$TANK    = C "dfe9ef";  $TANK_D = C "9fb3c2";  $TANK_B = C "6fc3d6"
$METAL   = C "c0c6d0";  $METAL_D = C "8a909c"
$BOOT    = C "222a3a"
$GLOVE   = C "e6ebf2"
$BELT    = C "6a4a2a"

# ---------------- HERO IDLE (20x30, rivolto a DESTRA) ----------------
$cv = New-Canvas 20 30

# --- ZAINETTO-SERBATOIO (bombola dietro la spalla, sporge a sinistra) ---
Ell $cv $TANK   0 12 6 4            # cima arrotondata
Rct $cv $TANK   1 14 5 7            # corpo cilindro
Ell $cv $TANK   0 19 6 4            # fondo arrotondato
Rct $cv $TANK_D 4 14 2 7            # ombra lato interno
Rct $cv $TANK_B 1 16 5 1            # fascia
Rct $cv $TANK_B 1 19 5 1            # fascia
Px  $cv $LAMP_C 2 13               # riflesso
Rct $cv $METAL  2 11 2 2            # valvola in cima
Px  $cv $METAL_D 5 13; Px $cv $METAL_D 6 14; Px $cv $METAL_D 6 15   # tubo verso il corpo

# --- GAMBE / STIVALI ---
Rct $cv $SUIT_D 7 23 3 5
Rct $cv $SUIT_D 11 23 3 5
Rct $cv $SUIT   7 23 2 5            # fronte gamba piu' chiaro
Rct $cv $SUIT   11 23 2 5
Rct $cv $BOOT   6 27 4 2
Rct $cv $BOOT   11 27 4 2

# --- BRACCIO DIETRO (sinistra) ---
Rct $cv $SUIT_D 5 16 2 5
Ell $cv $SKIN_D 4 20 3 3            # mano

# --- CORPO (tuta blu) ---
Ell $cv $SUIT   5 14 11 5           # spalle arrotondate
Rct $cv $SUIT   6 15 9 8            # busto
Rct $cv $SUIT_L 6 15 2 7            # bordo luce a sinistra
Rct $cv $SUIT_D 13 16 2 6           # ombra morbida a destra (piu' stretta)
# tracolla dell'attrezzatura (diagonale spalla->fianco)
Px $cv $HELM_D 7 16; Px $cv $HELM_D 8 17; Px $cv $HELM_D 9 18; Px $cv $HELM_D 10 19; Px $cv $HELM_D 11 20
Px $cv $HELM   7 17; Px $cv $HELM   8 18; Px $cv $HELM   9 19; Px $cv $HELM   10 20
Rct $cv $BELT   6 22 9 2            # cintura
Rct $cv $HELM_L 9 22 2 2            # fibbia

# --- BRACCIO DAVANTI (destra) teso in avanti con SPRUZZATORE ---
Rct $cv $SUIT  14 15 3 3            # braccio
Rct $cv $SUIT_L 14 15 3 1
Ell $cv $GLOVE 15 17 3 3            # guanto
Rct $cv $METAL   16 17 3 2          # corpo spruzzatore
Rct $cv $METAL_D 16 19 2 1          # sotto (grilletto)
Rct $cv $METAL   18 17 2 1          # canna
Px  $cv $GOG_L 18 17               # riflesso canna
Px  $cv $GOG   19 17               # ugello azzurro

# --- TESTA / FACCIA ---
Ell $cv $SKIN  5 6 10 8             # faccia (x5-15, y6-14)
Rct $cv $SKIN_D 12 8 3 5            # guancia in ombra
# occhi (dot con brillìo = vivo e simpatico)
Ell $cv $OUTLINE 7 9 2 3            # occhio sx
Ell $cv $OUTLINE 11 9 2 3           # occhio dx
Px  $cv $GOG_L 7 9; Px $cv $GOG_L 11 9     # brillìo
# naso + sorrisetto
Px  $cv $SKIN_D 10 11              # naso
Px $cv $OUTLINE 9 13; Px $cv $OUTLINE 10 13; Px $cv $OUTLINE 11 13   # bocca
Px $cv $OUTLINE 8 12; Px $cv $OUTLINE 12 12                          # angoli all'insu' (sorriso)

# --- CASCO (cupola + brim) ---
Ell $cv $HELM   4 0 12 7            # cupola
Ell $cv $HELM_L 6 1 6 3            # luce in alto
Rct $cv $HELM   3 5 14 2            # brim largo
Rct $cv $HELM_D 3 7 14 1            # ombra sotto il brim
# occhialoni spinti IN ALTO sul casco (due lenti azzurre)
Ell $cv $GOG_D  5 3 4 2; Ell $cv $GOG 5 3 3 2; Px $cv $GOG_L 6 3
Ell $cv $GOG_D  12 3 4 2; Ell $cv $GOG 12 3 3 2; Px $cv $GOG_L 13 3

# --- LAMPADA FRONTALE (faretto netto al centro del brim) ---
Ell $cv $OUTLINE 8 4 5 4            # ghiera scura
Ell $cv $METAL   8 4 5 2            # corpo metallico
Ell $cv $LAMP    9 5 3 2            # vetro acceso
Px  $cv $LAMP_C 10 5               # nucleo bianco

Add-Outline $cv $OUTLINE
$cv.g.Dispose()
$cv.bmp.Save((Join-Path $root "hero_idle.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$hero = $cv.bmp

# ---------------- ANTEPRIMA per ispezione ----------------
if ($Preview -eq "") { $Preview = Join-Path $root "..\preview_hero.png" }
$Preview = [System.IO.Path]::GetFullPath($Preview)
[int]$big = 16; [int]$small = 3
[int]$pad = 24
[int]$sheetW = $pad*3 + $hero.Width*$big + $hero.Width*$small
[int]$sheetH = $pad*2 + $hero.Height*$big
$sheet = New-Object System.Drawing.Bitmap($sheetW,$sheetH,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$sg = [System.Drawing.Graphics]::FromImage($sheet)
$sg.Clear((C "6a2733"))             # sfondo rosso-carne come nel gioco
$sg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
$sg.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
$sg.DrawImage($hero, $pad, $pad, $hero.Width*$big, $hero.Height*$big)
$sg.DrawImage($hero, $pad*2 + $hero.Width*$big, $pad + ($hero.Height*$big - $hero.Height*$small), $hero.Width*$small, $hero.Height*$small)
$sheet.Save($Preview, [System.Drawing.Imaging.ImageFormat]::Png)
$sg.Dispose(); $sheet.Dispose()

Write-Output ("HERO -> " + (Join-Path $root "hero_idle.png") + "  (" + $hero.Width + "x" + $hero.Height + ")")
Write-Output ("PREVIEW -> " + $Preview)
$hero.Dispose()
