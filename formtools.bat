@echo off
setlocal
cd /d "%~dp0"
set "CMD=%~1"
set "ARG=%~2"
if "%CMD%"=="" set "CMD=boot"
if /i "%CMD%"=="boot" ( call setup\boot_all.bat & goto :eof )
if /i "%CMD%"=="dev" ( call setup\boot_all.bat & goto :eof )
if /i "%CMD%"=="install" ( call setup\install_all.bat %ARG% & goto :eof )
if /i "%CMD%"=="install-desktop" ( call setup\install_desktop.bat & goto :eof )
if /i "%CMD%"=="backend" ( call setup\boot_backend.bat & goto :eof )
if /i "%CMD%"=="frontend" ( call setup\boot_frontend.bat & goto :eof )
if /i "%CMD%"=="build" ( call setup\build_frontend.bat & goto :eof )
if /i "%CMD%"=="serve" ( call setup\serve.bat & goto :eof )
if /i "%CMD%"=="freeze" ( call setup\freeze_backend.bat & goto :eof )
if /i "%CMD%"=="desktop" (
  if /i "%ARG%"=="build" ( call :desktop_build %* ) else ( call setup\desktop_dev.bat )
  goto :eof
)
if /i "%CMD%"=="mcp" ( call :mcp %* & goto :eof )
if /i "%CMD%"=="cli" ( call :cli %* & goto :eof )
if /i "%CMD%"=="agents" ( call :agents %* & goto :eof )
if /i "%CMD%"=="mcpb" ( call :mcpb %* & goto :eof )
if /i "%CMD%"=="sparkle" ( python setup\sparkle.py --check & goto :eof )
if /i "%CMD%"=="doctor" ( call setup\doctor.bat & goto :eof )
if /i "%CMD%"=="clean" ( call setup\clean.bat %ARG% & goto :eof )
if /i "%CMD%"=="version" ( call :version & goto :eof )
if /i "%CMD%"=="--version" ( call :version & goto :eof )
if /i "%CMD%"=="help" ( call :usage & exit /b 0 )
echo [formtools] unknown command: %CMD%
call :usage
exit /b 2
:desktop_build
shift
shift
call setup\desktop_build.bat %1 %2 %3 %4 %5 %6 %7 %8 %9
exit /b %errorlevel%
:mcp
shift
python setup\mcp_stdio.py %1 %2 %3 %4 %5 %6 %7 %8 %9
exit /b %errorlevel%
:cli
shift
python setup\cli.py %1 %2 %3 %4 %5 %6 %7 %8 %9
exit /b %errorlevel%
:agents
shift
python setup\agents.py %1 %2 %3 %4 %5 %6 %7 %8 %9
exit /b %errorlevel%
:mcpb
if /i "%~2"=="build" goto :mcpb_build
if /i "%~2"=="check" goto :mcpb_check
if "%~2"=="" goto :mcpb_check
echo [formtools] usage: formtools.bat mcpb check ^| build DIR
exit /b 2
:mcpb_check
python setup\mcpb.py --check
exit /b %errorlevel%
:mcpb_build
python setup\mcpb.py --build "%~3"
exit /b %errorlevel%
:version
set "FTV=0.2.0"
for /f "tokens=2 delims='" %%v in ('findstr /b /c:"export const VERSION" frontend\src\version.ts 2^>nul') do set "FTV=%%v"
echo formtools %FTV%
exit /b 0
:usage
echo formtools.bat [command]
echo   boot ^| install [--lite] ^| install-desktop ^| backend ^| frontend ^| build ^| serve ^| freeze
echo   desktop dev ^| desktop build [--config F] [--target T] ^| mcp ^| cli ^| agents install^|sync^|check ^| mcpb check^|build DIR ^| sparkle ^| doctor ^| clean [--all] ^| version ^| help
exit /b 0
