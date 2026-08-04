@echo off
REM Doppio-click per giocare a WAXOUT dal TELEFONO sulla stessa rete Wi-Fi.
REM Avvia il server di rete e mostra l'indirizzo da aprire sul telefono.
title Waxout - server telefono
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\serve-lan.ps1" -Port 8123
pause
