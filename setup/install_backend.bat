@echo off
setlocal
cd /d "%~dp0..\backend"
if not exist venv\Scripts\activate.bat (
  echo [formtools] creating backend\venv
  where py >nul 2>nul && ( py -3 -m venv venv ) || ( python -m venv venv )
  if errorlevel 1 exit /b 1
)
call venv\Scripts\activate.bat
python -m pip install --upgrade pip
python -m pip install -r requirements.txt || exit /b 1
echo [formtools] backend ready
