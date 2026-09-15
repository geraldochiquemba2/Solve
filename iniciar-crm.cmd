@echo off
title Solve Corporate CRM — Tunnel + Backend
echo ============================================
echo   1. A iniciar o CRM Backend (porta 3000)...
echo ============================================
cd /d "%~dp0apps\api"
start /b node --enable-source-maps ./dist/index.mjs

echo ============================================
echo   2. A criar tunel Cloudflare...
echo ============================================
echo.
echo   COPIA O URL QUE APARECE EM BAIXO:
echo   (precisas dele para o PC da catraca)
echo.
where cloudflared >nul 2>nul
if %errorlevel%==0 (
  cloudflared tunnel --url http://localhost:3000
) else (
  echo [AVISO] cloudflared nao esta no PATH.
  echo Instala em https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
)
pause
