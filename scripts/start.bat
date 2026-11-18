@echo off
cd /d "%~dp0.."
if exist "release\win-unpacked\Relay Atelier.exe" (
  start "" "release\win-unpacked\Relay Atelier.exe"
) else (
  if not exist node_modules call npm ci
  call npm start
)
