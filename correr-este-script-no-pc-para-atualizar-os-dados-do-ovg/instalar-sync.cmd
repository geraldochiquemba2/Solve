@echo off
REM Instalador do sync OVG -> CRM numa maquina nova (rede com IP autorizado).
REM Correr COMO ADMINISTRADOR a partir desta pasta.
REM Faz: pasta destino + .env minimo + deps (pg, dotenv) + teste + tarefa 6/6h.
setlocal EnableDelayedExpansion
cd /d "%~dp0"
REM Raiz do repo = pasta acima desta.
set "ROOT=%~dp0.."
if not exist "%ROOT%\.env" (
  echo [ERRO] .env da raiz nao encontrado em %ROOT%. Esta pasta tem de estar
  echo dentro da pasta do repo (Solve-Corporate-CRM).
  pause
  exit /b 1
)

echo [1/5] A verificar Node.js e npm...
where node >nul 2>nul
if %errorlevel% neq 0 (
  echo [ERRO] Node.js nao encontrado. Instala o Node 20 LTS e volta a correr.
  pause
  exit /b 1
)
where npm >nul 2>nul
if %errorlevel% neq 0 (
  echo [ERRO] npm nao encontrado junto ao Node. Reinstala o Node 20 LTS.
  pause
  exit /b 1
)
node --version

set "DEST=C:\solve-sync"
set /p "DEST=Destino [%DEST%]: "
if not exist "%DEST%" mkdir "%DEST%" 2>nul
if not exist "%DEST%" (
  echo [ERRO] Nao consegui criar %DEST%.
  pause
  exit /b 1
)

echo [2/5] A copiar script...
copy /y "%ROOT%\packages\db\ovg-reseed.cjs" "%DEST%\ovg-reseed.cjs" >nul
if %errorlevel% neq 0 (
  echo [ERRO] Nao encontrei packages\db\ovg-reseed.cjs em %ROOT%. Esta pasta tem de estar
  echo dentro da pasta do repo (Solve-Corporate-CRM).
  pause
  exit /b 1
)

echo [3/5] A gerar .env minimo...
if not exist "%DEST%\.env" (
  findstr /R "^OVG_API_URL= ^OVG_USERNAME= ^OVG_PASSWORD= ^OVG_CLUB_CODE= ^CRM_DATABASE_URL=" "%ROOT%\.env" > "%DEST%\.env"
) else (
  for %%V in (OVG_API_URL OVG_USERNAME OVG_PASSWORD OVG_CLUB_CODE CRM_DATABASE_URL) do (
    findstr /B /R "^%%V=" "%DEST%\.env" >nul 2>nul
    if !errorlevel! neq 0 (
      findstr /B /R "^%%V=" "%ROOT%\.env" >> "%DEST%\.env" 2>nul
    )
  )
)
set MISSING=0
for %%V in (OVG_API_URL OVG_USERNAME OVG_PASSWORD CRM_DATABASE_URL) do (
  findstr /B /R "^%%V=." "%DEST%\.env" >nul 2>nul
  if !errorlevel! neq 0 (
    echo [AVISO] Falta %%V no %DEST%\.env
    set MISSING=1
  )
)
if !MISSING! neq 0 (
  echo Abre "%DEST%\.env" no Bloco de Notas, preenche os valores em falta
  echo e volta a correr este instalador.
  pause
  exit /b 1
)
echo .env minimo OK.

echo [4/5] A instalar dependencias (pg, dotenv)...
cd /d "%DEST%"
if not exist "node_modules\pg" call npm init -y >nul 2>&1
if not exist "node_modules\pg" call npm install pg dotenv
if not exist "node_modules\pg" (
  echo [ERRO] npm falhou. Verifica a internet e volta a correr.
  pause
  exit /b 1
)

echo [5/5] Teste: uma sincronizacao agora...
call node ovg-reseed.cjs
if %errorlevel% neq 0 (
  echo [ERRO] O teste falhou. Verifica IP autorizado e .env. Tarefa NAO criada.
  pause
  exit /b 1
)

set "HORA=02:00"
set /p "HORA=Hora de inicio da tarefa 6/6h HH:MM [%HORA%]: "
schtasks /create /tn "SolveCRM-OVG-Sync" /tr "\"C:\Program Files\nodejs\node.exe\" \"%DEST%\ovg-reseed.cjs\"" /sc HOURLY /mo 6 /st %HORA% /f
if %errorlevel% neq 0 (
  echo [ERRO] schtasks falhou. Corre este ficheiro COMO ADMINISTRADOR.
  pause
  exit /b 1
)
echo.
echo OK: sync instalado em %DEST%, tarefa SolveCRM-OVG-Sync de 6 em 6h desde %HORA%.
echo Confirma na BD: SELECT synced_at, records_synced FROM sync_log ORDER BY id DESC LIMIT 3;
pause
