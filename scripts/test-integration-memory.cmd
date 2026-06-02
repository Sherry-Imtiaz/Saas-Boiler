@echo off
setlocal
cd /d "%~dp0.."
set USE_MONGODB_MEMORY_SERVER=true
echo Running integration tests with mongodb-memory-server.
echo This may download a MongoDB binary the first time it runs.
npm run test:integration || exit /b 1
endlocal
