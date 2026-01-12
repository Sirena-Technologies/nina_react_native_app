# Robot Remote Control App - React Native Implementation

This is a React Native implementation of the Android Java robot remote control application.

## Features

- **Device Discovery**: Scan for robots on the local network using UDP multicast
- **TCP Communication**: Connect to robots via TCP socket
- **Remote Control**: Control robot movement, tilt, and rotation
- **Video Streaming**: Receive and display video feed from the robot
- **Action Sequences**: Send pre-defined action sequences from files

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Native Module Setup

This app requires native modules that may need additional setup:

#### For Expo Managed Workflow:
Some packages (`react-native-tcp-socket`, `react-native-udp`) require native code and may not work with Expo Go. You'll need to:

1. Create a development build:
```bash
npx expo prebuild
```

2. Or use EAS Build:
```bash
eas build --profile development --platform android
```

#### For Bare React Native:
The packages should work after installation, but you may need to:

1. Link native modules (if using React Native < 0.60):
```bash
react-native link react-native-tcp-socket
react-native link react-native-udp
```

2. For Android, ensure permissions in `AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

### 3. Action Files

Place your action sequence files (e.g., `front.txt`, `back.txt`, etc.) in the `assets/` directory. These files should contain comma-separated byte values, one per line.

Example `front.txt`:
```
0,1,2,3,4
5,6,7,8,9
```

### 4. Running the App

```bash
# Start Expo
npm start

# Run on Android
npm run android

# Run on iOS
npm run ios
```

## Project Structure

```
├── app/
│   ├── splash.tsx          # Splash screen
│   ├── device-list.tsx     # Device discovery and selection
│   ├── remote.tsx          # Main remote control interface
│   └── first-time.tsx      # First-time user guide
├── utils/
│   ├── TcpClient.ts        # TCP socket client
│   ├── NetworkDiscovery.ts # UDP multicast device discovery
│   ├── RobotCom.ts         # Robot communication protocol
│   └── ActionFileReader.ts # Action sequence file reader
└── assets/                 # Action files and images
```

## Key Components

### TcpClient
Handles TCP socket communication with the robot. Supports:
- Sending text messages
- Sending byte arrays
- Reading messages
- Video streaming (placeholder)

### NetworkDiscovery
Discovers robots on the network using UDP multicast (SSDP-like protocol):
- Sends M-SEARCH requests
- Listens for device responses
- Returns list of discovered devices

### RobotCom
Implements the LUCI protocol for robot communication:
- Motor control
- LED control
- GPIO control
- Video connection requests

## Notes

1. **Video Streaming**: The video streaming implementation is a placeholder. You may need to implement actual video decoding based on your robot's video format.

2. **Action Files**: Action files must be bundled with the app or loaded from a server. The current implementation reads from `assets/` directory.

3. **Network Permissions**: Ensure your app has network permissions configured.

4. **Testing**: Test on a real device, as network features may not work in simulators/emulators.

## Troubleshooting

### Devices not discovered
- Ensure device and robot are on the same network
- Check firewall settings
- Verify UDP port 1800 is not blocked

### Connection fails
- Verify robot IP address
- Check TCP port 7777 is accessible
- Ensure robot is powered on and connected

### Action files not found
- Verify files are in `assets/` directory
- Check file names match exactly (case-sensitive)
- Ensure files are properly bundled

## License

Same as original project.
