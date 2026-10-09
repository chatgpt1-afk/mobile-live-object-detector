# Localhost only; no admin or Python required. Press Ctrl+C to stop.
$measureRoot = $PSScriptRoot
$measureListener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, 8765)
try { $measureListener.Start() } catch { Write-Host 'Port 8765 is busy. Close the earlier server and retry.'; exit 1 }
Write-Host 'Open http://localhost:8765 on THIS PC. Phone camera needs an HTTPS site; see GUIDE.html.'
Start-Process 'http://localhost:8765'
$measureTypes = @{'.html'='text/html; charset=utf-8';'.js'='text/javascript; charset=utf-8';'.css'='text/css; charset=utf-8';'.pdf'='application/pdf';'.md'='text/plain; charset=utf-8';'.json'='application/json'}
try {
while ($true) {
  $measureClient = $measureListener.AcceptTcpClient()
  $measureClient.ReceiveTimeout = 3000
  try {
    $measureStream = $measureClient.GetStream()
    $measureReader = New-Object System.IO.StreamReader($measureStream)
    $measureLine = $measureReader.ReadLine()
    if (-not $measureLine) { continue }
    $measureParts = $measureLine.Split(' ')
    if ($measureParts.Count -lt 2) { continue }
    do { $measureHeader = $measureReader.ReadLine() } while ($measureHeader)
    $measureRel = [System.Uri]::UnescapeDataString(($measureParts[1].Split('?')[0])).TrimStart('/')
    if (-not $measureRel) { $measureRel = 'index.html' }
    $measurePath = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($measureRoot, $measureRel.Replace('/', [System.IO.Path]::DirectorySeparatorChar)))
    $measureSafe = $measurePath.StartsWith($measureRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)
    if ($measureParts[0] -ne 'GET') { $measureStatus = '405 Method Not Allowed'; $measureBytes = [System.Text.Encoding]::UTF8.GetBytes('GET only') }
    elseif (-not $measureSafe -or -not [System.IO.File]::Exists($measurePath)) { $measureStatus = '404 Not Found'; $measureBytes = [System.Text.Encoding]::UTF8.GetBytes('Not found') }
    else { $measureStatus = '200 OK'; $measureBytes = [System.IO.File]::ReadAllBytes($measurePath) }
    $measureType = $measureTypes[[System.IO.Path]::GetExtension($measurePath)]
    if (-not $measureType) { $measureType = 'application/octet-stream' }
    $measureHead = [System.Text.Encoding]::ASCII.GetBytes("HTTP/1.1 $measureStatus`r`nContent-Type: $measureType`r`nContent-Length: $($measureBytes.Length)`r`nConnection: close`r`nCache-Control: no-store`r`n`r`n")
    $measureStream.Write($measureHead, 0, $measureHead.Length)
    $measureStream.Write($measureBytes, 0, $measureBytes.Length)
  } catch { Write-Host 'Request interrupted; server continues.' }
  finally { $measureClient.Close() }
}
} finally { $measureListener.Stop() }
