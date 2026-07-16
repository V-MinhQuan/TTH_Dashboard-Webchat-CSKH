@echo off
setlocal
cd /d "%~dp0.."
where mvn >nul 2>nul || (
  echo [ERROR] Maven is not available on PATH. Install Maven 3.9+ or configure PATH.
  exit /b 127
)
mvn clean test -DsuiteXmlFile=testng.xml %*
exit /b %ERRORLEVEL%
