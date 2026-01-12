# Setting Up Java for Android Development

## Quick Fix

You need to install Java Development Kit (JDK) to build Android apps. Here are the options:

## Option 1: Install JDK 17 (Recommended)

### Using Chocolatey (if installed):
```powershell
choco install openjdk17
```

### Manual Installation:
1. Download JDK 17 from: https://adoptium.net/temurin/releases/?version=17
2. Install it (default location: `C:\Program Files\Eclipse Adoptium\`)
3. Set environment variables (see below)

## Option 2: Install Android Studio (Includes JDK)

Android Studio comes with JDK bundled:
1. Download from: https://developer.android.com/studio
2. Install Android Studio
3. During installation, it will set up JDK automatically
4. JDK location: Usually at `C:\Program Files\Android\Android Studio\jbr`

## Setting JAVA_HOME Environment Variable

After installing Java, set the JAVA_HOME environment variable:

### PowerShell (Temporary - Current Session Only):
```powershell
# Find Java installation
$javaPath = (Get-Command java -ErrorAction SilentlyContinue).Source
# Or if Android Studio installed it:
$javaPath = "C:\Program Files\Android\Android Studio\jbr"

# Set JAVA_HOME
$env:JAVA_HOME = $javaPath
$env:PATH = "$javaPath\bin;$env:PATH"
```

### Permanent Setup (Windows):

1. **Find Java Installation Path:**
   - If using Android Studio: `C:\Program Files\Android\Android Studio\jbr`
   - If using Adoptium: `C:\Program Files\Eclipse Adoptium\jdk-17.x.x-hotspot`

2. **Set Environment Variable:**
   - Press `Win + X` and select "System"
   - Click "Advanced system settings"
   - Click "Environment Variables"
   - Under "System variables", click "New"
   - Variable name: `JAVA_HOME`
   - Variable value: Path to your JDK (e.g., `C:\Program Files\Eclipse Adoptium\jdk-17.0.9+9-hotspot`)
   - Click OK

3. **Update PATH:**
   - Find "Path" in System variables
   - Click "Edit"
   - Add: `%JAVA_HOME%\bin`
   - Click OK on all dialogs

4. **Restart Terminal/PowerShell** for changes to take effect

### Verify Installation:

```powershell
java -version
echo $env:JAVA_HOME
```

You should see Java version information.

## Quick Setup Script

Run this in PowerShell (as Administrator if needed):

```powershell
# Check if Android Studio JDK exists
$androidStudioJdk = "C:\Program Files\Android\Android Studio\jbr"
if (Test-Path $androidStudioJdk) {
    [System.Environment]::SetEnvironmentVariable('JAVA_HOME', $androidStudioJdk, 'Machine')
    $env:JAVA_HOME = $androidStudioJdk
    Write-Host "JAVA_HOME set to Android Studio JDK"
} else {
    Write-Host "Android Studio JDK not found. Please install JDK 17 manually."
}
```

## After Setting JAVA_HOME

1. **Close and reopen your terminal**
2. **Verify:**
   ```powershell
   java -version
   echo $env:JAVA_HOME
   ```
3. **Try building again:**
   ```powershell
   npm run android
   ```

## Alternative: Use Android Studio to Build

If you prefer, you can:
1. Open Android Studio
2. Open the `android` folder in your project
3. Let it sync Gradle
4. Click "Run" button in Android Studio

This will build and install the app on your device/emulator.
