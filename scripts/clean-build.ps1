# Clean build script to free up disk space

Write-Host "Cleaning build directories to free up disk space..." -ForegroundColor Cyan
Write-Host ""

# Navigate to project root
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

# Clean Android build directories
Write-Host "Cleaning Android build directories..." -ForegroundColor Yellow
if (Test-Path "android\app\build") {
    Remove-Item -Recurse -Force "android\app\build" -ErrorAction SilentlyContinue
    Write-Host "  ✓ Cleaned android/app/build" -ForegroundColor Green
}
if (Test-Path "android\build") {
    Remove-Item -Recurse -Force "android\build" -ErrorAction SilentlyContinue
    Write-Host "  ✓ Cleaned android/build" -ForegroundColor Green
}

# Clean Gradle cache (optional - uncomment if needed)
# Write-Host ""
# Write-Host "Cleaning Gradle cache..." -ForegroundColor Yellow
# $gradleCache = "$env:USERPROFILE\.gradle\caches"
# if (Test-Path $gradleCache) {
#     Get-ChildItem $gradleCache -Directory | Where-Object { $_.Name -match "transforms|modules" } | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
#     Write-Host "  ✓ Cleaned Gradle cache" -ForegroundColor Green
# }

# Clean node_modules/.cache if exists
Write-Host ""
Write-Host "Cleaning node_modules cache..." -ForegroundColor Yellow
if (Test-Path "node_modules\.cache") {
    Remove-Item -Recurse -Force "node_modules\.cache" -ErrorAction SilentlyContinue
    Write-Host "  ✓ Cleaned node_modules/.cache" -ForegroundColor Green
}

# Run Gradle clean
Write-Host ""
Write-Host "Running Gradle clean..." -ForegroundColor Yellow
Push-Location android
& .\gradlew.bat clean
Pop-Location

Write-Host ""
Write-Host "Cleanup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Disk space freed. You can now try building again." -ForegroundColor Cyan
