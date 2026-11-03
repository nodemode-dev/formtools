@echo off
setlocal
cd /d "%~dp0.."
echo [formtools] installing backend
call setup\install_backend.bat || exit /b 1
echo [formtools] installing frontend
call setup\install_frontend.bat || exit /b 1
echo [formtools] done. Boot with formtools.bat
