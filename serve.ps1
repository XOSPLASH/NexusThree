param(
  [int]$Port = 5500,
  [string]$Root = "."
)

$ErrorActionPreference = "Stop"

$rootPath = (Resolve-Path $Root).Path
$prefix = "http://localhost:$Port/"

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)

try {
  $listener.Start()
  Write-Host "Serving $rootPath at $prefix"
} catch {
  Write-Host "Failed to start server: $($_.Exception.Message)"
  exit 1
}

# Simple MIME type map
$mime = @{
  ".html" = "text/html"
  ".htm"  = "text/html"
  ".css"  = "text/css"
  ".js"   = "application/javascript"
  ".json" = "application/json"
  ".png"  = "image/png"
  ".jpg"  = "image/jpeg"
  ".jpeg" = "image/jpeg"
  ".svg"  = "image/svg+xml"
  ".ico"  = "image/x-icon"
}

while ($true) {
  $context = $listener.GetContext()
  $request = $context.Request
  $response = $context.Response

  # Map URL path to file system
  $localPath = $request.Url.LocalPath.TrimStart("/")
  if ([string]::IsNullOrEmpty($localPath)) { $localPath = "index.html" }
  $filePath = Join-Path $rootPath $localPath

  if (-not (Test-Path $filePath)) {
    # Fallback to index.html for directory requests
    $dirPath = Join-Path $rootPath $localPath
    if (Test-Path $dirPath -PathType Container) {
      $filePath = Join-Path $dirPath "index.html"
    }
  }

  if (-not (Test-Path $filePath)) {
    $response.StatusCode = 404
    $bytesNF = [System.Text.Encoding]::UTF8.GetBytes("Not found")
    $response.OutputStream.Write($bytesNF, 0, $bytesNF.Length)
    $response.Close()
    continue
  }

  $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
  $ctype = $mime[$ext]
  if (-not $ctype) { $ctype = "application/octet-stream" }
  $response.ContentType = $ctype

  try {
    $bytes = [System.IO.File]::ReadAllBytes($filePath)
    $response.ContentLength64 = $bytes.Length
    $response.OutputStream.Write($bytes, 0, $bytes.Length)
  } catch {
    $response.StatusCode = 500
    $errBytes = [System.Text.Encoding]::UTF8.GetBytes("Server error")
    $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
  } finally {
    $response.OutputStream.Close()
  }
}