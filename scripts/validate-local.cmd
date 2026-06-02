@echo off
setlocal
cd /d "%~dp0.."
echo Preparing local env files...
node scripts\setup-local.mjs || exit /b 1
echo Building API and web apps...
npm run build || exit /b 1
echo Running fast unit tests...
npm test || exit /b 1
echo Running deployment readiness checks without database connection...
npm run check:deployment -- --skip-db || exit /b 1
echo.
echo Local validation completed. To validate database-backed flows, run:
echo docker compose up -d
echo npm run seed
echo npm run check:install
echo npm run test:integration:local
endlocal
