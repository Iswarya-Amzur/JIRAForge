@echo off
REM ============================================================================
REM Time Tracker - Build Script for Windows
REM Creates a compressed standalone executable with embedded credentials
REM No .env file needed for distribution - credentials are embedded in code
REM ============================================================================

echo.
echo ============================================
echo  Time Tracker - Build Script
echo ============================================
echo.
echo NOTE: Credentials are embedded in desktop_app.py
echo       No .env file needed for distribution!
echo.

REM Check if Python is available
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed or not in PATH
    echo Please install Python 3.8+ and try again
    pause
    exit /b 1
)

REM Check if we're in the right directory
if not exist "desktop_app.py" (
    echo [ERROR] desktop_app.py not found
    echo Please run this script from the python-desktop-app directory
    pause
    exit /b 1
)

REM Check for virtual environment
if exist "venv\Scripts\activate.bat" (
    echo [INFO] Activating virtual environment...
    call venv\Scripts\activate.bat
) else (
    echo [INFO] No virtual environment found, using system Python
)

REM Install/update dependencies
echo.
echo [STEP 1/4] Installing dependencies...
pip install -r requirements.txt --quiet
if errorlevel 1 (
    echo [ERROR] Failed to install dependencies
    pause
    exit /b 1
)

REM Check for UPX compression (optional)
echo.
echo [STEP 2/4] Checking for UPX compression tool...
where upx >nul 2>&1
if errorlevel 1 (
    echo [INFO] UPX not found - attempting auto-install...
    where winget >nul 2>&1
    if not errorlevel 1 (
        winget install --id UPX.UPX -e --silent --accept-source-agreements --accept-package-agreements >nul 2>&1
    )

    where upx >nul 2>&1
    if errorlevel 1 (
        where choco >nul 2>&1
        if not errorlevel 1 (
            choco install upx -y >nul 2>&1
        )
    )

    where upx >nul 2>&1
    if errorlevel 1 (
        where scoop >nul 2>&1
        if not errorlevel 1 (
            scoop install upx >nul 2>&1
        )
    )

    where upx >nul 2>&1
    if errorlevel 1 (
        echo [WARN] UPX install failed or unavailable - executable will not be compressed
        echo       Install manually from https://github.com/upx/upx/releases and add to PATH
    ) else (
        echo [OK] UPX installed and found in PATH - compression enabled
    )
) else (
    echo [OK] UPX found - compression enabled
)

REM Clean previous builds
echo.
echo [STEP 3/4] Cleaning previous builds...
if exist "dist" rmdir /s /q dist
if exist "build" rmdir /s /q build

REM Build the executable
echo.
echo [STEP 4/4] Building executable...
echo This may take a few minutes...
echo.

pyinstaller desktop_app.spec

if errorlevel 1 (
    echo.
    echo [ERROR] Build failed! Check the output above for errors.
    pause
    exit /b 1
)

REM Check if build was successful
if exist "dist\TimeTracker.exe" (
    echo.
    echo ============================================
    echo  BUILD SUCCESSFUL!
    echo ============================================
    echo.

    REM Get file size
    for %%A in ("dist\TimeTracker.exe") do (
        set /a size=%%~zA / 1024 / 1024
        echo Executable: dist\TimeTracker.exe
        echo Size: ~%%~zA bytes
    )

    echo.
    echo ============================================
    echo  DISTRIBUTION READY
    echo ============================================
    echo.
    echo The executable is ready to distribute!
    echo.
    echo Features included:
    echo   - Credentials embedded - no .env file needed
    echo   - Auto-start on Windows boot via registry
    echo   - Uninstaller generated on first run
    echo   - Data stored in: %%LOCALAPPDATA%%\TimeTracker
    echo.
    echo Users simply:
    echo   1. Double-click TimeTracker.exe
    echo   2. Login with Atlassian
    echo   3. Done!
    echo.
) else (
    echo.
    echo [ERROR] Build completed but executable not found
    pause
    exit /b 1
)

echo Build complete! Press any key to exit...
pause >nul
