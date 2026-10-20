@echo off
title Solve CRM - Migrar variaveis Render (conta antiga -> conta nova)
echo ============================================================
echo   Migra as variaveis de ambiente entre dois servicos Render
echo ============================================================
echo.
echo   Precisas dos IDs dos servicos. Ambos aparecem no URL do dashboard:
echo     https://dashboard.render.com/web/srv-xxxxxxxx
echo.
set /p OLD="ID do servico ANTIGO (srv-...): "
set /p NEW="ID do servico NOVO  (srv-...): "
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0scripts\migrar-render-env.ps1" -OldServiceId "%OLD%" -NewServiceId "%NEW%"
pause
