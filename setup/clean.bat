@echo off
setlocal
cd /d "%~dp0.."
for %%p in (frontend\dist backend\build backend\dist-engine src-tauri\target src-tauri\gen src-tauri\engine) do if exist %%p rmdir /s /q %%p
del /q src-tauri\binaries\formtools-engine-* 2>nul
if /i "%~1"=="--all" (
  if exist frontend\node_modules rmdir /s /q frontend\node_modules
  if exist backend\venv rmdir /s /q backend\venv
)
echo [formtools] clean
