# "Cuoce" il fondale nella sua versione PIXEL-ART: rimpicciolisce l'immagine di PX
# volte e riduce i colori (posterizza) a LEVELS per canale, salvando un PNG piccolo.
# Cosi' il gioco lo carica gia' pronto (niente elaborazione canvas a runtime, che si
# rompe da file://). Rilancia questo script se cambi la grana e ricorda di ri-incorporare.
# Uso: powershell -File tools/bake_bg_pixel.ps1
param(
  [string]$In  = "assets/backgrounds/bg_flesh_01.jpg",
  [string]$Out = "assets/backgrounds/bg_flesh_01_px.png",
  [int]$PX = 6,       # quanto rimpicciolire (grana)
  [int]$Levels = 6    # colori per canale (posterizzazione)
)
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $PSScriptRoot
$inP = Join-Path $root $In; $outP = Join-Path $root $Out
$src = New-Object System.Drawing.Bitmap($inP)
$lowW = [Math]::Max(2, [int]($src.Width / $PX)); $lowH = [Math]::Max(2, [int]($src.Height / $PX))

# Rimpicciolimento morbido (media dei pixel).
$low = New-Object System.Drawing.Bitmap($lowW, $lowH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($low)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.DrawImage($src, 0, 0, $lowW, $lowH); $g.Dispose(); $src.Dispose()

# Posterizzazione (snappa ogni canale a pochi livelli = colori piatti pixel-art).
$rect = New-Object System.Drawing.Rectangle(0, 0, $lowW, $lowH)
$data = $low.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadWrite, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$n = $data.Stride * $lowH; $buf = New-Object byte[] $n
[System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $buf, 0, $n)
$step = 255.0 / ($Levels - 1)
for ($i = 0; $i -lt $n; $i += 4) {
  for ($c = 0; $c -lt 3; $c++) {
    $v = $buf[$i + $c]
    $buf[$i + $c] = [byte][Math]::Round([Math]::Round($v / $step) * $step)
  }
  $buf[$i + 3] = 255
}
[System.Runtime.InteropServices.Marshal]::Copy($buf, 0, $data.Scan0, $n)
$low.UnlockBits($data)
$low.Save($outP, [System.Drawing.Imaging.ImageFormat]::Png); $low.Dispose()
"OK -> $Out  (${lowW}x${lowH}, PX=$PX Levels=$Levels)"
