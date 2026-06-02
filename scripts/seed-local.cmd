@echo off
setlocal
cd /d "%~dp0.."
node scripts\setup-local.mjs || exit /b 1
npm run seed || exit /b 1
npm run check:install || exit /b 1
endlocal
