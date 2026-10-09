@echo off
cd /d "%~dp0"
echo Tabletop Measure - PC local server
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start_server.ps1"
pause
