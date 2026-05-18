# Install voice-matching-service dependencies without broken SOCKS/proxy pip config.
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$env:HTTP_PROXY = ""
$env:HTTPS_PROXY = ""
$env:ALL_PROXY = ""
$env:NO_PROXY = "*"

if (Test-Path ".\.venv\Scripts\python.exe") {
    $Python = ".\.venv\Scripts\python.exe"
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
    if (-not (Test-Path ".\.venv")) { python -m venv .venv }
    $Python = ".\.venv\Scripts\python.exe"
} else {
    throw "Python not found. Install Python 3 and re-run."
}

function Unset-PipProxy {
    param([string]$Key)
    & $Python -m pip config unset $Key 2>$null
}
Unset-PipProxy "global.proxy"
Unset-PipProxy "user.proxy"
Unset-PipProxy "global.http-proxy"
Unset-PipProxy "global.https-proxy"
Unset-PipProxy "user.http-proxy"
Unset-PipProxy "user.https-proxy"

Write-Host "Installing SOCKS support (PySocks)..."
& $Python -m pip install "requests[socks]" --no-cache-dir
if ($LASTEXITCODE -ne 0) {
    Write-Host "requests[socks] failed; trying PySocks..."
    & $Python -m pip install PySocks --no-cache-dir
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Write-Host "Installing requirements.txt..."
& $Python -m pip install -r requirements.txt --no-cache-dir
exit $LASTEXITCODE
