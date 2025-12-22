@echo off
REM ============================================================================
REM BRD Time Tracker - Package for Distribution
REM Creates a ZIP file ready to distribute to other systems
REM Credentials are embedded - no configuration needed!
REM ============================================================================

echo.
echo ============================================
echo  BRD Time Tracker - Distribution Packager
echo ============================================
echo.

REM Check if executable exists
if not exist "dist\BRDTimeTracker.exe" (
    echo [ERROR] BRDTimeTracker.exe not found in dist folder
    echo Please run build.bat first
    pause
    exit /b 1
)

REM Create distribution folder
set DIST_FOLDER=dist\BRDTimeTracker_Package
echo [STEP 1/3] Creating distribution folder...
if exist "%DIST_FOLDER%" rmdir /s /q "%DIST_FOLDER%"
mkdir "%DIST_FOLDER%"

REM Copy executable
echo [STEP 2/3] Copying executable...
copy "dist\BRDTimeTracker.exe" "%DIST_FOLDER%\"

REM Create README
echo [STEP 3/3] Creating README...
(
echo BRD Time Tracker - Quick Start Guide
echo ======================================
echo.
echo INSTALLATION:
echo.
echo 1. Double-click BRDTimeTracker.exe
echo.
echo 2. Login with your Atlassian account
echo.
echo 3. Done! The app will:
echo    - Run in the system tray ^(clock icon^)
echo    - Start automatically on Windows boot
echo    - Capture screenshots at configured intervals
echo.
echo.
echo FEATURES:
echo.
echo - Automatic screenshot capture
echo - Jira integration for time tracking
echo - Works offline ^(syncs when online^)
echo - System tray with color status:
echo   * Red: Not logged in
echo   * Blue: Logged in, not tracking
echo   * Green: Actively tracking
echo   * Orange: Idle or anonymous mode
echo.
echo.
echo UNINSTALL:
echo.
echo - Run uninstall.bat ^(created next to the exe^)
echo - Or use Windows Settings ^> Apps
echo.
echo.
echo DATA LOCATION:
echo.
echo All data is stored in: %%LOCALAPPDATA%%\BRDTimeTracker
echo.
echo.
echo TROUBLESHOOTING:
echo.
echo - App runs silently in system tray ^(look for clock icon^)
echo - Dashboard: http://localhost:51777
echo - Admin panel: http://localhost:51777/admin
echo.
) > "%DIST_FOLDER%\README.txt"

REM Create ZIP file if PowerShell is available
echo.
echo Creating ZIP archive...
powershell -Command "Compress-Archive -Path '%DIST_FOLDER%\*' -DestinationPath 'dist\BRDTimeTracker_Package.zip' -Force" 2>nul
if errorlevel 1 (
    echo [WARN] Could not create ZIP file automatically
    echo Please manually zip the contents of: %DIST_FOLDER%
) else (
    echo [OK] ZIP file created: dist\BRDTimeTracker_Package.zip
)

echo.
echo ============================================
echo  PACKAGING COMPLETE!
echo ============================================
echo.
echo Distribution folder: %DIST_FOLDER%
echo.
echo Contents:
dir /b "%DIST_FOLDER%"
echo.
echo To distribute:
echo 1. Share the BRDTimeTracker_Package.zip file, OR
echo 2. Copy the entire BRDTimeTracker_Package folder
echo.
echo Users simply:
echo 1. Extract the ZIP
echo 2. Double-click BRDTimeTracker.exe
echo 3. Login with Atlassian
echo.
echo No configuration needed - credentials are embedded!
echo.
pause
