# Quick script to set JAVA_HOME and ANDROID_HOME before building Android app

$androidStudioJdk = "C:\Program Files\Android\Android Studio\jbr"
$androidSdk = "$env:LOCALAPPDATA\Android\Sdk"

# Set JAVA_HOME
if (Test-Path $androidStudioJdk) {
    $env:JAVA_HOME = $androidStudioJdk
    $env:PATH = "$androidStudioJdk\bin;$env:PATH"
    Write-Host "✅ JAVA_HOME set to Android Studio JDK" -ForegroundColor Green
} else {
    Write-Host "⚠️  Android Studio JDK not found at: $androidStudioJdk" -ForegroundColor Yellow
    Write-Host "   Run: npm run setup-java" -ForegroundColor Yellow
}

# Set ANDROID_HOME
if (Test-Path $androidSdk) {
    $env:ANDROID_HOME = $androidSdk
    $env:ANDROID_SDK_ROOT = $androidSdk
    $env:PATH = "$androidSdk\platform-tools;$androidSdk\tools;$env:PATH"
    Write-Host "✅ ANDROID_HOME set to: $androidSdk" -ForegroundColor Green
} else {
    Write-Host "⚠️  Android SDK not found at: $androidSdk" -ForegroundColor Yellow
}
