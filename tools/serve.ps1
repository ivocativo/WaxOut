param([int]$Port = 8123)

# Server statico minimale per il preview (niente Node necessario).
$root = Split-Path -Parent $PSScriptRoot
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Serving $root on http://localhost:$Port/"

$mime = @{
  '.html' = 'text/html'; '.js' = 'application/javascript'; '.css' = 'text/css';
  '.png' = 'image/png'; '.jpg' = 'image/jpeg'; '.gif' = 'image/gif';
  '.svg' = 'image/svg+xml'; '.json' = 'application/json'; '.ico' = 'image/x-icon';
  '.wav' = 'audio/wav'; '.mp3' = 'audio/mpeg'; '.ogg' = 'audio/ogg';
}

while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
    $rel = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
    if ([string]::IsNullOrEmpty($rel)) { $rel = 'index.html' }
    $path = Join-Path $root $rel
    if (Test-Path $path -PathType Container) { $path = Join-Path $path 'index.html' }
    if (Test-Path $path -PathType Leaf) {
      $ext = [System.IO.Path]::GetExtension($path).ToLower()
      $ct = $mime[$ext]; if (-not $ct) { $ct = 'application/octet-stream' }
      $bytes = [System.IO.File]::ReadAllBytes($path)
      $ctx.Response.ContentType = $ct
      # ATTENZIONE: AddHeader, NON Headers.Add. Con Headers.Add l'intestazione veniva accettata
      # senza errori ma NON arrivava al browser (verificato leggendo la risposta: cache-control
      # nullo). Il risultato era che dopo ogni modifica il browser continuava a far girare il
      # JavaScript vecchio: le prove fatte in anteprima misuravano una versione diversa da
      # quella sul disco, e ci si accorge solo quando i numeri non tornano.
      $ctx.Response.AddHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
      $ctx.Response.AddHeader('Pragma', 'no-cache')
      $ctx.Response.ContentLength64 = $bytes.Length
      $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $ctx.Response.StatusCode = 404
      $msg = [System.Text.Encoding]::UTF8.GetBytes('404 Not Found')
      $ctx.Response.OutputStream.Write($msg, 0, $msg.Length)
    }
    $ctx.Response.OutputStream.Close()
  } catch { }
}
