@echo off
title Live Object Frame - Local Server
cd /d "%~dp0"
echo.
echo Live Object Frame is starting...
echo Open this address on this PC: http://localhost:8000
echo.
echo Camera access on a phone requires HTTPS. See TEST_GUIDE.md.
echo Press Ctrl+C to stop the server.
echo.
py -m http.server 8000
if errorlevel 1 python -m http.server 8000
pause
