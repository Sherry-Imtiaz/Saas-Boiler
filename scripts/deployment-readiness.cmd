@echo off
setlocal
cd /d "%~dp0.."
echo Running SaaS Boilerplate deployment readiness checks...
npm run check:deployment -- --strict
endlocal
