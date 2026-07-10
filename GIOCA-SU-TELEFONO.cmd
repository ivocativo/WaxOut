@echo off
REM Doppio-click per giocare a Earwax War dal TELEFONO sulla stessa rete Wi-Fi.
REM Avvia il server di rete e mostra l'indirizzo da aprire sul telefono.
title Earwax War - server telefono
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\serve-lan.ps1" -Port 8123
pause
