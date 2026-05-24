# Start voice-matching-service with SOCKS/HTTP proxy env vars cleared.
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$env:HTTP_PROXY = ""
$env:HTTPS_PROXY = ""
$env:ALL_PROXY = ""
$env:http_proxy = ""
$env:https_proxy = ""
$env:all_proxy = ""
Remove-Item Env:HTTP_PROXY, Env:HTTPS_PROXY, Env:ALL_PROXY -ErrorAction SilentlyContinue
Remove-Item Env:http_proxy, Env:https_proxy, Env:all_proxy -ErrorAction SilentlyContinue
Remove-Item Env:NO_PROXY, Env:no_proxy -ErrorAction SilentlyContinue

$env:SB_DISABLE_K2 = "1"
$env:SPEECHBRAIN_DISABLE_K2 = "1"

if (Test-Path ".\.venv\Scripts\python.exe") {
    $Python = ".\.venv\Scripts\python.exe"
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
    $Python = "python"
} else {
    throw "Python not found. Run scripts/install-deps.ps1 first."
}

Write-Host "Starting uvicorn on http://0.0.0.0:8000 (proxies cleared)..."
& $Python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
