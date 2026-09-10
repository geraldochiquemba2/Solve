@echo off
echo ========================================
echo   Solve CRM - Tunnel Setup
echo ========================================
echo.
echo A iniciar o CRM API na porta 3000...
start /b node --enable-source-maps "C:\Users\Geraldo\Downloads\Solve-Corporate-CRM\Solve-Corporate-CRM\artifacts\api-server\dist\index.mjs"
timeout /t 3 /nobreak >nul
echo.
echo A iniciar o tunnel cloudflared...
echo O URL publico vai aparecer abaixo:
echo.
"C:\Users\Geraldo\cloudflared.exe" tunnel --url http://localhost:3000
