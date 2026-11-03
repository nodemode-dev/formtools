@echo off
setlocal
cd /d "%~dp0..\backend"
if not exist venv\Scripts\activate.bat ( echo [formtools] backend venv missing, run formtools.bat install & exit /b 1 )
call venv\Scripts\activate.bat
if not defined FORMTOOLS_PORT set "FORMTOOLS_PORT=8240"
echo [formtools] engine http://127.0.0.1:%FORMTOOLS_PORT%
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port %FORMTOOLS_PORT%
