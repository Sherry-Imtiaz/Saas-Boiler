@echo off
setlocal
cd /d "%~dp0.."
set SEED_RESET_CONFIRM=YES
npm run reset:dev-data || exit /b 1
npm run seed || exit /b 1
npm run check:install || exit /b 1
endlocal
