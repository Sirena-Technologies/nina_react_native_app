# Building APK for Nina App

This guide explains how to build an APK file for the Nina React Native app.

## Quick Start

### Option 1: Using the Build Script (Recommended)

```powershell
npm run build:apk
```

Or directly:

```powershell
powershell -ExecutionPolicy Bypass -File ./scripts/build-apk.ps1
```

### Option 2: Manual Build

1. **Generate native Android project** (if not already done):
   ```bash
   npx expo prebuild --clean
   ```

2. **Build the APK**:
   ```bash
   cd android
   .\gradlew.bat assembleDebug
   cd ..
   ```

3. **Find your APK**:
   - Location: `android/app/build/outputs/apk/debug/app-debug.apk`
   - This is a **debug APK** suitable for testing

## Prerequisites

Before building, ensure you have:

1. **Java JDK** (JDK 17 or 21 recommended)
   - Usually comes with Android Studio
   - Default location: `C:\Program Files\Android\Android Studio\jbr`
   - Verify: `java -version`

2. **Android SDK**
   - Installed via Android Studio
   - Default location: `C:\Users\<YourUsername>\AppData\Local\Android\Sdk`
   - Verify: Check Android Studio → Settings → Android SDK

3. **Environment Variables** (optional, but recommended)
   - `JAVA_HOME` - Path to JDK
   - `ANDROID_HOME` - Path to Android SDK
   - The build script sets these automatically, but you can set them permanently

## Build Types

### Debug APK

**Purpose:** For testing and development

**Build Command:**
```bash
cd android
.\gradlew.bat assembleDebug
```

**Output:** `android/app/build/outputs/apk/debug/app-debug.apk`

**Features:**
- Includes debugging symbols
- Can be installed on any device
- Larger file size
- Not optimized

### Release APK

**Purpose:** For distribution to users

**Build Command:**
```bash
cd android
.\gradlew.bat assembleRelease
```

**Output:** `android/app/build/outputs/apk/release/app-release-unsigned.apk`

**Important:** Release APKs require signing before installation. See [Signing APK](#signing-apk) below.

## Signing APK (For Release Builds)

Release APKs must be signed before they can be installed on devices.

### Option 1: Generate a Keystore (First Time)

1. **Create a keystore file:**
   ```bash
   keytool -genkeypair -v -storetype PKCS12 -keystore nina-release-key.keystore -alias nina-key-alias -keyalg RSA -keysize 2048 -validity 10000
   ```

2. **Follow the prompts** to set:
   - Password (remember this!)
   - Your name, organization, etc.

3. **Store the keystore safely** - you'll need it for all future releases!

### Option 2: Configure Signing in Gradle

1. **Create `android/keystore.properties`** (add to `.gitignore`):
   ```properties
   storePassword=your-keystore-password
   keyPassword=your-key-password
   keyAlias=nina-key-alias
   storeFile=../nina-release-key.keystore
   ```

2. **Update `android/app/build.gradle`** to include signing config:
   ```gradle
   android {
       ...
       signingConfigs {
           release {
               if (project.hasProperty('MYAPP_RELEASE_STORE_FILE')) {
                   storeFile file(MYAPP_RELEASE_STORE_FILE)
                   storePassword MYAPP_RELEASE_STORE_PASSWORD
                   keyAlias MYAPP_RELEASE_KEY_ALIAS
                   keyPassword MYAPP_RELEASE_KEY_PASSWORD
               }
           }
       }
       buildTypes {
           release {
               signingConfig signingConfigs.release
               ...
           }
       }
   }
   ```

3. **Build signed release APK:**
   ```bash
   cd android
   .\gradlew.bat assembleRelease
   ```

**Output:** `android/app/build/outputs/apk/release/app-release.apk` (signed and ready to install)

## Using EAS Build (Alternative)

Expo Application Services (EAS) can build APKs in the cloud:

1. **Install EAS CLI:**
   ```bash
   npm install -g eas-cli
   ```

2. **Login:**
   ```bash
   eas login
   ```

3. **Configure:**
   ```bash
   eas build:configure
   ```

4. **Build APK:**
   ```bash
   eas build --platform android --profile preview
   ```

This creates a signed APK without needing local Android SDK setup.

## Troubleshooting

### Error: "SDK location not found"

**Solution:** Create `android/local.properties`:
```properties
sdk.dir=C:/Users/<YourUsername>/AppData/Local/Android/Sdk
```

Or update the build script with your SDK path.

### Error: "JAVA_HOME not set"

**Solution:** Set JAVA_HOME in the build script or your environment:
```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
```

### Error: "Gradle build failed"

**Common causes:**
- Missing Android SDK components (install via Android Studio)
- Java version mismatch (use JDK 17 or 21)
- Network issues downloading dependencies

**Solution:**
1. Open Android Studio
2. Go to SDK Manager
3. Install: Android SDK Platform-Tools, Build-Tools, and at least one API level (24+)

### APK is too large

**Debug APKs are large by default.** For smaller APKs:
- Build release APK (smaller, optimized)
- Use `--variant=release` with `expo run:android`
- Consider using App Bundle (AAB) for Play Store distribution

### "App not installed" error on device

**Possible causes:**
- Installing unsigned release APK (use debug APK or sign release APK)
- Device doesn't allow unknown sources (enable in Settings)
- Previous version conflict (uninstall old version first)

## Installing the APK

### On Android Device

1. **Enable "Install from Unknown Sources"** in device settings
2. **Transfer APK** to device (USB, email, cloud storage)
3. **Open APK file** on device and tap "Install"

### Via ADB

```bash
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

## File Locations

- **Debug APK:** `android/app/build/outputs/apk/debug/app-debug.apk`
- **Release APK (unsigned):** `android/app/build/outputs/apk/release/app-release-unsigned.apk`
- **Release APK (signed):** `android/app/build/outputs/apk/release/app-release.apk`

## Next Steps

After building your APK:
1. Test on a real device
2. Share with testers
3. For production: Build signed release APK
4. For Play Store: Consider building AAB (Android App Bundle) instead of APK

## Additional Resources

- [Expo Build Documentation](https://docs.expo.dev/build/introduction/)
- [Android App Signing](https://developer.android.com/studio/publish/app-signing)
- [Gradle Build Documentation](https://developer.android.com/studio/build)
