# scale_sprite.ps1 — rimpicciolisce un PNG a un'altezza target con interpolazione di qualita'
# (bicubica) e salva. Opzionale: anteprima ingrandita (nearest) su sfondo rosso per ispezione.
#
# Uso: powershell -NoProfile -File tools\scale_sprite.ps1 -In <png> -Out <png> -Height 72 [-Preview <png>] [-Zoom 5]
param(
  [Parameter(Mandatory=$true)][string]$In,
  [Parameter(Mandatory=$true)][string]$Out,
  [Parameter(Mandatory=$true)][int]$Height,
  [string]$Preview = "",
  [int]$Zoom = 5
)
Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'

$inPath = (Resolve-Path $In).Path
$src = [System.Drawing.Image]::FromFile($inPath)
[int]$sw = $src.Width; [int]$sh = $src.Height
[int]$H = $Height
[int]$W = [int][Math]::Round(($sw * $H) / $sh)
$dst = New-Object System.Drawing.Bitmap($W, $H, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($dst)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.PixelOffsetMode   = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.Clear([System.Drawing.Color]::Transparent)
$g.DrawImage($src, 0, 0, $W, $H)
$g.Dispose(); $src.Dispose()

$outPath = [System.IO.Path]::GetFullPath($Out)
New-Item -ItemType Directory -Force -Path ([System.IO.Path]::GetDirectoryName($outPath)) | Out-Null
$dst.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)

if ($Preview -ne "") {
  [int]$z = $Zoom
  [int]$pw = $W * $z; [int]$ph = $H * $z
  $bg = New-Object System.Drawing.Bitmap($pw, $ph, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g2 = [System.Drawing.Graphics]::FromImage($bg)
  $g2.Clear([System.Drawing.Color]::FromArgb(255,106,39,51))
  $g2.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
  $g2.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
  $g2.DrawImage($dst, 0, 0, $pw, $ph)
  $g2.Dispose()
  $bg.Save([System.IO.Path]::GetFullPath($Preview), [System.Drawing.Imaging.ImageFormat]::Png)
  $bg.Dispose()
}
$dst.Dispose()
Write-Output ("OK -> " + $outPath + "  (" + $W + "x" + $H + ")")
