# Build (if needed), install, and launch the prebuilt app on a connected device.
# No Expo Go, no Metro - standalone prebuilt app only.

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path $PSScriptRoot -Parent
Set-Location $projectRoot

Write-Host "Prebuilt app - build, install, run (no Expo Go, no Metro)" -ForegroundColor Cyan
Write-Host ""

# Environment for adb
$env:ANDROID_HOME = "C:\Users\Lokesh.R.M\AppData\Local\Android\Sdk"
if ($env:ANDROID_HOME) {
    $adbPath = "$env:ANDROID_HOME\platform-tools\adb.exe"
} else {
    $adbPath = "adb.exe"
}
if (-not (Test-Path $adbPath)) {
    $adbPath = "adb.exe"
}

$apkPath = "android\app\build\outputs\apk\release\app-release-unsigned.apk"
$package = "com.anonymous.nina"
$activity = "com.anonymous.nina.MainActivity"

# Build release APK if it does not exist
if (-not (Test-Path $apkPath)) {
    Write-Host "Release APK not found. Building standalone release APK..." -ForegroundColor Yellow
    Write-Host ""
    & "$projectRoot\scripts\build-apk-release.ps1"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Build failed. Cannot install or run." -ForegroundColor Red
        exit $LASTEXITCODE
    }
    Write-Host ""
}

# Check device
$devices = & $adbPath devices 2>&1 | Select-String 'device$'
if (-not $devices) {
    Write-Host "[!] No Android device/emulator found." -ForegroundColor Red
    Write-Host "    Connect a device via USB or start an emulator, then run again." -ForegroundColor Gray
    exit 1
}

# Install
Write-Host "Installing prebuilt app on device..." -ForegroundColor Cyan
& $adbPath install -r $apkPath
if ($LASTEXITCODE -ne 0) {
    Write-Host "Install failed." -ForegroundColor Red
    exit $LASTEXITCODE
}

# Launch
Write-Host "Launching app..." -ForegroundColor Cyan
& $adbPath shell am start -n "${package}/${activity}"

Write-Host ""
Write-Host "[OK] Prebuilt app is running (no Expo Go, no Metro)" -ForegroundColor Green
Write-Host ""
