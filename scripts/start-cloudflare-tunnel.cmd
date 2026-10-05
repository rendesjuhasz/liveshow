@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-cloudflare-tunnel.ps1" %*
