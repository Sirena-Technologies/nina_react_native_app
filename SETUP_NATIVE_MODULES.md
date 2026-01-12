# Setting Up Native Modules (UDP & TCP)

This guide will help you set up the native modules required for UDP device discovery and TCP communication.

## Quick Setup

Run the setup script:

```bash
npm run setup-native
```

Or manually:

```bash
npx expo prebuild --clean
npm run android
```

## Why Native Modules Are Needed

The app uses:
- `react-native-udp` - For UDP multicast device discovery
- `react-native-tcp-socket` - For TCP communication with robots

These packages require native code that must be compiled into your app. **They will NOT work with Expo Go.**

## Step-by-Step Setup

### 1. Install Dependencies (if not already done)

```bash
npm install
```

### 2. Generate Native Code

```bash
npx expo prebuild --clean
```

This command will:
- Generate `android/` and `ios/` directories
- Link native modules automatically
- Set up all required permissions

### 3. Build and Run

#### For Android:

```bash
npm run android
```

**Requirements:**
- Android Studio installed
- Android SDK configured
- An Android device connected or emulator running

#### For iOS:

```bash
npm run ios
```

**Requirements:**
- Xcode installed (macOS only)
- CocoaPods installed (`sudo gem install cocoapods`)
- Run `cd ios && pod install` after prebuild

### 4. Verify Setup

After building, the app should:
- ✅ Discover devices via UDP multicast (no errors in console)
- ✅ Connect to robots via TCP (no "Cannot read property 'connect' of null" errors)
- ✅ Show discovered devices in the device list

## Troubleshooting

### Error: "Cannot read property 'createSocket' of null"

**Solution:** Native modules are not linked. Run:
```bash
npx expo prebuild --clean
npm run android
```

### Error: "Module not found" or build errors

**Solution:** 
1. Clean and rebuild:
   ```bash
   npx expo prebuild --clean
   cd android && ./gradlew clean && cd ..
   npm run android
   ```

2. For iOS:
   ```bash
   cd ios && pod install && cd ..
   npm run ios
   ```

### Devices not discovered

**Possible causes:**
1. **Native module not linked** - Run `npx expo prebuild`
2. **Network permissions** - Check that INTERNET permission is in AndroidManifest.xml
3. **Firewall blocking** - Ensure UDP port 1800 is not blocked
4. **Not on same network** - Device and robot must be on same WiFi network

### Using Expo Go

**Important:** Native modules do NOT work with Expo Go. You must:
- Use a development build (`npx expo prebuild` + build)
- Or use EAS Build for a custom development client

## Android Permissions

The following permissions are automatically added to `AndroidManifest.xml`:
- `INTERNET` - For network communication
- `ACCESS_NETWORK_STATE` - To check network availability
- `CHANGE_WIFI_MULTICAST_STATE` - For UDP multicast

These are configured in `app.json` and will be added during `expo prebuild`.

## Alternative: Manual IP Entry

If native modules aren't set up, you can still use the app by:
1. Clicking "Enter IP Manually" on the device list screen
2. Entering the robot's IP address directly
3. This bypasses UDP discovery but still requires TCP (which also needs native modules)

## Need Help?

- Check the console for specific error messages
- Ensure you're not using Expo Go
- Verify native code was generated (`android/` and `ios/` folders exist)
- Rebuild the app after making changes
