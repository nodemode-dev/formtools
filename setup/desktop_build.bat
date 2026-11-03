@echo off
setlocal
cd /d "%~dp0.."
call setup\build_frontend.bat || exit /b 1
call setup\freeze_backend.bat || exit /b 1
cd frontend
call npx tauri build %* || exit /b 1
echo [formtools] bundles are in src-tauri\target\release\bundle
