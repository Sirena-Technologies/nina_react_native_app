# PowerShell script to set up JAVA_HOME for Android development

Write-Host "🔍 Checking for Java installations..." -ForegroundColor Cyan

# Common Java/Android Studio installation paths
$javaPaths = @(
    "C:\Program Files\Android\Android Studio\jbr",
    "$env:LOCALAPPDATA\Android Studio\jbr",
    "C:\Program Files\JetBrains\Android Studio\jbr",
    "C:\Program Files\Eclipse Adoptium\jdk-17*",
    "C:\Program Files\Java\jdk-17*",
    "C:\Program Files\Java\jdk-11*",
    "C:\Program Files\OpenJDK\openjdk-17*"
)

$foundJava = $null

foreach ($pathPattern in $javaPaths) {
    $paths = Get-ChildItem -Path (Split-Path $pathPattern -Parent) -Filter (Split-Path $pathPattern -Leaf) -Directory -ErrorAction SilentlyContinue
    if ($paths) {
        $foundJava = $paths[0].FullName
        Write-Host "✅ Found Java at: $foundJava" -ForegroundColor Green
        break
    }
}

if (-not $foundJava) {
    Write-Host "❌ Java not found. Please install one of the following:" -ForegroundColor Red
    Write-Host ""
    Write-Host "Option 1: Install Android Studio (includes JDK)" -ForegroundColor Yellow
    Write-Host "  Download: https://developer.android.com/studio" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Option 2: Install JDK 17 directly" -ForegroundColor Yellow
    Write-Host "  Download: https://adoptium.net/temurin/releases/?version=17" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "After installation, run this script again." -ForegroundColor Yellow
    exit 1
}

# Set JAVA_HOME for current session
$env:JAVA_HOME = $foundJava
$env:PATH = "$foundJava\bin;$env:PATH"

Write-Host ""
Write-Host "📝 Setting JAVA_HOME for current session..." -ForegroundColor Cyan
Write-Host "   JAVA_HOME = $env:JAVA_HOME" -ForegroundColor Green

# Verify Java works
Write-Host ""
Write-Host "🔍 Verifying Java installation..." -ForegroundColor Cyan
try {
    $javaVersion = & "$foundJava\bin\java.exe" -version 2>&1
    Write-Host $javaVersion -ForegroundColor Green
} catch {
    Write-Host "❌ Java verification failed" -ForegroundColor Red
    exit 1
}

# Ask if user wants to set permanently
Write-Host ""
$setPermanent = Read-Host "Do you want to set JAVA_HOME permanently? (Y/N)"
if ($setPermanent -eq 'Y' -or $setPermanent -eq 'y') {
    try {
        [System.Environment]::SetEnvironmentVariable('JAVA_HOME', $foundJava, 'User')
        Write-Host "✅ JAVA_HOME set permanently for user" -ForegroundColor Green
        Write-Host ""
        Write-Host "⚠️  You may need to restart your terminal for changes to take effect." -ForegroundColor Yellow
    } catch {
        Write-Host "❌ Failed to set JAVA_HOME permanently. You may need to run as Administrator." -ForegroundColor Red
        Write-Host "   You can set it manually in System Environment Variables." -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "✅ Setup complete! You can now run: npm run android" -ForegroundColor Green
