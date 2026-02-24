@echo off
REM Quick Start Script for Running Productivity Tracking System Tests (Windows)
REM 
REM This script provides an easy way to run the test suite on Windows

echo ==========================================
echo Productivity Tracking System - Test Runner
echo ==========================================
echo.

REM Check if Python is available
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo X Python not found. Please install Python 3.7+ first.
    pause
    exit /b 1
)

python --version
echo.

REM Install required dependencies
echo Installing/checking dependencies...
pip install -q pillow psutil requests python-dotenv supabase 2>nul

echo.
echo Available test categories:
echo   1) All tests (default)
echo   2) Classification tests only
echo   3) OCR tests only
echo   4) Session management tests only
echo   5) Batch analysis tests only
echo   6) Integration tests only
echo.

REM Read user choice
set /p choice="Select option (1-6): "

echo.
echo ==========================================
echo.

if "%choice%"=="2" (
    echo Running Classification Tests...
    python test_productivity_tracking_system.py --classification
) else if "%choice%"=="3" (
    echo Running OCR Tests...
    python test_productivity_tracking_system.py --ocr
) else if "%choice%"=="4" (
    echo Running Session Management Tests...
    python test_productivity_tracking_system.py --session
) else if "%choice%"=="5" (
    echo Running Batch Analysis Tests...
    python test_productivity_tracking_system.py --batch
) else if "%choice%"=="6" (
    echo Running Integration Tests...
    python test_productivity_tracking_system.py --integration
) else (
    echo Running All Tests...
    python test_productivity_tracking_system.py
)

echo.
echo ==========================================
echo Test run complete!
echo ==========================================
pause
