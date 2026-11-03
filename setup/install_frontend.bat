@echo off
setlocal
cd /d "%~dp0..\frontend"
if exist package-lock.json ( call npm ci ) else ( call npm install )
if errorlevel 1 exit /b 1
echo [formtools] frontend ready
