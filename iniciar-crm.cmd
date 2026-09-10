@echo off
title Solve Corporate CRM — Tunnel + Backend
echo ============================================
echo   1. A iniciar o CRM Backend (porta 3000)...
echo ============================================
cd /d "C:\Users\Geraldo\Downloads\Solve-Corporate-CRM\Solve-Corporate-CRM\artifacts\api-server"
start /b node --enable-source-maps ./dist/index.mjs

echo ============================================
echo   2. A criar tunel Cloudflare...
echo ============================================
echo.
echo   COPIA O URL QUE APARECE EM BAIXO:
echo   (precisas dele para o PC da catraca)
echo.
C:\Users\Geraldo\cloudflared.exe tunnel --url http://localhost:3000
pause
