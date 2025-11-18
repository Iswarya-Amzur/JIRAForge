# PowerShell script to register the custom protocol handler on Windows
# Run this as Administrator: Right-click PowerShell -> Run as Administrator

$protocol = "brd-time-tracker"
$scriptRoot = $PSScriptRoot

# Find Electron executable
$electronCmd = Join-Path $scriptRoot "node_modules\.bin\electron.cmd"
$electronExe = Join-Path $scriptRoot "node_modules\electron\dist\electron.exe"

$fullElectronPath = $null

if (Test-Path $electronCmd) {
    $fullElectronPath = Resolve-Path $electronCmd
} elseif (Test-Path $electronExe) {
    $fullElectronPath = Resolve-Path $electronExe
}

if (-not $fullElectronPath) {
    Write-Host "ERROR: Could not find Electron executable." -ForegroundColor Red
    Write-Host "Make sure you've run 'npm install' first." -ForegroundColor Yellow
    Write-Host "Looking for:" -ForegroundColor Yellow
    Write-Host "  - $electronCmd" -ForegroundColor Yellow
    Write-Host "  - $electronExe" -ForegroundColor Yellow
    exit 1
}

Write-Host "Registering protocol handler: $protocol" -ForegroundColor Green
Write-Host "Electron path: $fullElectronPath" -ForegroundColor Yellow
Write-Host "App directory: $scriptRoot" -ForegroundColor Yellow

# Register the protocol in Windows Registry
$regPath = "HKCU:\Software\Classes\$protocol"
New-Item -Path $regPath -Force | Out-Null
Set-ItemProperty -Path $regPath -Name "(Default)" -Value "URL:BRD Time Tracker OAuth"
Set-ItemProperty -Path $regPath -Name "URL Protocol" -Value ""

$shellPath = "$regPath\shell"
New-Item -Path $shellPath -Force | Out-Null

$openPath = "$shellPath\open"
New-Item -Path $openPath -Force | Out-Null

$commandPath = "$openPath\command"
New-Item -Path $commandPath -Force | Out-Null

# Build the command
# For development, we need to run: electron . <protocol-url>
# The . means run from current directory (where package.json is)
if ($fullElectronPath -like "*.cmd") {
    # For .cmd files, use cmd /c
    $command = "cmd /c `"$fullElectronPath`" `"$scriptRoot`" `"%1`""
} else {
    # For .exe files, pass the directory and protocol URL
    $command = "`"$fullElectronPath`" `"$scriptRoot`" `"%1`""
}

Set-ItemProperty -Path $commandPath -Name "(Default)" -Value $command

Write-Host "" -ForegroundColor Green
Write-Host "Protocol handler registered successfully!" -ForegroundColor Green
Write-Host "" -ForegroundColor Green
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Make sure your app is running: npm start" -ForegroundColor White
Write-Host "2. Try the OAuth flow again" -ForegroundColor White
Write-Host "3. Test the protocol: ${protocol}://oauth/callback?test=1" -ForegroundColor White

