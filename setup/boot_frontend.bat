@echo off
setlocal
cd /d "%~dp0..\frontend"
if not exist node_modules ( echo [formtools] frontend dependencies missing, run formtools.bat install & exit /b 1 )
if not defined FORMTOOLS_PORT set "FORMTOOLS_PORT=8240"
call npm run dev
