@echo off
rem Stop CLIProxyAPI
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop.ps1"
pause
