@echo off
setlocal
cd /d "%~dp0.."
if "%TEST_MONGODB_URI%"=="" set TEST_MONGODB_URI=mongodb://localhost:27017/saas_boilerplate_test
echo Running integration tests against %TEST_MONGODB_URI%
echo Make sure MongoDB is running first: docker compose up -d
npm run test:integration || exit /b 1
endlocal
