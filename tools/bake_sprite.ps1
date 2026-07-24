# bake_sprite.ps1 — prepara UN singolo sprite AI (timpano, nemici, ...) per il gioco.
#
# Prende un PNG generato su fondo MAGENTA puro (#FF00FF) e produce lo sprite pronto: ridimensionato,
# scontornato dal magenta, opzionalmente "pixellizzato" (posterizzazione + la grana che nasce dal
# ridimensionare piccolo, poi il gioco reingrandisce con NEAREST) e ritagliato al contenuto.
#
# Stessa CHIAVE STRETTA degli sfondi (vedi bake_background_set.ps1): il magenta puro si distingue
# da ogni rosa/rosso dell'arte perche' rosso e blu sono quasi UGUALI e altissimi mentre il verde e'
# bassissimo. Regola larga -> bucherebbe l'arte. Ordine: ridimensiona (sull'immagine ancora opaca,
# bicubica pulita) POI scontorna, cosi' GDI+ non sbava il nero dei pixel trasparenti dentro l'arte.
#
# Uso: powershell -NoProfile -File tools\bake_sprite.ps1 -In <png> -Out <png> [-Width 300] [-Levels 20]
#   -Width  : larghezza finale in px (altezza in proporzione). Piu' PICCOLA = piu' "pixel" dopo
#             il reingrandimento del gioco. "Un filo" = vicino alla dimensione a schermo.
#   -Levels : posterizzazione dei colori (0 = nessuna). Piu' basso = piu' pixel-art/piatto.
param(
  [Parameter(Mandatory=$true)][string]$In,
  [Parameter(Mandatory=$true)][string]$Out,
  [int]$Width = 300,
  [int]$Levels = 0
)
Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'

$src = [System.Drawing.Image]::FromFile((Resolve-Path $In).Path)
$w = $Width
$h = [int][Math]::Round($src.Height * ($Width / $src.Width))
$bmp = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.PixelOffsetMode   = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.DrawImage($src, 0, 0, $w, $h)
$g.Dispose(); $src.Dispose()

# posterizzazione opzionale (LUT)
$lut = $null
if ($Levels -ge 2) {
  $lut = New-Object int[] 256
  for ($v = 0; $v -lt 256; $v++) { $lut[$v] = [int]([Math]::Round(($v / 255.0) * ($Levels - 1)) * (255.0 / ($Levels - 1))) }
}

$rect = New-Object System.Drawing.Rectangle(0, 0, $w, $h)
$data = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadWrite, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$stride = $data.Stride
$bytes = New-Object byte[] ($stride * $h)
[System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $bytes, 0, $bytes.Length)

# passo 1: scontorno del solo magenta VERO + despill/posterizzazione
[int]$minX = $w; [int]$minY = $h; [int]$maxX = -1; [int]$maxY = -1
for ($y = 0; $y -lt $h; $y++) {
  $row = $y * $stride
  for ($x = 0; $x -lt $w; $x++) {
    $i = $row + $x * 4
    [int]$b = $bytes[$i]; [int]$gr = $bytes[$i+1]; [int]$r = $bytes[$i+2]
    # Chiave FONDO MAGENTA/ROSA: rosso alto, verde basso, blu alto e ben sopra il verde. Prende il
    # magenta puro (#FF00FF) E il rosa acceso (es. 255,51,170) che qualche generazione usa al posto
    # del magenta. Sicura sull'arte di QUESTO gioco: le creature sono ambra/marrone (blu basso ->
    # $b>130 salta), verde/turchese (verde alto -> $gr<90 salta), i riflessi bianchi (verde alto).
    if ($gr -lt 90 -and $r -gt 190 -and $b -gt 130 -and ($b - $gr) -gt 50) {
      $bytes[$i]=0; $bytes[$i+1]=0; $bytes[$i+2]=0; $bytes[$i+3]=0    # fondo -> trasparente
      continue
    }
    $m = [Math]::Min($r, $b) - $gr
    if ($m -gt 40) {                                                  # bordo con alone magenta
      $a = [int](255 * (1.0 - ($m - 40) / 80.0))
      $bytes[$i+3] = [byte][Math]::Max(0, [Math]::Min(255, $a))
      $lim = $gr + 45
      if ($r -gt $lim) { $bytes[$i+2] = [byte]$lim }                 # despill: togli il rosa dal bordo
      if ($b -gt $lim) { $bytes[$i]   = [byte]$lim }
    }
    if ($lut -and $bytes[$i+3] -gt 0) {
      $bytes[$i]   = [byte]$lut[$bytes[$i]]
      $bytes[$i+1] = [byte]$lut[$bytes[$i+1]]
      $bytes[$i+2] = [byte]$lut[$bytes[$i+2]]
    }
    if ($bytes[$i+3] -gt 8) {
      if ($x -lt $minX) { $minX = $x }; if ($x -gt $maxX) { $maxX = $x }
      if ($y -lt $minY) { $minY = $y }; if ($y -gt $maxY) { $maxY = $y }
    }
  }
}
[System.Runtime.InteropServices.Marshal]::Copy($bytes, 0, $data.Scan0, $bytes.Length)
$bmp.UnlockBits($data)

# passo 2: ritaglio al contenuto (niente bordo trasparente = scala prevedibile in gioco)
if ($maxX -lt 0) { throw "Immagine tutta trasparente: la chiave magenta ha tolto tutto?" }
$cw = $maxX - $minX + 1; $ch = $maxY - $minY + 1
$trim = New-Object System.Drawing.Bitmap($cw, $ch, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$gt = [System.Drawing.Graphics]::FromImage($trim)
$gt.DrawImage($bmp, (New-Object System.Drawing.Rectangle 0,0,$cw,$ch), $minX, $minY, $cw, $ch, [System.Drawing.GraphicsUnit]::Pixel)
$gt.Dispose(); $bmp.Dispose()

$outPath = [System.IO.Path]::GetFullPath($Out)
New-Item -ItemType Directory -Force -Path ([System.IO.Path]::GetDirectoryName($outPath)) | Out-Null
$trim.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
$trim.Dispose()
$kb = [int]((Get-Item $outPath).Length / 1KB)
Write-Output ("OK -> {0}   {1}x{2}   {3} KB   (Levels={4})" -f (Split-Path $outPath -Leaf), $cw, $ch, $kb, $Levels)
