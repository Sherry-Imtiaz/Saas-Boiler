@echo off
setlocal
cd /d "%~dp0.."
echo Starting production API from compiled dist...
npm run start:production
endlocal
