# Vendors the draw.io web app into the extension so the DFD editor works fully offline.
# Run once with internet: pwsh tra/tools/vendor-drawio.ps1
# Result: tra/vscode-extension/media/drawio/index.html (+ js/css). The editor auto-detects it.
param([string]$Version = "v24.7.17")
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot                       # tra/
$media = Join-Path $root "vscode-extension/media/drawio"
$tmp = Join-Path $env:TEMP "drawio-src.zip"
$ex = Join-Path $env:TEMP "drawio-src"
Write-Host "Downloading draw.io $Version source..."
Invoke-WebRequest "https://github.com/jgraph/drawio/archive/refs/tags/$Version.zip" -OutFile $tmp
if (Test-Path $ex) { Remove-Item $ex -Recurse -Force }
Expand-Archive $tmp -DestinationPath $ex -Force
$webapp = Get-ChildItem $ex -Directory | Select-Object -First 1 | ForEach-Object { Join-Path $_.FullName "src/main/webapp" }
if (-not (Test-Path $webapp)) { throw "webapp folder not found in archive" }
if (Test-Path $media) { Remove-Item $media -Recurse -Force }
New-Item -ItemType Directory -Path $media -Force | Out-Null
Copy-Item (Join-Path $webapp "*") $media -Recurse -Force
Write-Host "Vendored draw.io to $media. The DFD editor will now load it offline."
