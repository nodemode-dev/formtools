@echo off
setlocal
cd /d "%~dp0..\backend"
if not exist venv\Scripts\activate.bat ( echo [formtools] backend venv missing, run formtools.bat install & exit /b 1 )
call venv\Scripts\activate.bat
python -m pip install -r requirements_desktop.txt || exit /b 1
where cargo >nul 2>nul || ( echo [formtools] Rust is not installed, get it from https://rustup.rs & exit /b 1 )
if not exist ..\frontend\node_modules\.bin\tauri.cmd (
  pushd ..\frontend
  if exist package-lock.json ( call npm ci ) else ( call npm install )
  popd
)
echo [formtools] desktop toolchain ready
