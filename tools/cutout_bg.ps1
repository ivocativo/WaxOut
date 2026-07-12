# cutout_bg.ps1 — rende trasparente lo sfondo (quasi uniforme) di un'immagine, tenendo i
# colori INTERNI simili allo sfondo. Metodo: riempimento (flood-fill) dai BORDI verso l'interno,
# rimuovendo solo i pixel di sfondo CONNESSI al bordo (l'interno del personaggio non viene toccato).
# Auto-ritaglio al contenuto. Usa LockBits per velocita'.
#
# Uso: powershell -NoProfile -File tools\cutout_bg.ps1 -In <img> -Out <png> [-Tol 72] [-Pad 2]
param(
  [Parameter(Mandatory=$true)][string]$In,
  [Parameter(Mandatory=$true)][string]$Out,
  [int]$Tol = 72,
  [int]$Pad = 2
)
Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'

$src = [System.Drawing.Image]::FromFile((Resolve-Path $In).Path)
$w = $src.Width; $h = $src.Height
$bmp = New-Object System.Drawing.Bitmap($w,$h,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($bmp); $g.DrawImage($src,0,0,$w,$h); $g.Dispose(); $src.Dispose()

$rect = New-Object System.Drawing.Rectangle(0,0,$w,$h)
$data = $bmp.LockBits($rect,[System.Drawing.Imaging.ImageLockMode]::ReadWrite,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$stride = $data.Stride
$bytes = New-Object byte[] ($stride*$h)
[System.Runtime.InteropServices.Marshal]::Copy($data.Scan0,$bytes,0,$bytes.Length)

# colore di sfondo = media dei 4 angoli
function PxAt($x,$y){ $i=$y*$stride+$x*4; return @($bytes[$i+2],$bytes[$i+1],$bytes[$i]) } # R,G,B
$cs = @((PxAt 0 0),(PxAt ($w-1) 0),(PxAt 0 ($h-1)),(PxAt ($w-1) ($h-1)))
$bR=0;$bG=0;$bB=0; foreach($c in $cs){ $bR+=$c[0];$bG+=$c[1];$bB+=$c[2] }
$bR=[int]($bR/4);$bG=[int]($bG/4);$bB=[int]($bB/4)
$tol2 = $Tol*$Tol

$visited = New-Object bool[] ($w*$h)
$q = New-Object System.Collections.Generic.Queue[int]
function IsBg($idx){
  $i=$idx*4
  $dr=$bytes[$i+2]-$bR; $dg=$bytes[$i+1]-$bG; $db=$bytes[$i]-$bB
  return (($dr*$dr+$dg*$dg+$db*$db) -lt $tol2)
}
# semina dai bordi
for($x=0;$x -lt $w;$x++){
  foreach($y in @(0,($h-1))){ $idx=$y*$w+$x; if(-not $visited[$idx] -and (IsBg $idx)){ $visited[$idx]=$true; $q.Enqueue($idx) } }
}
for($y=0;$y -lt $h;$y++){
  foreach($x in @(0,($w-1))){ $idx=$y*$w+$x; if(-not $visited[$idx] -and (IsBg $idx)){ $visited[$idx]=$true; $q.Enqueue($idx) } }
}
# flood-fill 4-vicini
while($q.Count -gt 0){
  $idx=$q.Dequeue()
  $x=$idx % $w; $y=[int]($idx/$w)
  $bytes[$idx*4+3]=0    # alpha 0
  if($x -gt 0){ $n=$idx-1; if(-not $visited[$n] -and (IsBg $n)){ $visited[$n]=$true; $q.Enqueue($n) } }
  if($x -lt $w-1){ $n=$idx+1; if(-not $visited[$n] -and (IsBg $n)){ $visited[$n]=$true; $q.Enqueue($n) } }
  if($y -gt 0){ $n=$idx-$w; if(-not $visited[$n] -and (IsBg $n)){ $visited[$n]=$true; $q.Enqueue($n) } }
  if($y -lt $h-1){ $n=$idx+$w; if(-not $visited[$n] -and (IsBg $n)){ $visited[$n]=$true; $q.Enqueue($n) } }
}
[System.Runtime.InteropServices.Marshal]::Copy($bytes,0,$data.Scan0,$bytes.Length)
$bmp.UnlockBits($data)

# auto-ritaglio al contenuto (alpha>0)
$minx=$w;$miny=$h;$maxx=-1;$maxy=-1
for($y=0;$y -lt $h;$y++){ $row=$y*$stride; for($x=0;$x -lt $w;$x++){ if($bytes[$row+$x*4+3] -ne 0){ if($x -lt $minx){$minx=$x}; if($x -gt $maxx){$maxx=$x}; if($y -lt $miny){$miny=$y}; if($y -gt $maxy){$maxy=$y} } } }
$minx=[Math]::Max(0,$minx-$Pad); $miny=[Math]::Max(0,$miny-$Pad); $maxx=[Math]::Min($w-1,$maxx+$Pad); $maxy=[Math]::Min($h-1,$maxy+$Pad)
$cw=$maxx-$minx+1; $ch=$maxy-$miny+1
$crop=New-Object System.Drawing.Bitmap($cw,$ch,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$cg=[System.Drawing.Graphics]::FromImage($crop); $cg.DrawImage($bmp,(New-Object System.Drawing.Rectangle(0,0,$cw,$ch)),$minx,$miny,$cw,$ch,[System.Drawing.GraphicsUnit]::Pixel); $cg.Dispose()
$outDir=[System.IO.Path]::GetDirectoryName([System.IO.Path]::GetFullPath($Out)); New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$crop.Save([System.IO.Path]::GetFullPath($Out),[System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose(); $crop.Dispose()
Write-Output ("OK -> " + [System.IO.Path]::GetFullPath($Out) + "  (" + $cw + "x" + $ch + ")  bg=(" + $bR + "," + $bG + "," + $bB + ")")
