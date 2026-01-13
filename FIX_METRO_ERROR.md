# Fixing "Unable to load script" Metro Error

## The Problem

You're seeing this error:
```
Unable to load script.
Make sure you're running Metro or that your bundle 'index.android.bundle' is packaged correctly for release.
```

This happens because:
1. **Debug APK requires Metro** - Debug builds expect Metro bundler to be running
2. **Metro is not running** - The bundler needs to be started separately
3. **Device can't connect to Metro** - Network/ADB configuration issue

## Solution Options

### Option 1: Start Metro Bundler (For Debug APK) ⚡ Quick Fix

If you installed a **debug APK**, you need Metro running:

```powershell
# Start Metro with ADB reverse setup
npm run start:metro
```

Or manually:
```powershell
# 1. Set up ADB reverse (for USB-connected devices)
adb reverse tcp:8081 tcp:8081

# 2. Start Metro
npm start
```

**For WiFi-connected devices:**
- Make sure device and computer are on the same WiFi network
- The app will automatically detect your computer's IP address
- Or manually set it in the app's developer menu

### Option 2: Build Standalone Release APK (No Metro Required) 🎯 Recommended

Build a **release APK** that includes the JavaScript bundle - no Metro needed!

```powershell
# Build standalone release APK
npm run build:apk:release
```

This creates an APK at:
```
android/app/build/outputs/apk/release/app-release-unsigned.apk
```

**Advantages:**
- ✅ No Metro bundler required
- ✅ Works completely standalone
- ✅ Smaller file size (optimized)
- ✅ Ready for distribution

**To install:**
1. Enable "Install from Unknown Sources" on your device
2. Transfer APK to device (USB, email, cloud storage)
3. Open and install

## Step-by-Step Solutions

### Solution A: Use Debug APK with Metro

1. **Start Metro bundler:**
   ```powershell
   npm run start:metro
   ```
   This script will:
   - Check for connected devices
   - Set up ADB reverse automatically
   - Start Metro bundler

2. **Open the app on your device**
   - The app should connect to Metro automatically
   - If using USB: connects via `localhost:8081` (ADB reverse)
   - If using WiFi: connects via `<your-ip>:8081`

3. **If connection fails:**
   - **USB device**: Run `adb reverse tcp:8081 tcp:8081`
   - **WiFi device**: Ensure same network, check firewall
   - **Shake device** → Dev Menu → Settings → Change Bundle Location

### Solution B: Build Standalone Release APK

1. **Build release APK:**
   ```powershell
   npm run build:apk:release
   ```

2. **Install APK on device:**
   ```powershell
   # Via ADB
   adb install android/app/build/outputs/apk/release/app-release-unsigned.apk
   
   # Or manually transfer and install
   ```

3. **Run the app** - No Metro needed!

## Troubleshooting

### "Device must be USB connected or on same WiFi"

**For USB:**
```powershell
adb reverse tcp:8081 tcp:8081
```

**For WiFi:**
- Check both devices are on same network
- Check firewall isn't blocking port 8081
- Find your computer's IP: `ipconfig` (Windows) or `ifconfig` (Mac/Linux)
- In app Dev Menu → Settings → Change Bundle Location → Enter: `http://<your-ip>:8081`

### "Metro bundler not starting"

1. Check if port 8081 is in use:
   ```powershell
   netstat -ano | findstr :8081
   ```
2. Kill process if needed, then restart Metro
3. Try different port: `npx expo start --port 8082`

### "ADB reverse not working"

1. Check device is connected:
   ```powershell
   adb devices
   ```
2. Restart ADB server:
   ```powershell
   adb kill-server
   adb start-server
   ```
3. Try again: `adb reverse tcp:8081 tcp:8081`

### "Still can't connect after all steps"

**Build standalone release APK instead:**
```powershell
npm run build:apk:release
```

This eliminates Metro dependency entirely.

## Quick Reference

| Scenario | Command | Metro Required? |
|----------|---------|----------------|
| Debug APK (development) | `npm run start:metro` | ✅ Yes |
| Release APK (standalone) | `npm run build:apk:release` | ❌ No |
| Clean build | `npm run clean:build` | N/A |

## Recommended Workflow

**For Development:**
1. Build debug APK: `npm run build:apk:optimized`
2. Install on device
3. Start Metro: `npm run start:metro`
4. Open app - connects to Metro automatically

**For Testing/Distribution:**
1. Build release APK: `npm run build:apk:release`
2. Install on device
3. Run app - works standalone, no Metro needed

## Additional Notes

- **Debug APKs** are larger and require Metro for hot reloading
- **Release APKs** are optimized, include JS bundle, and work standalone
- Metro is only needed during development
- For production, always use release builds
