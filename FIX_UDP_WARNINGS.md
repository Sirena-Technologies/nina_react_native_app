# Fixing UDP Native Module Warnings

## The Problem

You're seeing warnings: `UDP native module not initialized. Use manual IP entry or run "npx expo prebuild"`

This happens because:
1. **You're using Expo Go** - Native modules don't work in Expo Go
2. **Or the app wasn't rebuilt** after running `npx expo prebuild`

## Solution: Build a Development Build

You **cannot** use Expo Go with native modules. You must build a development build.

### Step 1: Make sure prebuild was run

```powershell
npx expo prebuild --clean
```

### Step 2: Build and install the app on your device

**Option A: Using npm script (recommended)**
```powershell
# Set environment variables first
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME = "C:\Users\Lokesh.R.M\AppData\Local\Android\Sdk"

# Then build
npm run android
```

**Option B: Using Android Studio**
1. Open Android Studio
2. Open the `android` folder in your project
3. Wait for Gradle sync
4. Click "Run" button (green play icon)
5. Select your device/emulator

### Step 3: Verify

After the app is installed on your device:
- The UDP warnings should disappear
- Device discovery should work
- TCP connections should work

## Important Notes

### ❌ Don't Use Expo Go
- Expo Go doesn't support custom native modules
- You'll always get warnings if using Expo Go
- You must build a development build

### ✅ Use Development Build
- After `npx expo prebuild`, you have native code
- Build with `npm run android` or Android Studio
- Install the built APK on your device
- Then run `npm start` to connect Metro bundler

## Quick Fix Commands

```powershell
# 1. Set environment variables
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME = "C:\Users\Lokesh.R.M\AppData\Local\Android\Sdk"

# 2. Clean and rebuild
npx expo prebuild --clean

# 3. Build the app
npm run android

# 4. After app is installed, start Metro
npm start
```

## Troubleshooting

### Still getting warnings after building?

1. **Make sure you're running the built app, not Expo Go**
   - Uninstall Expo Go if installed
   - Make sure you're running the app you just built

2. **Check native modules are linked**
   ```powershell
   # Check if modules exist
   Test-Path "node_modules\react-native-udp"
   Test-Path "node_modules\react-native-tcp-socket"
   ```

3. **Clean and rebuild**
   ```powershell
   cd android
   .\gradlew clean
   cd ..
   npm run android
   ```

### Build fails?

- Make sure JAVA_HOME and ANDROID_HOME are set
- Check Android SDK is installed in Android Studio
- Verify `android/local.properties` exists with correct SDK path

## Alternative: Suppress Warnings (Not Recommended)

If you absolutely cannot build a development build right now, you can suppress the warnings, but UDP/TCP won't work:

The warnings are just informational - the app will still run, but:
- UDP device discovery won't work (use manual IP entry)
- TCP connections won't work

**This is not a real fix - you still need to build the app properly for full functionality.**
