@echo off
title The Traitors Game Server
cd /d "%~dp0"
echo ========================================================
echo        THE TRAITORS - EVENT GAME SERVER 2.0
echo ========================================================
echo.
echo Starting server...
echo Opening game in your browser...

start http://localhost:3000/
start http://localhost:3000/secret-admin

set ELECTRON_RUN_AS_NODE=1
"C:\Users\Kartavya\AppData\Local\Programs\antigravity\Antigravity.exe" server.js

pause
