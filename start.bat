@echo off
REM =====================================================
REM  Start the Resume -> Portfolio local server
REM  Requires Node.js: https://nodejs.org
REM  Opens http://localhost:8000 after starting
REM =====================================================
cd /d "%~dp0"
start "Resume-to-Portfolio Server" /min cmd /c "node server.js"
timeout /t 2 /nobreak >nul
start "" "http://localhost:8000"