# Toglie lo sfondo NERO da un'immagine AI (Leonardo) e la ritaglia al contenuto,
# salvandola come PNG con trasparenza. Usato per le PROTUBERANZE del gioco.
# Uso: powershell -File tools/cutout_protuberance.ps1 -In <jpg> -Out <png>
param(
  [Parameter(Mandatory=$true)][string]$In,
  [Parameter(Mandatory=$true)][string]$Out,
  [int]$Lo = 34,    # sotto questo "valore" (max canale) = sfondo -> trasparente
  [int]$Hi = 72,    # sopra questo = pieno; in mezzo = bordo morbido (anti-alias)
  [int]$Pad = 6     # pixel di margine attorno al ritaglio
)
Add-Type -AssemblyName System.Drawing
$src = New-Object System.Drawing.Bitmap($In)
$W = $src.Width; $H = $src.Height
# Copia in un bitmap 32bpp ARGB su cui lavorare.
$bmp = New-Object System.Drawing.Bitmap($W, $H, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($bmp); $g.DrawImage($src, 0, 0, $W, $H); $g.Dispose(); $src.Dispose()

$rect = New-Object System.Drawing.Rectangle(0, 0, $W, $H)
$data = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadWrite, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$n = $W * $H * 4
$buf = New-Object byte[] $n
[System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $buf, 0, $n)

$minX = $W; $minY = $H; $maxX = -1; $maxY = -1
for ($y = 0; $y -lt $H; $y++) {
  $row = $y * $data.Stride
  for ($x = 0; $x -lt $W; $x++) {
    $i = $row + $x * 4
    $b = $buf[$i]; $gr = $buf[$i+1]; $r = $buf[$i+2]
    $v = $r; if ($gr -gt $v) { $v = $gr }; if ($b -gt $v) { $v = $b }   # max canale
    if ($v -le $Lo) { $a = 0 }
    elseif ($v -ge $Hi) { $a = 255 }
    else { $a = [int](255 * ($v - $Lo) / ($Hi - $Lo)) }
    $buf[$i+3] = [byte]$a
    if ($a -gt 16) {
      if ($x -lt $minX) { $minX = $x }; if ($x -gt $maxX) { $maxX = $x }
      if ($y -lt $minY) { $minY = $y }; if ($y -gt $maxY) { $maxY = $y }
    }
  }
}
[System.Runtime.InteropServices.Marshal]::Copy($buf, 0, $data.Scan0, $n)
$bmp.UnlockBits($data)

# Ritaglio al contenuto + margine.
$minX = [Math]::Max(0, $minX - $Pad); $minY = [Math]::Max(0, $minY - $Pad)
$maxX = [Math]::Min($W-1, $maxX + $Pad); $maxY = [Math]::Min($H-1, $maxY + $Pad)
$cw = $maxX - $minX + 1; $ch = $maxY - $minY + 1
$crop = New-Object System.Drawing.Bitmap($cw, $ch, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g2 = [System.Drawing.Graphics]::FromImage($crop)
$cropRect = New-Object System.Drawing.Rectangle($minX, $minY, $cw, $ch)
$g2.DrawImage($bmp, (New-Object System.Drawing.Rectangle(0,0,$cw,$ch)), $cropRect, [System.Drawing.GraphicsUnit]::Pixel)
$g2.Dispose(); $bmp.Dispose()
$crop.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png); $crop.Dispose()
"OK -> $Out  (${cw}x${ch}, ritagliato da ${W}x${H})"
