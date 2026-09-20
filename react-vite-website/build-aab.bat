@echo off
REM ============================================================
REM  One-click build: produces a signed Android App Bundle (.aab)
REM  for Daily Stock Book (com.mansur.dailystock).
REM  Just double-click this file. The .aab appears at:
REM    android\app\build\outputs\bundle\release\app-release.aab
REM ============================================================
setlocal
cd /d "%~dp0"

echo.
echo === [1/2] Syncing web + native config (npx cap sync android) ===
call npx cap sync android
if errorlevel 1 goto :fail

echo.
echo === [2/2] Building signed release bundle (gradlew bundleRelease) ===
cd android
call gradlew.bat bundleRelease
if errorlevel 1 goto :fail
cd ..

echo.
echo ============================================================
echo  BUILD OK
echo  Your upload file (.aab):
echo    %~dp0android\app\build\outputs\bundle\release\app-release.aab
echo ============================================================
echo.
pause
exit /b 0

:fail
echo.
echo *** BUILD FAILED - scroll up to see the error. ***
echo.
pause
exit /b 1
