# Build script for Android APK

Write-Host "Building Android APK..." -ForegroundColor Cyan
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
    Write-Host "  Please update JAVA_HOME in this script or set it in your environment" -ForegroundColor Yellow
    exit 1
}

# Verify Android SDK
Write-Host "Verifying Android SDK..." -ForegroundColor Cyan
if (Test-Path $env:ANDROID_HOME) {
    Write-Host "  Android SDK found" -ForegroundColor Green
} else {
    Write-Host "  ERROR: Android SDK not found at: $env:ANDROID_HOME" -ForegroundColor Red
    Write-Host "  Please update ANDROID_HOME in this script or set it in your environment" -ForegroundColor Yellow
    exit 1
}

# Check if android folder exists
Write-Host ""
Write-Host "Checking for native Android project..." -ForegroundColor Cyan
if (-not (Test-Path "android")) {
    Write-Host "  Android project not found. Running prebuild..." -ForegroundColor Yellow
    Write-Host ""
    
    Write-Host "Running: npx expo prebuild --clean" -ForegroundColor Gray
    & npx expo prebuild --clean
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "Prebuild failed!" -ForegroundColor Red
        exit $LASTEXITCODE
    }
    
    Write-Host ""
    Write-Host "Prebuild complete!" -ForegroundColor Green
} else {
    Write-Host "  Android project found" -ForegroundColor Green
}

# Navigate to android directory
Push-Location android

Write-Host ""
Write-Host "Building APK..." -ForegroundColor Cyan
Write-Host "  This will create a debug APK in android/app/build/outputs/apk/debug/" -ForegroundColor Gray
Write-Host ""

# Build debug APK
Write-Host "Running: ./gradlew assembleDebug" -ForegroundColor Gray
Write-Host ""

& .\gradlew.bat assembleDebug

$buildExitCode = $LASTEXITCODE

Pop-Location

if ($buildExitCode -eq 0) {
    Write-Host ""
    Write-Host "Build complete!" -ForegroundColor Green
    Write-Host ""
    
    $apkPath = "android\app\build\outputs\apk\debug\app-debug.apk"
    if (Test-Path $apkPath) {
        $apkInfo = Get-Item $apkPath
        Write-Host "APK Location:" -ForegroundColor Cyan
        Write-Host "  $apkPath" -ForegroundColor White
        Write-Host ""
        Write-Host "APK Size: $([math]::Round($apkInfo.Length / 1MB, 2)) MB" -ForegroundColor Green
        Write-Host ""
        Write-Host "To build a release APK (for distribution), run:" -ForegroundColor Cyan
        Write-Host "  cd android" -ForegroundColor Gray
        Write-Host "  .\gradlew.bat assembleRelease" -ForegroundColor Gray
        Write-Host "  cd .." -ForegroundColor Gray
        Write-Host ""
        Write-Host "Note: Release APK requires signing. See BUILD_APK.md for details." -ForegroundColor Yellow
    } else {
        Write-Host "Warning: APK file not found at expected location" -ForegroundColor Yellow
    }
} else {
    Write-Host ""
    Write-Host "Build failed with exit code: $buildExitCode" -ForegroundColor Red
    Write-Host "  Check the error messages above for details." -ForegroundColor Yellow
    exit $buildExitCode
}
