# bake_sheet_pixel.ps1 — rende uno sprite sheet piu' "pixel-art": riduce la risoluzione
# (cosi' i pixel diventano piu' grossi/netti quando il gioco lo reingrandisce con NEAREST),
# riduce i colori (posterizzazione) e IRRIGIDISCE i bordi (soglia alpha, niente aloni morbidi).
# La griglia dei frame resta la stessa (es. 5x5). Usa LockBits.
#
# Uso: powershell -NoProfile -File tools\bake_sheet_pixel.ps1 -In <png> -Out <png>
#        -Frames 5 -TargetFrame 84 [-Levels 6] [-AlphaThreshold 110]
param(
  [Parameter(Mandatory=$true)][string]$In,
  [Parameter(Mandatory=$true)][string]$Out,
  [int]$Frames = 5,
  [int]$TargetFrame = 84,
  [int]$Levels = 6,
  [int]$AlphaThreshold = 110
)
Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'

[int]$target = $TargetFrame * $Frames
$src = [System.Drawing.Image]::FromFile((Resolve-Path $In).Path)
$dst = New-Object System.Drawing.Bitmap($target, $target, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($dst)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.PixelOffsetMode   = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.Clear([System.Drawing.Color]::Transparent)
$g.DrawImage($src, 0, 0, $target, $target)
$g.Dispose(); $src.Dispose()

# posterizza RGB + soglia alpha, via LockBits
$rect = New-Object System.Drawing.Rectangle(0,0,$target,$target)
$data = $dst.LockBits($rect,[System.Drawing.Imaging.ImageLockMode]::ReadWrite,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$stride = $data.Stride
$bytes = New-Object byte[] ($stride*$target)
[System.Runtime.InteropServices.Marshal]::Copy($data.Scan0,$bytes,0,$bytes.Length)
[int]$L = [Math]::Max(2,$Levels)
$lut = New-Object int[] 256
for($v=0;$v -lt 256;$v++){ $lut[$v] = [int]([Math]::Round(($v/255.0)*($L-1))*(255.0/($L-1))) }
for($i=0;$i -lt $bytes.Length;$i+=4){
  $a = $bytes[$i+3]
  if($a -lt $AlphaThreshold){ $bytes[$i]=0;$bytes[$i+1]=0;$bytes[$i+2]=0;$bytes[$i+3]=0; continue }
  $bytes[$i+3]=255
  $bytes[$i]  =[byte]$lut[$bytes[$i]]     # B
  $bytes[$i+1]=[byte]$lut[$bytes[$i+1]]   # G
  $bytes[$i+2]=[byte]$lut[$bytes[$i+2]]   # R
}
[System.Runtime.InteropServices.Marshal]::Copy($bytes,0,$data.Scan0,$bytes.Length)
$dst.UnlockBits($data)

$outPath=[System.IO.Path]::GetFullPath($Out)
New-Item -ItemType Directory -Force -Path ([System.IO.Path]::GetDirectoryName($outPath)) | Out-Null
$dst.Save($outPath,[System.Drawing.Imaging.ImageFormat]::Png)
$dst.Dispose()
Write-Output ("OK -> " + $outPath + "  sheet " + $target + "x" + $target + "  frame " + $TargetFrame + "  (L=" + $L + ", aThr=" + $AlphaThreshold + ")")
