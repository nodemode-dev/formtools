@echo off
setlocal
cd /d "%~dp0.."
set "WHICH=%~1"
if "%WHICH%"=="" set "WHICH=all"
set "REST=%2 %3 %4 %5 %6 %7 %8 %9"
set "FAIL=0"
if /i "%WHICH%"=="all" goto :unit
if /i "%WHICH%"=="unit" goto :unit
if /i "%WHICH%"=="engine" goto :engine
echo [formtools] unknown test layer: %WHICH% (use unit, engine or nothing for all)
exit /b 2
:unit
if not exist frontend\node_modules ( echo [formtools] error: frontend not installed, run formtools.bat install & exit /b 1 )
echo [formtools] interface logic (vitest)
pushd frontend
call npx vitest run %REST%
if errorlevel 1 set "FAIL=1"
popd
if /i "%WHICH%"=="unit" exit /b %FAIL%
:engine
set "PY=backend\venv\Scripts\python.exe"
if not exist "%PY%" ( echo [formtools] error: backend venv missing, run formtools.bat install & exit /b 1 )
"%PY%" -c "import pytest, httpx" >nul 2>nul
if errorlevel 1 ( echo [formtools] error: the engine tests need pytest and httpx: %PY% -m pip install pytest httpx & exit /b 1 )
echo [formtools] engine (pytest)
pushd backend
venv\Scripts\python.exe -m pytest tests -q -p no:cacheprovider %REST%
if errorlevel 1 set "FAIL=1"
popd
exit /b %FAIL%
