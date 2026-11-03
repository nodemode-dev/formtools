@echo off
setlocal
cd /d "%~dp0.."
if not defined FORMTOOLS_PORT set "FORMTOOLS_PORT=8240"
start "formtools engine" cmd /k "cd /d %cd%\setup && boot_backend.bat"
start "formtools frontend" cmd /k "cd /d %cd%\setup && boot_frontend.bat"
echo [formtools] frontend http://127.0.0.1:5240 and engine http://127.0.0.1:%FORMTOOLS_PORT%
