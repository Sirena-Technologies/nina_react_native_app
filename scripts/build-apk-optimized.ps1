# Optimized APK build script (arm64-v8a only to save disk space)

Write-Host "Building Android APK (arm64-v8a only - optimized for disk space)..." -ForegroundColor Cyan
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

# Clean build first to free space
Write-Host ""
Write-Host "Cleaning previous build to free disk space..." -ForegroundColor Yellow
Push-Location android
& .\gradlew.bat clean
Pop-Location

# Navigate to android directory
Push-Location android

Write-Host ""
Write-Host "Building APK (arm64-v8a only)..." -ForegroundColor Cyan
Write-Host "  This will create a debug APK in android/app/build/outputs/apk/debug/" -ForegroundColor Gray
Write-Host "  Building only for arm64-v8a to save disk space" -ForegroundColor Gray
Write-Host ""

# Build debug APK with only arm64-v8a architecture
Write-Host "Running: ./gradlew assembleDebug -PreactNativeArchitectures=arm64-v8a" -ForegroundColor Gray
Write-Host ""

& .\gradlew.bat assembleDebug -PreactNativeArchitectures=arm64-v8a

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
        Write-Host "Architecture: arm64-v8a (64-bit ARM)" -ForegroundColor Green
        Write-Host ""
        Write-Host "Note: This APK only supports arm64-v8a devices (most modern Android devices)." -ForegroundColor Yellow
        Write-Host "To build for all architectures, edit android/gradle.properties and run build-apk.ps1" -ForegroundColor Gray
    } else {
        Write-Host "Warning: APK file not found at expected location" -ForegroundColor Yellow
    }
} else {
    Write-Host ""
    Write-Host "Build failed with exit code: $buildExitCode" -ForegroundColor Red
    Write-Host "  Check the error messages above for details." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "If you're still getting 'not enough space' errors:" -ForegroundColor Yellow
    Write-Host "  1. Run: powershell -ExecutionPolicy Bypass -File ./scripts/clean-build.ps1" -ForegroundColor Gray
    Write-Host "  2. Free up disk space on D: drive" -ForegroundColor Gray
    Write-Host "  3. Consider moving project to C: drive if it has more space" -ForegroundColor Gray
    exit $buildExitCode
}
