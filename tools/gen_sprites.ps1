# gen_sprites.ps1 — genera sprite PNG di partenza (bozze) per Earwax War.
# Disegna a risoluzione nativa bassa (vera pixel-art) componendo ellissi/rettangoli
# senza antialias, poi aggiunge un contorno scuro 1px attorno alla silhouette.
# I PNG finiscono in assets/sprites/ ; crea anche un'anteprima ingrandita.
#
# Uso:  powershell -NoProfile -File tools\gen_sprites.ps1

Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = 'Stop'
$root = Join-Path $PSScriptRoot "..\assets\sprites"
$root = [System.IO.Path]::GetFullPath($root)
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
  $br = New-Object System.Drawing.SolidBrush($col)
  $cv.g.FillEllipse($br,$x,$y,$w,$h); $br.Dispose()
}
function Rct($cv,[System.Drawing.Color]$col,$x,$y,$w,$h) {
  $br = New-Object System.Drawing.SolidBrush($col)
  $cv.g.FillRectangle($br,$x,$y,$w,$h); $br.Dispose()
}
function Px($cv,[System.Drawing.Color]$col,$x,$y) { $cv.bmp.SetPixel($x,$y,$col) }

# Aggiunge contorno scuro 1px attorno alla silhouette (pixel trasparenti adiacenti a opachi).
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

function Save-Sprite($cv,[string]$name) {
  $cv.g.Dispose()
  $cv.bmp.Save((Join-Path $root "$name.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  return $cv.bmp
}

$store = @{}

# ---------------- CERUMINO (blob gommoso, occhioni buffi) ----------------
function Build-Blob([string]$name, [string]$base, [string]$light, [string]$dark, [bool]$grumpy) {
  $cv = New-Canvas 22 20
  Ell $cv (C $base)  2 3 18 14          # corpo
  Ell $cv (C $dark)  4 10 14 8          # ombra bassa
  Ell $cv (C $light) 5 4 11 6           # luce alta
  Ell $cv ([System.Drawing.Color]::FromArgb(180,255,247,232)) 7 5 4 3   # riflesso
  # occhi
  Ell $cv (C "fff7e8") 6 8 5 5
  Ell $cv (C "fff7e8") 12 8 5 5
  Ell $cv $OUTLINE 8 10 2 2
  Ell $cv $OUTLINE 14 10 2 2
  # bocca
  if ($grumpy) { Rct $cv $OUTLINE 9 16 5 1 } else { Ell $cv $OUTLINE 10 15 3 2 }
  # gocciolina che pende
  Ell $cv (C $base) 9 16 4 5
  Add-Outline $cv $OUTLINE
  $store[$name] = (Save-Sprite $cv $name)
}
Build-Blob "cerumino" "dca842" "f2c861" "a9781f" $false
Build-Blob "crosta"   "7a5a3a" "9a7650" "4f3a24" $true

# ---------------- WAX GLOB (proiettile) ----------------
$cv = New-Canvas 12 12
Ell $cv (C "b6e85a") 1 1 9 9
Ell $cv (C "7fae3a") 3 4 6 6
Ell $cv ([System.Drawing.Color]::FromArgb(210,255,247,232)) 3 2 3 3
Add-Outline $cv $OUTLINE
$store["wax_glob"] = (Save-Sprite $cv "wax_glob")

# ---------------- WAX DRIP (goccia che cola) ----------------
$cv = New-Canvas 10 18
Rct $cv (C "dca842") 3 1 3 9
Ell $cv (C "dca842") 1 8 7 8
Ell $cv (C "a9781f") 2 12 4 4
Rct $cv (C "f2c861") 4 2 1 7
Px  $cv (C "fff7e8") 4 3
Add-Outline $cv $OUTLINE
$store["wax_drip"] = (Save-Sprite $cv "wax_drip")

# ---------------- HERO IDLE (esploratore con lampada frontale) ----------------
$cv = New-Canvas 20 30
# gambe / stivali
Rct $cv (C "394a73") 6 23 3 4
Rct $cv (C "394a73") 11 23 3 4
Rct $cv (C "222a3a") 5 27 4 2
Rct $cv (C "222a3a") 11 27 4 2
# braccia (tuta) + mani
Rct $cv (C "2c5ea8") 3 15 2 5
Rct $cv (C "2c5ea8") 15 15 2 5
Ell $cv (C "f2c9a0") 2 19 3 3
Ell $cv (C "f2c9a0") 15 19 3 3
# corpo (tuta blu) con spalla arrotondata + lato in ombra
Rct $cv (C "3f7fd6") 5 14 10 9
Ell $cv (C "3f7fd6") 4 13 12 6
Rct $cv (C "2c5ea8") 10 14 5 9
Rct $cv (C "6a4a2a") 5 21 10 2          # cintura
# testa
Ell $cv (C "5a3825") 4 2 12 8           # capelli
Ell $cv (C "f2c9a0") 5 5 10 8           # faccia
Rct $cv (C "2a2f3d") 4 6 12 1           # cinturino lampada
Ell $cv (C "fff6c0") 8 4 4 4            # lampada frontale (accesa)
Px  $cv $OUTLINE 8 9                    # occhi
Px  $cv $OUTLINE 12 9
Rct $cv $OUTLINE 9 11 3 1               # bocca
Add-Outline $cv $OUTLINE
$store["hero_idle"] = (Save-Sprite $cv "hero_idle")

# ---------------- ANTEPRIMA ingrandita (contact sheet) ----------------
$names = @("hero_idle","cerumino","crosta","wax_glob","wax_drip")
[int]$scale = 8; [int]$cell = 120; [int]$top = 24; [int]$labelH = 18
[int]$maxH = 0
foreach ($n in $names) { if ([int]$store[$n].Height -gt $maxH) { $maxH = [int]$store[$n].Height } }
[int]$sheetW = $names.Count * $cell
[int]$sheetH = $top + $maxH * $scale + $labelH + 16
$sheet = New-Object System.Drawing.Bitmap($sheetW, $sheetH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$sg = [System.Drawing.Graphics]::FromImage($sheet)
$sg.Clear((C "3a3530"))
$sg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
$sg.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
$font = New-Object System.Drawing.Font("Consolas", 11)
$white = New-Object System.Drawing.SolidBrush((C "fff7e8"))
$fmt = New-Object System.Drawing.StringFormat
$fmt.Alignment = [System.Drawing.StringAlignment]::Center
for ($i=0; $i -lt $names.Count; $i++) {
  $n = $names[$i]; $b = $store[$n]
  [int]$dw = [int]$b.Width * $scale
  [int]$dh = [int]$b.Height * $scale
  [int]$cx = $i * $cell + [int](($cell - $dw) / 2)
  [int]$cy = $top + ($maxH * $scale - $dh)
  $sg.DrawImage($b, $cx, $cy, $dw, $dh)
  [single]$lx = $i * $cell + $cell / 2
  [single]$ly = $top + $maxH * $scale + 2
  $sg.DrawString($n, $font, $white, $lx, $ly, $fmt)
}
$preview = [System.IO.Path]::GetFullPath((Join-Path $root "..\preview_sprites.png"))
$sheet.Save($preview, [System.Drawing.Imaging.ImageFormat]::Png)
$sg.Dispose(); $sheet.Dispose()

Write-Output ("OK -> " + $root)
foreach ($n in $names) { Write-Output ("  " + $n + ".png  (" + $store[$n].Width + "x" + $store[$n].Height + ")") }
foreach ($n in $names) { $store[$n].Dispose() }
Write-Output ("PREVIEW -> " + $preview)
