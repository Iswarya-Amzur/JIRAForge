@echo off
REM ============================================================================
REM BRD Time Tracker - Uninstall Script
REM Removes the application and all associated data
REM ============================================================================

echo.
echo ============================================
echo  BRD Time Tracker - Uninstaller
echo ============================================
echo.

REM Get the directory where this script is located
set "INSTALL_DIR=%~dp0"

echo This will remove BRD Time Tracker and all associated data.
echo.
echo The following will be deleted:
echo   - Application executable
echo   - OAuth tokens and session data
echo   - Offline screenshot database
echo   - User preferences and consent data
echo.
set /p CONFIRM="Are you sure you want to uninstall? (Y/N): "
if /i not "%CONFIRM%"=="Y" (
    echo.
    echo Uninstall cancelled.
    pause
    exit /b 0
)

echo.
echo [STEP 1/4] Stopping application if running...
taskkill /f /im BRDTimeTracker.exe >nul 2>&1
if %errorlevel%==0 (
    echo   Application stopped.
) else (
    echo   Application was not running.
)

echo.
echo [STEP 2/4] Removing application data from TEMP folder...

REM Remove files from %TEMP% (current storage location)
if exist "%TEMP%\brd_tracker_auth.json" (
    del /f /q "%TEMP%\brd_tracker_auth.json"
    echo   - Removed: OAuth tokens (brd_tracker_auth.json)
)
if exist "%TEMP%\brd_tracker_offline.db" (
    del /f /q "%TEMP%\brd_tracker_offline.db"
    echo   - Removed: Offline database (brd_tracker_offline.db)
)
if exist "%TEMP%\brd_tracker_consent.json" (
    del /f /q "%TEMP%\brd_tracker_consent.json"
    echo   - Removed: Consent data (brd_tracker_consent.json)
)
if exist "%TEMP%\brd_tracker_user_cache.json" (
    del /f /q "%TEMP%\brd_tracker_user_cache.json"
    echo   - Removed: User cache (brd_tracker_user_cache.json)
)

echo.
echo [STEP 3/4] Removing application data from AppData folder...

REM Remove files from %LOCALAPPDATA%\BRDTimeTracker (future storage location)
if exist "%LOCALAPPDATA%\BRDTimeTracker" (
    rmdir /s /q "%LOCALAPPDATA%\BRDTimeTracker"
    echo   - Removed: %LOCALAPPDATA%\BRDTimeTracker
) else (
    echo   - AppData folder not found (may not exist yet)
)

echo.
echo [STEP 4/4] Removing application files...

REM Remove the executable (but not this script yet)
if exist "%INSTALL_DIR%BRDTimeTracker.exe" (
    del /f /q "%INSTALL_DIR%BRDTimeTracker.exe"
    echo   - Removed: BRDTimeTracker.exe
)

REM Remove .env file if exists
if exist "%INSTALL_DIR%.env" (
    del /f /q "%INSTALL_DIR%.env"
    echo   - Removed: .env configuration
)

REM Remove any log files
if exist "%INSTALL_DIR%*.log" (
    del /f /q "%INSTALL_DIR%*.log"
    echo   - Removed: Log files
)

echo.
echo ============================================
echo  Uninstall Complete!
echo ============================================
echo.
echo BRD Time Tracker has been removed from your system.
echo.
echo Note: This uninstall script will remain in the folder.
echo       You can delete this folder manually if desired.
echo.
pause
