# bake_background_set.ps1 — prepara un SET di sfondo per il gioco.
#
# Prende assets/backgrounds/<N>/ con le 3 immagini generate (fondale / mid / primo piano) e
# produce le versioni pronte per il gioco. NON posterizza e NON pixela: lo sfondo resta
# PITTORICO di proposito (contrasto voluto con i personaggi pixel-art).
#
#   fondale.png      -> bg<N>_far.jpg    (fondo pieno, niente trasparenza -> JPG, pesa poco)
#   mid.png          -> bg<N>_mid.png    (magenta scontornato -> PNG con alpha)
#   primo piano.png  -> bg<N>_near.png   (magenta scontornato -> PNG con alpha)
#
# Il magenta (#FF00FF) e' il colore-chiave: le immagini vengono prima RIDIMENSIONATE (bicubica
# pulita sull'immagine ancora opaca) e SOLO DOPO scontornate. Facendolo in quest'ordine i bordi
# si ammorbidiscono senza che GDI+ sbavi il nero dei pixel trasparenti dentro l'arte.
# Lo scontorno ha tre fasce: magenta pieno -> trasparente; magenta parziale -> semitrasparente
# con "despill" (si toglie la dominante magenta dal bordo, se no resta un alone rosa).
#
# Uso: powershell -NoProfile -File tools\bake_background_set.ps1 -Set 2 [-Width 1200]
param(
  [Parameter(Mandatory=$true)][int]$Set,
  [int]$Width = 1200,
  [int]$JpgQuality = 88
)
Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$dir  = Join-Path $root ("assets\backgrounds\" + $Set)
if (-not (Test-Path $dir)) { throw "Cartella set non trovata: $dir" }

function Resize-Image($path, $w) {
  $src = [System.Drawing.Image]::FromFile($path)
  $h = [int][Math]::Round($src.Height * ($w / $src.Width))
  $dst = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($dst)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode   = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.DrawImage($src, 0, 0, $w, $h)
  $g.Dispose(); $src.Dispose()
  return $dst
}

# Toglie il colore-chiave magenta e restituisce quanti pixel sono diventati trasparenti.
#
# ATTENZIONE (errore gia' commesso una volta, non ripeterlo): l'arte di questo gioco e' ROSA
# ACCESO, che a una regola generica tipo "min(rosso,blu) - verde" assomiglia moltissimo al
# magenta. Con quella regola larga il 30% dell'arte vera veniva bucata e scolorita.
# Il magenta puro si distingue da ogni rosa della tavolozza per UNA cosa: rosso e blu sono
# quasi UGUALI (e' (255,0,255)), mentre nell'arte il rosso e' sempre nettamente sopra il blu.
# Quindi la chiave e' stretta e richiede TUTTE le condizioni insieme.
function Remove-MagentaKey($bmp) {
  $w = $bmp.Width; $h = $bmp.Height
  $rect = New-Object System.Drawing.Rectangle(0, 0, $w, $h)
  $data = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadWrite, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $stride = $data.Stride
  $bytes = New-Object byte[] ($stride * $h)
  [System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $bytes, 0, $bytes.Length)

  # --- passo 1: taglio netto del solo magenta vero ---
  $cut = 0
  for ($y = 0; $y -lt $h; $y++) {
    $row = $y * $stride
    for ($x = 0; $x -lt $w; $x++) {
      $i = $row + $x * 4
      [int]$b = $bytes[$i]; [int]$g = $bytes[$i+1]; [int]$r = $bytes[$i+2]
      if ($g -lt 70 -and $r -gt 200 -and $b -gt 200 -and [Math]::Abs($r - $b) -lt 45) {
        $bytes[$i]=0; $bytes[$i+1]=0; $bytes[$i+2]=0; $bytes[$i+3]=0
        $cut++
      }
    }
  }

  # --- passo 2: despill SOLO sul contorno ---
  # Un pixel opaco che tocca un pixel tagliato ha preso un po' di magenta dal ridimensionamento:
  # gli si abbassano rosso e blu verso il verde. Toccando solo il bordo (1px) l'arte interna
  # resta assolutamente intatta.
  $orig = $bytes.Clone()
  for ($y = 0; $y -lt $h; $y++) {
    $row = $y * $stride
    for ($x = 0; $x -lt $w; $x++) {
      $i = $row + $x * 4
      if ($orig[$i+3] -eq 0) { continue }
      $vicino = $false
      if ($x -gt 0 -and $orig[$i-1] -eq 0) { $vicino = $true }        # alpha del pixel a sinistra
      if (-not $vicino -and $x -lt ($w-1) -and $orig[$i+7] -eq 0) { $vicino = $true }
      if (-not $vicino -and $y -gt 0     -and $orig[$i-$stride+3] -eq 0) { $vicino = $true }
      if (-not $vicino -and $y -lt ($h-1) -and $orig[$i+$stride+3] -eq 0) { $vicino = $true }
      if (-not $vicino) { continue }
      [int]$b = $bytes[$i]; [int]$g = $bytes[$i+1]; [int]$r = $bytes[$i+2]
      $lim = $g + 60
      if ($r -gt $lim) { $bytes[$i+2] = [byte][Math]::Min(255, $lim) }
      if ($b -gt $lim) { $bytes[$i]   = [byte][Math]::Min(255, $lim) }
    }
  }

  [System.Runtime.InteropServices.Marshal]::Copy($bytes, 0, $data.Scan0, $bytes.Length)
  $bmp.UnlockBits($data)
  return $cut
}

# Raddoppia l'immagine affiancandole la propria copia SPECCHIATA: [originale | riflesso].
# Serve a rendere invisibile la giuntura quando lo strato si ripete scorrendo. Funziona per
# costruzione: il bordo destro del riflesso e' identico al bordo sinistro dell'originale, quindi
# al punto di ricongiungimento non c'e' nessun salto. (Prima si vedeva una riga verticale netta
# a fondo livello, dove lo strato ricominciava.)
function Add-Mirror($bmp) {
  $w = $bmp.Width; $h = $bmp.Height
  $out = New-Object System.Drawing.Bitmap(($w * 2), $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($out)
  $g.Clear([System.Drawing.Color]::Transparent)
  $g.DrawImage($bmp, 0, 0, $w, $h)
  $flip = $bmp.Clone()
  $flip.RotateFlip([System.Drawing.RotateFlipType]::RotateNoneFlipX)
  $g.DrawImage($flip, $w, 0, $w, $h)
  $g.Dispose(); $flip.Dispose()
  return $out
}

function Save-Jpg($bmp, $path, $q) {
  $enc = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
  $ps = New-Object System.Drawing.Imaging.EncoderParameters(1)
  $ps.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]$q)
  # il JPG non ha alpha: appiattisco su nero per sicurezza
  $flat = New-Object System.Drawing.Bitmap($bmp.Width, $bmp.Height, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
  $g = [System.Drawing.Graphics]::FromImage($flat)
  $g.DrawImage($bmp, 0, 0, $bmp.Width, $bmp.Height)
  $g.Dispose()
  $flat.Save($path, $enc, $ps)
  $flat.Dispose()
}

$jobs = @(
  @{ src = 'fondale.png';     out = 'far';  key = $false },
  @{ src = 'mid.png';         out = 'mid';  key = $true  },
  @{ src = 'primo piano.png'; out = 'near'; key = $true  }
)

foreach ($j in $jobs) {
  $inPath = Join-Path $dir $j.src
  if (-not (Test-Path $inPath)) { Write-Output ("SALTATO (manca): " + $j.src); continue }
  $bmp = Resize-Image $inPath $Width
  if ($j.key) {
    $cut = Remove-MagentaKey $bmp
    $pct = 100.0 * $cut / ($bmp.Width * $bmp.Height)
    $mir = Add-Mirror $bmp
    $outPath = Join-Path $dir ("bg" + $Set + "_" + $j.out + ".png")
    $mir.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $kb = [int]((Get-Item $outPath).Length / 1KB)
    Write-Output ("OK  {0,-14} -> {1,4}x{2,-4} trasparente {3,5:N1}%  {4} KB" -f (Split-Path $outPath -Leaf), $mir.Width, $mir.Height, $pct, $kb)
    $mir.Dispose()
  } else {
    $mir = Add-Mirror $bmp
    $outPath = Join-Path $dir ("bg" + $Set + "_" + $j.out + ".jpg")
    Save-Jpg $mir $outPath $JpgQuality
    $kb = [int]((Get-Item $outPath).Length / 1KB)
    Write-Output ("OK  {0,-14} -> {1,4}x{2,-4} (fondo pieno)      {3} KB" -f (Split-Path $outPath -Leaf), $mir.Width, $mir.Height, $kb)
    $mir.Dispose()
  }
  $bmp.Dispose()
}
Write-Output ("Set " + $Set + " pronto in " + $dir)
