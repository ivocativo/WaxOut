# Incorpora le immagini ESTERNE (fondale pixelato, protuberanze, timpano) come data URI
# base64 in src/assets_data.js -> window.ASSET_DATA. Serve perche' da file:// il browser
# blocca i PNG/JPG esterni in WebGL: incorporati funzionano (come gia' fanno gli sprite in
# sprites_data.js). Rilancia questo script quando aggiungi/sostituisci un'immagine.
# Uso: powershell -File tools/embed_assets.ps1
$root = Split-Path -Parent $PSScriptRoot

# chiave (usata nel gioco)  ->  file su disco (relativo alla radice del progetto)
$manifest = [ordered]@{
  'bg_flesh_px'     = 'assets/backgrounds/bg_flesh_01_px.png'
  'eardrum'         = 'assets/sprites/eardrum.png'
  'prot_coral_stalk'= 'assets/protuberances/prot_coral_stalk.png'
  'prot_coral_branch'= 'assets/protuberances/prot_coral_branch.png'
  'prot_drip'       = 'assets/protuberances/prot_drip.png'
  'prot_web'        = 'assets/protuberances/prot_web.png'
  'wax_a'           = 'assets/wax/wax_a.png'
  'wax_b'           = 'assets/wax/wax_b.png'
  'wax_c'           = 'assets/wax/wax_c.png'
  'wax_d'           = 'assets/wax/wax_d.png'
  'wax_drip_a'      = 'assets/wax/wax_drip_a.png'
  'wax_drip_b'      = 'assets/wax/wax_drip_b.png'
}

$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine('// GENERATO da tools/embed_assets.ps1 — NON modificare a mano.')
[void]$sb.AppendLine('// Immagini incorporate come data URI cosi'' il gioco gira da file:// (doppio-click).')
[void]$sb.AppendLine('window.ASSET_DATA = {')
foreach ($k in $manifest.Keys) {
  $p = Join-Path $root $manifest[$k]
  if (-not (Test-Path $p)) { Write-Warning "manca: $($manifest[$k])"; continue }
  $ext = ([System.IO.Path]::GetExtension($p)).TrimStart('.').ToLower()
  $mime = if ($ext -eq 'jpg' -or $ext -eq 'jpeg') { 'image/jpeg' } else { 'image/png' }
  $b64 = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($p))
  [void]$sb.AppendLine("  '$k': 'data:$mime;base64,$b64',")
  "  $k  ($([Math]::Round($b64.Length/1024)) KB)"
}
[void]$sb.AppendLine('};')
$outFile = Join-Path $root 'src/assets_data.js'
[System.IO.File]::WriteAllText($outFile, $sb.ToString())
"-> src/assets_data.js scritto ($([Math]::Round((Get-Item $outFile).Length/1024)) KB)"
