@echo off
REM Sincronizacao OVG -> CRM (corre local: IP autorizado pela OVG).
REM Duplo clique = corre 1x agora. Para automatico, agendar no Windows (ver instrucoes no fim).
title Solve CRM — Sync OVG
cd /d "%~dp0"
node "packages\db\ovg-reseed.cjs"
echo.
echo Para AUTOMATICO (4x/dia), corre UMA vez como Administrador:
echo schtasks /create /tn "SolveCRM-OVG-Sync" /tr "\"C:\Program Files\nodejs\node.exe\" \"%~dp0packages\db\ovg-reseed.cjs\"" /sc HOURLY /mo 6 /f
pause
