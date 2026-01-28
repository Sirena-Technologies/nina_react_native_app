# Build script for Android with proper environment setup

Write-Host "Building Android app with native modules..." -ForegroundColor Cyan
Write-Host ""

# Set environment variables
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME = "C:\Users\Lokesh.R.M\AppData\Local\Android\Sdk"
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME

# Add to PATH
$env:PATH = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\tools;$env:PATH"

Write-Host "Environment variables set:" -ForegroundColor Green
Write-Host "  JAVA_HOME: $env:JAVA_HOME" -ForegroundColor Gray
Write-Host "  ANDROID_HOME: $env:ANDROID_HOME" -ForegroundColor Gray
Write-Host ""

# Verify Java
Write-Host "Verifying Java..." -ForegroundColor Cyan
$javaPath = "$env:JAVA_HOME\bin\java.exe"
if (Test-Path $javaPath) {
    $javaVersion = (cmd /c "`"$javaPath`" -version 2>&1") | Select-Object -First 1
    Write-Host "  $javaVersion" -ForegroundColor Green
} else {
    Write-Host "  ERROR: Java not found!" -ForegroundColor Red
    exit 1
}

# Verify Android SDK
Write-Host "Verifying Android SDK..." -ForegroundColor Cyan
if (Test-Path $env:ANDROID_HOME) {
    Write-Host "  Android SDK found" -ForegroundColor Green
} else {
    Write-Host "  ERROR: Android SDK not found at: $env:ANDROID_HOME" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Building app..." -ForegroundColor Cyan
Write-Host "  This will install the app on your connected device/emulator" -ForegroundColor Gray
Write-Host "  Make sure a device is connected or emulator is running!" -ForegroundColor Yellow
Write-Host ""

# Build the app
Write-Host "Running: npx expo run:android" -ForegroundColor Gray
Write-Host ""

& npx expo run:android

$buildExitCode = $LASTEXITCODE

if ($buildExitCode -eq 0) {
    Write-Host ""
    Write-Host "Build complete!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "  1. The app should be installed on your device" -ForegroundColor White
    Write-Host "  2. Run 'npm start' to start Metro bundler" -ForegroundColor White
    Write-Host "  3. Open the app on your device" -ForegroundColor White
    Write-Host ""
    Write-Host "WARNING: Make sure you're running the built app, NOT Expo Go!" -ForegroundColor Yellow
} else {
    Write-Host ""
    Write-Host "Build failed with exit code: $buildExitCode" -ForegroundColor Red
    Write-Host "  Check the error messages above for details." -ForegroundColor Yellow
    exit $buildExitCode
}
