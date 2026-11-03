@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0.."
set "ROOT=%cd%"
if not exist backend\venv\Scripts\activate.bat ( echo [formtools] backend venv missing, run formtools.bat install & exit /b 1 )
call backend\venv\Scripts\activate.bat
python -c "import PyInstaller" >nul 2>nul || ( echo [formtools] PyInstaller missing, run formtools.bat install-desktop & exit /b 1 )
if defined FORMTOOLS_TARGET ( set "TRIPLE=%FORMTOOLS_TARGET%" ) else ( for /f "tokens=2" %%t in ('rustc -vV ^| findstr /b "host:"') do set "TRIPLE=%%t" )
if not defined TRIPLE ( echo [formtools] rustc not found, install Rust or set FORMTOOLS_TARGET & exit /b 1 )
if not exist frontend\dist\index.html call setup\build_frontend.bat
cd backend
set "FT_EXTRA_HIDDEN_IMPORT_ARGS="
for %%m in (%FORMTOOLS_HIDDEN_IMPORTS%) do set "FT_EXTRA_HIDDEN_IMPORT_ARGS=!FT_EXTRA_HIDDEN_IMPORT_ARGS! --hidden-import %%m"
if exist build\pyinstaller rmdir /s /q build\pyinstaller
if exist dist-engine rmdir /s /q dist-engine
pyinstaller --noconfirm --clean --onefile --name formtools-engine --distpath dist-engine --workpath build\pyinstaller --specpath build\pyinstaller --add-data "%ROOT%\frontend\dist;ui" --paths "%ROOT%\backend" --collect-submodules app --collect-submodules uvicorn --hidden-import OpenEXR --hidden-import rawpy --hidden-import psd_tools %FT_EXTRA_HIDDEN_IMPORT_ARGS% "%ROOT%\backend\formtools_engine.py" || exit /b 1
if not exist "%ROOT%\src-tauri\binaries" mkdir "%ROOT%\src-tauri\binaries"
copy /y dist-engine\formtools-engine.exe "%ROOT%\src-tauri\binaries\formtools-engine-%TRIPLE%.exe" >nul
"%ROOT%\src-tauri\binaries\formtools-engine-%TRIPLE%.exe" --selfcheck
echo [formtools] sidecar ready
