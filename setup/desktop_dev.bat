@echo off
setlocal
cd /d "%~dp0.."
call setup\freeze_backend.bat || exit /b 1
cd frontend
call npx tauri dev
