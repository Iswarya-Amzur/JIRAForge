@echo off
REM Time Tracker Launcher (Windows Batch Script)
REM Double-click this file to start the app with automatic dependency management

echo.
echo ========================================
echo   Time Tracker Launcher
echo ========================================
echo.

REM Check and install dependencies
echo [1/2] Checking OCR dependencies...
python -m ocr.auto_installer
if %ERRORLEVEL% NEQ 0 (
    echo [WARN] Dependency check had issues, continuing anyway...
)

echo.
echo [2/2] Starting Time Tracker...
echo.

REM Start the app
python desktop_app.py

REM Keep window open if there's an error
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Application exited with error code %ERRORLEVEL%
    pause
)
