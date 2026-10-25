@echo off
rem Show CLIProxyAPI status (process, port, recent log)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0status.ps1"
pause
