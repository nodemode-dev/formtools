@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
set "OPEN=0"
set "CLEAN=0"
set "CONFIG_ARGS="
:args
if "%~1"=="" goto :argsdone
if /i "%~1"=="--open" ( set "OPEN=1" & shift & goto :args )
if /i "%~1"=="--clean" ( set "CLEAN=1" & shift & goto :args )
if /i "%~1"=="--no-install" ( shift & goto :args )
if /i "%~1"=="--help" goto :usage
if /i "%~1"=="-h" goto :usage
if /i "%~1"=="--config" (
  if "%~2"=="" ( echo [formtools] --config needs a file & exit /b 2 )
  set "CONFIG_ARGS=!CONFIG_ARGS! --config "%~2""
  shift & shift & goto :args
)
call :usage
exit /b 2
:argsdone

echo.
echo [formtools] == checking the tools
where node >nul 2>nul || ( echo [formtools] Node 20.19 or newer is needed: https://nodejs.org & exit /b 1 )
where cargo >nul 2>nul || ( echo [formtools] Rust is needed: https://rustup.rs ^(choose the MSVC toolchain^) & exit /b 1 )
node -e "const [a,b]=process.versions.node.split('.').map(Number); process.exit(a>22||(a===22&&b>=12)||(a===20&&b>=19)?0:1)" || ( echo [formtools] Node 20.19 or 22.12 or newer is needed: https://nodejs.org & exit /b 1 )
rustc -vV | findstr /c:"host: " | findstr /c:"msvc" >nul || ( echo [formtools] Rust must use the MSVC toolchain: rustup default stable-msvc & exit /b 1 )
set "PY="
where py >nul 2>nul && py -3 -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 12) else 1)" >nul 2>nul && set "PY=py -3"
if not defined PY ( where python >nul 2>nul && python -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 12) else 1)" >nul 2>nul && set "PY=python" )
if not defined PY ( echo [formtools] Python 3.12 or newer is needed for the engine: https://www.python.org & exit /b 1 )
echo [formtools] the Rust compile needs the Visual Studio C++ build tools ^(Desktop development with C++^): https://visualstudio.microsoft.com/visual-cpp-build-tools/

echo.
echo [formtools] == installing the engine, the interface packages and the desktop toolchain
call formtools_oc_install.bat || goto :failed
call formtools.bat install-desktop || goto :failed

if "%CLEAN%"=="1" (
  echo.
  echo [formtools] == cleaning earlier builds
  pushd src-tauri
  cargo clean || ( popd & goto :failed )
  popd
  if exist frontend\dist rmdir /s /q frontend\dist
  if exist backend\build rmdir /s /q backend\build
  if exist backend\dist-engine rmdir /s /q backend\dist-engine
  if exist src-tauri\engine rmdir /s /q src-tauri\engine
)

echo.
echo [formtools] == building the desktop app and the installers ^(msi and setup.exe^)
echo [formtools] the interface, then the engine frozen with PyInstaller, then a few hundred Rust crates on the first build
call setup\desktop_build.bat --bundles msi,nsis !CONFIG_ARGS! || goto :failed

echo.
echo [formtools] done. The installers are in src-tauri\target\release\bundle\msi and src-tauri\target\release\bundle\nsis
if "%OPEN%"=="1" start "" "src-tauri\target\release\bundle"
exit /b 0

:failed
echo.
echo [formtools] the build stopped at the step above; fix what it says and run build_app.bat again
exit /b 1

:usage
echo build_app.bat               build formtools' desktop app on Windows, start to finish
echo   --open                    open the folder with the installers when the build is done
echo   --clean                   rebuild the engine, the interface and the Rust side from nothing
echo   --config ^<file^>           extra Tauri settings passed to the build ^(formcompiler passes its own here^)
exit /b 0
