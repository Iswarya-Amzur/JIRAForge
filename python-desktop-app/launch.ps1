# Time Tracker Launcher (PowerShell Script)
# 
# Usage:
#   .\launch.ps1                  # Check deps and start app
#   .\launch.ps1 -SkipDeps        # Skip dependency check
#   .\launch.ps1 -DepsOnly        # Only check deps, don't start app
#   .\launch.ps1 -Silent          # Silent mode

param(
    [switch]$SkipDeps = $false,
    [switch]$DepsOnly = $false,
    [switch]$Silent = $false
)

Write-Host ""
Write-Host "========================================"
Write-Host "  Time Tracker Launcher"
Write-Host "========================================"
Write-Host ""

# Check and install dependencies
if (-not $SkipDeps) {
    Write-Host "[1/2] Checking OCR dependencies..." -ForegroundColor Cyan
    
    $cmd = "python -m ocr.auto_installer"
    if ($Silent) {
        $cmd += " --silent"
    }
    
    $output = Invoke-Expression $cmd
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[WARN] Dependency check had issues, continuing anyway..." -ForegroundColor Yellow
    }
    
    Write-Host ""
}

# Exit if only checking dependencies
if ($DepsOnly) {
    Write-Host "[INFO] Dependency check complete. Exiting." -ForegroundColor Green
    exit 0
}

# Start the application
Write-Host "[2/2] Starting Time Tracker..." -ForegroundColor Cyan
Write-Host ""

python desktop_app.py

# Check exit code
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "[ERROR] Application exited with error code $LASTEXITCODE" -ForegroundColor Red
    Write-Host "Press any key to exit..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}
