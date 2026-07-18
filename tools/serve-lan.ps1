param([int]$Port = 8123)

# Server statico per giocare da TELEFONO/TABLET sulla stessa rete Wi-Fi del PC.
#
# Perche' non usa serve.ps1: quello ascolta solo su "localhost", quindi lo vede solo
# il PC. Questo usa un TcpListener su TUTTE le interfacce di rete (0.0.0.0), cosi' il
# telefono puo' collegarsi. Usare TcpListener (e non HttpListener) evita di dover
# eseguire PowerShell come AMMINISTRATORE.
#
# USO:  powershell -ExecutionPolicy Bypass -File tools\serve-lan.ps1
# Poi apri sul telefono l'indirizzo stampato qui sotto. Ctrl+C per fermare.

$root = Split-Path -Parent $PSScriptRoot

$mime = @{
  '.html' = 'text/html; charset=utf-8'; '.js' = 'application/javascript; charset=utf-8';
  '.css' = 'text/css'; '.png' = 'image/png'; '.jpg' = 'image/jpeg'; '.jpeg' = 'image/jpeg';
  '.gif' = 'image/gif'; '.svg' = 'image/svg+xml'; '.json' = 'application/json';
  '.ico' = 'image/x-icon'; '.wav' = 'audio/wav'; '.mp3' = 'audio/mpeg'; '.ogg' = 'audio/ogg';
  '.apk' = 'application/vnd.android.package-archive';   # cosi' il telefono offre di INSTALLARE l'app
}

$listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Any, $Port)
$listener.Start()

# Mostra gli indirizzi da digitare sul telefono.
$ips = Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.IPAddress -ne '127.0.0.1' -and $_.PrefixOrigin -ne 'WellKnown' }
Write-Host ""
Write-Host "  Earwax War - server di rete avviato" -ForegroundColor Green
Write-Host "  Cartella: $root"
Write-Host ""
Write-Host "  Sul TELEFONO (stessa rete Wi-Fi) apri:" -ForegroundColor Yellow
foreach ($ip in $ips) { Write-Host ("    http://{0}:{1}/" -f $ip.IPAddress, $Port) -ForegroundColor Cyan }
Write-Host ""
Write-Host "  (Se Windows chiede il firewall: consenti sulle reti PRIVATE.)"
Write-Host "  Ctrl+C per fermare."
Write-Host ""

while ($true) {
  try {
    $client = $listener.AcceptTcpClient()
    $stream = $client.GetStream()

    # Legge la richiesta (una GET sta in un solo pacchetto).
    $buf = New-Object byte[] 8192
    $n = $stream.Read($buf, 0, $buf.Length)
    if ($n -le 0) { $client.Close(); continue }
    $req = [System.Text.Encoding]::ASCII.GetString($buf, 0, $n)
    $reqLine = ($req -split "`r`n")[0]
    $parts = $reqLine -split ' '

    $status = '200 OK'
    $bytes = $null
    $ct = 'application/octet-stream'

    if ($parts.Count -lt 2) {
      $status = '400 Bad Request'
      $bytes = [System.Text.Encoding]::UTF8.GetBytes('400')
      $ct = 'text/plain'
    } else {
      # Path senza query string, decodificato.
      $rel = ($parts[1] -split '\?')[0]
      $rel = [System.Uri]::UnescapeDataString($rel).TrimStart('/')
      if ([string]::IsNullOrEmpty($rel)) { $rel = 'index.html' }
      $rel = $rel -replace '/', '\'

      $path = Join-Path $root $rel
      if (Test-Path $path -PathType Container) { $path = Join-Path $path 'index.html' }

      # Sicurezza: niente uscite dalla cartella del gioco (es. ..\..\segreti).
      $full = $null
      try { $full = [System.IO.Path]::GetFullPath($path) } catch { $full = $null }
      $rootFull = [System.IO.Path]::GetFullPath($root)
      $inside = $full -and $full.StartsWith($rootFull, [System.StringComparison]::OrdinalIgnoreCase)

      if ($inside -and (Test-Path $full -PathType Leaf)) {
        $ext = [System.IO.Path]::GetExtension($full).ToLower()
        if ($mime.ContainsKey($ext)) { $ct = $mime[$ext] }
        $bytes = [System.IO.File]::ReadAllBytes($full)
      } else {
        $status = '404 Not Found'
        $bytes = [System.Text.Encoding]::UTF8.GetBytes('404 Not Found')
        $ct = 'text/plain'
      }
    }

    $head = "HTTP/1.1 $status`r`nContent-Type: $ct`r`nContent-Length: $($bytes.Length)`r`n" +
            "Cache-Control: no-store`r`nConnection: close`r`n`r`n"
    $hb = [System.Text.Encoding]::ASCII.GetBytes($head)
    $stream.Write($hb, 0, $hb.Length)
    $stream.Write($bytes, 0, $bytes.Length)
    $stream.Flush()
    $client.Close()
  } catch {
    try { if ($client) { $client.Close() } } catch { }
  }
}
