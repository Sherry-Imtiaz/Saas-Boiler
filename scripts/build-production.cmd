@echo off
setlocal
cd /d "%~dp0.."
echo Installing dependencies and building production artifacts...
npm install --ignore-scripts
npm run build
endlocal
