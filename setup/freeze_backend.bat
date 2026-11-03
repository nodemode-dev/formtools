@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0.."
set "ROOT=%cd%"
if not exist backend\venv\Scripts\activate.bat ( echo [formtools] backend venv missing, run formtools.bat install & exit /b 1 )
call backend\venv\Scripts\activate.bat
python -c "import PyInstaller" >nul 2>nul || ( echo [formtools] PyInstaller missing, run formtools.bat install-desktop & exit /b 1 )
if not exist frontend\dist\index.html call setup\build_frontend.bat
cd backend
set "FT_EXTRA_HIDDEN_IMPORT_ARGS="
for %%m in (%FORMTOOLS_HIDDEN_IMPORTS%) do set "FT_EXTRA_HIDDEN_IMPORT_ARGS=!FT_EXTRA_HIDDEN_IMPORT_ARGS! --hidden-import %%m"
if exist build\pyinstaller rmdir /s /q build\pyinstaller
if exist dist-engine rmdir /s /q dist-engine
set "PYTHONPATH=%ROOT%\backend;%PYTHONPATH%"
pyinstaller --noconfirm --clean --onedir --name formtools-engine --distpath dist-engine --workpath build\pyinstaller --specpath build\pyinstaller --add-data "%ROOT%\frontend\dist;ui" --paths "%ROOT%\backend" --collect-submodules app --collect-submodules uvicorn --hidden-import OpenEXR --hidden-import rawpy --hidden-import psd_tools %FT_EXTRA_HIDDEN_IMPORT_ARGS% "%ROOT%\backend\formtools_engine.py" || exit /b 1
if exist "%ROOT%\src-tauri\engine" rmdir /s /q "%ROOT%\src-tauri\engine"
xcopy /e /i /q /y dist-engine\formtools-engine "%ROOT%\src-tauri\engine" >nul || exit /b 1
"%ROOT%\src-tauri\engine\formtools-engine.exe" --selfcheck || exit /b 1
echo [formtools] engine folder ready: %ROOT%\src-tauri\engine
