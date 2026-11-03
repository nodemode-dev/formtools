@echo off
setlocal
cd /d "%~dp0.."
if not exist frontend\dist\index.html call setup\build_frontend.bat
cd backend
if not exist venv\Scripts\activate.bat ( echo [formtools] backend venv missing, run formtools.bat install & exit /b 1 )
call venv\Scripts\activate.bat
if not defined FORMTOOLS_PORT set "FORMTOOLS_PORT=8240"
echo [formtools] serving http://127.0.0.1:%FORMTOOLS_PORT%
python -m uvicorn app.main:app --host 127.0.0.1 --port %FORMTOOLS_PORT%
