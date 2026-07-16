@echo off
setlocal
cd /d "%~dp0.."
where mvn >nul 2>nul || (
  echo [ERROR] Maven is not available on PATH. Install Maven 3.9+ or configure PATH.
  exit /b 127
)
set "BROWSER=%FLIC_BROWSER%"
if not defined BROWSER set "BROWSER=chrome"
mvn test -Dbrowser=%BROWSER% -Dheadless=false -DsuiteXmlFile=suites/ui.xml %*
exit /b %ERRORLEVEL%
