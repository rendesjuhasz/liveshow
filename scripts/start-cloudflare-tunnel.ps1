# Quick Cloudflare Tunnel to the local Next.js UI (port 3000).
# Usage (from repo root):
#   powershell -ExecutionPolicy Bypass -File .\scripts\start-cloudflare-tunnel.ps1
# Optional: -Port 3000

param(
    [int]$Port = 3000
)

$ErrorActionPreference = "Stop"

function Find-Cloudflared {
    $cmd = Get-Command cloudflared -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $candidates = @(
        "${env:ProgramFiles(x86)}\cloudflared\cloudflared.exe",
        "$env:ProgramFiles\cloudflared\cloudflared.exe"
    )
    foreach ($p in $candidates) {
        if (Test-Path $p) { return $p }
    }
    throw "cloudflared not found. Install with: winget install --id Cloudflare.cloudflared -e"
}

$exe = Find-Cloudflared
$local = "http://127.0.0.1:$Port"

Write-Host "cloudflared: $exe"
Write-Host "Checking $local ..."

try {
    $probe = Invoke-WebRequest -Uri $local -Method Head -TimeoutSec 8 -UseBasicParsing
    Write-Host "Local app OK (HTTP $($probe.StatusCode))"
} catch {
    try {
        $probe = Invoke-WebRequest -Uri $local -Method Get -TimeoutSec 8 -UseBasicParsing
        Write-Host "Local app OK (HTTP $($probe.StatusCode))"
    } catch {
        throw "Nothing is listening at $local. Start the frontend (npm run dev in frontend/) first."
    }
}

Write-Host "Starting Cloudflare quick tunnel -> $local"
Write-Host "The public https://*.trycloudflare.com URL will appear below."
Write-Host ""

& $exe tunnel --url $local --no-autoupdate
