@echo off
echo ========================================
echo   Solve CRM - Tunnel Setup
echo ========================================
echo.
echo A iniciar o CRM API na porta 3000...
start /b node --enable-source-maps "%~dp0apps\api\dist\index.mjs"
timeout /t 3 /nobreak >nul
echo.
echo A iniciar o tunnel cloudflared...
echo O URL publico vai aparecer abaixo:
echo.
where cloudflared >nul 2>nul
if %errorlevel%==0 (
  cloudflared tunnel --url http://localhost:3000
) else (
  echo [AVISO] cloudflared nao esta no PATH.
)
