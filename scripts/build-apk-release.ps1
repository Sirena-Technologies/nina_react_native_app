# Build standalone release APK with bundled JavaScript (no Metro required)

Write-Host "Building standalone Release APK (with bundled JS)..." -ForegroundColor Cyan
Write-Host "This APK will work without Metro bundler!" -ForegroundColor Green
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
    $javaVersion = & $javaPath -version 2>&1 | Select-Object -First 1
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
Write-Host "Building Release APK with bundled JavaScript..." -ForegroundColor Cyan
Write-Host "  This will create a standalone APK that doesn't need Metro" -ForegroundColor Gray
Write-Host "  Building only for arm64-v8a to save disk space" -ForegroundColor Gray
Write-Host ""

# Build release APK with bundled JS
# The bundle will be automatically included in release builds
Write-Host "Running: ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a" -ForegroundColor Gray
Write-Host ""

& .\gradlew.bat assembleRelease -PreactNativeArchitectures=arm64-v8a

$buildExitCode = $LASTEXITCODE

Pop-Location

if ($buildExitCode -eq 0) {
    Write-Host ""
    Write-Host "Build complete!" -ForegroundColor Green
    Write-Host ""
    
    $apkPath = "android\app\build\outputs\apk\release\app-release-unsigned.apk"
    if (Test-Path $apkPath) {
        $apkInfo = Get-Item $apkPath
        Write-Host "APK Location:" -ForegroundColor Cyan
        Write-Host "  $apkPath" -ForegroundColor White
        Write-Host ""
        Write-Host "APK Size: $([math]::Round($apkInfo.Length / 1MB, 2)) MB" -ForegroundColor Green
        Write-Host "Architecture: arm64-v8a (64-bit ARM)" -ForegroundColor Green
        Write-Host ""
        Write-Host "[OK] This APK includes the JavaScript bundle" -ForegroundColor Green
        Write-Host "[OK] No Metro bundler required!" -ForegroundColor Green
        Write-Host "[OK] Can be installed and run standalone" -ForegroundColor Green
        Write-Host ""
        Write-Host "Note: This is an unsigned APK. To install on a device:" -ForegroundColor Yellow
        Write-Host "  1. Enable 'Install from Unknown Sources' on your device" -ForegroundColor Gray
        Write-Host "  2. Transfer APK to device and install" -ForegroundColor Gray
        Write-Host ""
        Write-Host "To sign the APK for production, see BUILD_APK.md" -ForegroundColor Cyan
    } else {
        Write-Host "Warning: APK file not found at expected location" -ForegroundColor Yellow
    }
} else {
    Write-Host ""
    Write-Host "Build failed with exit code: $buildExitCode" -ForegroundColor Red
    Write-Host "  Check the error messages above for details." -ForegroundColor Yellow
    exit $buildExitCode
}
