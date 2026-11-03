@echo off
setlocal
cd /d "%~dp0..\frontend"
if not exist node_modules (
  if exist package-lock.json ( call npm ci ) else ( call npm install )
)
call npm run build || exit /b 1
echo [formtools] built frontend\dist
