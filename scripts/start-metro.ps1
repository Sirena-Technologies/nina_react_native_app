# Start Metro bundler and set up ADB reverse for USB-connected devices

Write-Host "Starting Metro Bundler..." -ForegroundColor Cyan
Write-Host ""

# Check if ADB is available
$adbPath = "$env:ANDROID_HOME\platform-tools\adb.exe"
if (-not (Test-Path $adbPath)) {
    $adbPath = "adb.exe"
}

# Check if device is connected
Write-Host "Checking for connected Android devices..." -ForegroundColor Yellow
$devices = & $adbPath devices 2>&1 | Select-String "device$"

if ($devices) {
    Write-Host "  ✓ Device(s) found:" -ForegroundColor Green
    $devices | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }
    Write-Host ""
    Write-Host "Setting up ADB reverse for USB connection..." -ForegroundColor Yellow
    & $adbPath reverse tcp:8081 tcp:8081
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ ADB reverse configured (localhost:8081 -> device:8081)" -ForegroundColor Green
    } else {
        Write-Host "  ⚠ ADB reverse failed (device may be connected via WiFi)" -ForegroundColor Yellow
    }
} else {
    Write-Host "  ⚠ No USB-connected devices found" -ForegroundColor Yellow
    Write-Host "  Make sure your device is connected via USB, or" -ForegroundColor Gray
    Write-Host "  ensure device and computer are on the same WiFi network" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Starting Metro Bundler..." -ForegroundColor Cyan
Write-Host "  The app will connect to Metro at:" -ForegroundColor Gray
Write-Host "    - USB: localhost:8081 (via ADB reverse)" -ForegroundColor Gray
Write-Host "    - WiFi: <your-computer-ip>:8081" -ForegroundColor Gray
Write-Host ""
Write-Host "Press Ctrl+C to stop Metro" -ForegroundColor Yellow
Write-Host ""

# Start Metro
& npx expo start
