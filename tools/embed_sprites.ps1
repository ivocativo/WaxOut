# embed_sprites.ps1 — incorpora gli sprite PNG (assets/sprites/) dentro
# src/sprites_data.js come data URI base64, cosi' il gioco si carica anche
# aprendo index.html da file:// (i browser bloccano i PNG esterni in locale).
#
# Uso:  powershell -ExecutionPolicy Bypass -File tools/embed_sprites.ps1
# Rilanciare ogni volta che si modificano/aggiungono gli sprite incorporati.

$root = Split-Path -Parent $PSScriptRoot
$spritesDir = Join-Path $root 'assets/sprites'
$outFile = Join-Path $root 'src/sprites_data.js'

# Nomi (senza estensione) degli sprite da incorporare.
$names = @('hero_idle', 'cerumino', 'crosta', 'wax_glob', 'wax_drip')

$lines = @()
$lines += '// sprites_data.js — sprite PNG incorporati come data URI (base64), cosi'' il gioco'
$lines += '// funziona anche aprendo index.html da file:// (i browser bloccano il caricamento'
$lines += '// di file PNG esterni in locale). Rigenerare con: tools/embed_sprites.ps1.'
$lines += '// Generato automaticamente: NON modificare a mano.'
$lines += 'window.SPRITE_DATA = {'
foreach ($n in $names) {
  $png = Join-Path $spritesDir "$n.png"
  if (-not (Test-Path $png -PathType Leaf)) { Write-Warning "Manca $png, salto"; continue }
  $b64 = [System.Convert]::ToBase64String([System.IO.File]::ReadAllBytes($png))
  $lines += "  ${n}: 'data:image/png;base64,$b64',"
}
$lines += '};'

[System.IO.File]::WriteAllLines($outFile, $lines)
Write-Host "Scritto $outFile ($($names.Count) sprite)."
