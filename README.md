# Nina - Robot Remote Control App

A React Native application built with Expo for remotely controlling the Nino robot. The app provides device discovery, TCP communication, video streaming, and action sequence control.

**Written and Developed by Sirena R & D Team**

## Table of Contents

- [Overview](#overview)
- [Project Structure](#project-structure)
- [Application Flow](#application-flow)
- [How It Works](#how-it-works)
- [Key Components](#key-components)
- [Setup Instructions](#setup-instructions)
- [Features](#features)
- [Technical Details](#technical-details)

## Overview

Nina is a mobile application that allows users to:
- Discover robots on the local network using UDP multicast
- Connect to robots via TCP socket communication
- Control robot movements and actions using the LUCI protocol
- Receive and display live video feed from the robot
- Execute pre-defined action sequences

The app is built with **React Native** using **Expo Router** for file-based navigation and requires native modules for network communication.

## Project Structure

```
nina/
├── app/                          # Expo Router screens (file-based routing)
│   ├── _layout.tsx              # Root layout with navigation stack
│   ├── index.tsx                # Entry point (redirects to splash)
│   ├── splash.tsx               # Splash screen (2s delay → device-list)
│   ├── device-list.tsx          # Device discovery and selection screen
│   ├── remote.tsx               # Main remote control interface
│   ├── first-time.tsx           # First-time user guide (modal)
│   └── (tabs)/                  # Tab navigation (currently unused in main flow)
│       ├── _layout.tsx
│       ├── index.tsx
│       └── explore.tsx
│
├── utils/                        # Core business logic
│   ├── NetworkDiscovery.ts      # UDP multicast device discovery
│   ├── TcpClient.ts             # TCP socket client wrapper
│   ├── RobotCom.ts              # LUCI protocol implementation
│   ├── VideoStream.ts           # Video streaming handler
│   └── ActionFileReader.ts      # Action sequence file reader
│
├── components/                   # Reusable UI components
│   ├── ui/                      # UI components (icons, collapsible, etc.)
│   └── ...                      # Other shared components
│
├── assets/                       # Static assets
│   ├── actions/                 # Robot action sequence files
│   │   ├── front.txt            # Forward movement sequence
│   │   ├── back.txt             # Backward movement sequence
│   │   ├── t_left.txt           # Turn left sequence
│   │   ├── t_right.txt          # Turn right sequence
│   │   ├── tilt_*.txt           # Tilt movement sequences
│   │   ├── l_*.txt              # Lateral movement sequences
│   │   ├── stance.txt           # Neutral stance
│   │   ├── stand.txt            # Stand up sequence
│   │   └── sit.txt              # Sit down sequence
│   └── images/                  # App icons and images
│
├── hooks/                        # Custom React hooks
│   ├── use-color-scheme.ts      # Theme color scheme detection
│   └── use-theme-color.ts       # Theme color utilities
│
├── constants/                    # App constants
│   └── theme.ts                 # Theme configuration
│
├── scripts/                      # Build and setup scripts
│   ├── build-android.ps1        # Android build script
│   ├── setup-java.ps1           # Java environment setup
│   └── setup-native-modules.js  # Native module configuration
│
├── package.json                  # Dependencies and scripts
├── app.json                      # Expo configuration
└── tsconfig.json                 # TypeScript configuration
```

## Application Flow

### 1. **App Launch** (`app/index.tsx`)
   - Entry point redirects to `/splash`

### 2. **Splash Screen** (`app/splash.tsx`)
   - Displays app logo/icon
   - After 2 seconds, automatically navigates to `/device-list`

### 3. **Device Discovery** (`app/device-list.tsx`)
   - Scans local network for robots using UDP multicast (port 1800)
   - Displays discovered devices with IP, name, and MAC address
   - User can:
     - Tap a device to connect
     - Pull down to refresh/scan again
     - Enter IP address manually
   - On device selection, navigates to `/remote` with device IP and name as params

### 4. **Remote Control** (`app/remote.tsx`)
   - Establishes TCP connection to robot (port 7777)
   - Requests video stream connection
   - Displays live video feed (if available)
   - Provides action buttons for robot control:
     - Neutral, Point Right/Left, Hello, Relax, Namaste, Head Nod, Custom Action
   - Sends LUCI commands to robot via TCP
   - Disconnect button returns to device list

### 5. **First-Time Guide** (`app/first-time.tsx`)
   - Modal screen with welcome message and tips
   - Can be accessed from anywhere in the app (if implemented)

## How It Works

### Device Discovery Process

1. **UDP Multicast Discovery** (`NetworkDiscovery.ts`)
   - Creates UDP socket on port 1800
   - Joins multicast group `239.255.255.250`
   - Sends M-SEARCH request (SSDP-like protocol)
   - Listens for device responses containing:
     - `DeviceName:` - Robot identifier
     - `DeviceMAC:` - MAC address (optional)
   - Returns list of discovered devices with IP addresses

### TCP Communication

2. **TCP Connection** (`TcpClient.ts`)
   - Establishes TCP socket connection to robot IP on port 7777
   - Sends registration packet: `[0, 0, 2, 3, 0, 0, 0, 0, 0, 0]`
   - Handles bidirectional communication:
     - **Send**: Text messages or byte arrays
     - **Receive**: Message callbacks via event listeners
   - Manages connection lifecycle (connect, error, close events)

### LUCI Protocol

3. **Robot Communication** (`RobotCom.ts`)
   - Implements LUCI (robot control protocol) packet format:
     ```
     Header: [0, 0, 2, mbnum[2], 0, 0, 0, lucilength[2], mode, packet0len[2], packet1len[2]]
     Data: packet0 bytes
     ```
   - Key commands:
     - **Command 245**: Action sequences (e.g., "hello", "relax", "namaste")
     - **Command 259**: Video connection request
   - Converts action messages to LUCI packets and sends via TCP

### Video Streaming

4. **Video Stream** (`VideoStream.ts`)
   - Requests video link via UDP (port 1700) or falls back to TCP
   - Establishes separate TCP connection for video (port 10000)
   - Receives binary video data (JPEG frames)
   - Processes frames by detecting START/END markers or JPEG headers
   - Converts frames to base64 data URIs for display
   - Updates UI with latest frame via callback

### Action Execution

5. **Action Sequences** (`remote.tsx`)
   - Pre-defined actions send LUCI command 245 with action name
   - Custom actions send motor position sequences:
     - Format: `custom_action|frame1|frame2|...|frame6|velocity|delays`
     - Each frame: 11 motor positions (comma-separated)
     - Velocity: Speed for each motor
     - Delays: Timing between frames (ms)

## Key Components

### NetworkDiscovery
- **Purpose**: Discover robots on local network
- **Protocol**: UDP multicast (SSDP-like)
- **Port**: 1800
- **Multicast Group**: 239.255.255.250
- **Returns**: Array of `DiscoveredDevice` objects

### TcpClient
- **Purpose**: TCP socket communication wrapper
- **Library**: `react-native-tcp-socket`
- **Features**:
  - Connection management
  - Message sending (text/bytes)
  - Async message reading
  - Video data reading
  - Error handling

### RobotCom
- **Purpose**: LUCI protocol implementation
- **Features**:
  - Packet creation and formatting
  - Motor control commands
  - Action sequence sending
  - Video connection requests
  - General LUCI packet/string sending

### VideoStream
- **Purpose**: Handle video streaming from robot
- **Connection**: TCP on port 10000
- **Format**: JPEG frames
- **Processing**: Frame detection, base64 encoding, UI updates

### ActionFileReader
- **Purpose**: Read action sequence files
- **Format**: CSV files with comma-separated byte values
- **Location**: `assets/actions/` directory
- **Usage**: Load pre-defined movement sequences

## Setup Instructions

### Prerequisites

- Node.js (v18+ recommended)
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- For Android: Android Studio, Java JDK, Android SDK
- For iOS: Xcode (macOS only)

### Installation

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Native Module Setup**
   
   This app requires native modules (`react-native-tcp-socket`, `react-native-udp`) that don't work with Expo Go. You need a development build:

   ```bash
   # Prebuild native modules
   npx expo prebuild
   
   # Or use EAS Build
   eas build --profile development --platform android
   ```

3. **Run the App**

   ```bash
   # Start Expo development server
   npm start
   
   # Run on Android (requires prebuild)
   npm run android
   
   # Run on iOS (requires prebuild)
   npm run ios
   ```

### Android Setup

See `SETUP_ANDROID_SDK.md` and `SETUP_JAVA.md` for detailed Android configuration.

### Native Modules

See `SETUP_NATIVE_MODULES.md` for native module setup instructions.

## Features

### ✅ Implemented

- UDP multicast device discovery
- TCP socket communication
- LUCI protocol implementation
- Video streaming (JPEG frames)
- Pre-defined action sequences
- Custom action sequences
- Manual IP entry
- Device list refresh
- Connection management

### 🔄 In Progress / Notes

- Video streaming may need format adjustments based on robot's actual video protocol
- Action files must be bundled with app or loaded from server
- Network permissions configured in `app.json`

## Technical Details

### Dependencies

**Core:**
- `expo` (~54.0.31) - Expo SDK
- `expo-router` (~6.0.21) - File-based routing
- `react-native` (0.81.5) - React Native framework

**Networking:**
- `react-native-tcp-socket` (^5.4.0) - TCP socket support
- `react-native-udp` (^4.1.2) - UDP socket support

**UI/UX:**
- `@react-navigation/*` - Navigation components
- `expo-av` - Audio/Video support
- `expo-image` - Image handling
- `react-native-reanimated` - Animations

### Network Configuration

**UDP Discovery:**
- Port: 1800
- Multicast: 239.255.255.250
- Protocol: SSDP-like (M-SEARCH)

**TCP Communication:**
- Control Port: 7777
- Video Port: 10000
- Protocol: LUCI (custom binary protocol)

### Permissions

Android permissions (configured in `app.json`):
- `INTERNET` - Network access
- `ACCESS_NETWORK_STATE` - Network state checking
- `CHANGE_WIFI_MULTICAST_STATE` - Multicast support

### LUCI Protocol Format

```
Packet Structure:
[0, 0, 2]                    # Magic bytes
[mbnum_low, mbnum_high]      # Command number (2 bytes, little-endian)
[0, 0, 0]                    # Reserved
[length_low, length_high]    # Data length (2 bytes, little-endian)
[mode]                        # Command mode (0=SET, 4/5=special)
[packet0len_low, packet0len_high]  # Packet 0 length
[packet1len_low, packet1len_high]  # Packet 1 length
[...data...]                  # Actual command data
```

## Troubleshooting

### Devices Not Discovered
- Ensure device and robot are on the same network
- Check firewall settings (UDP port 1800)
- Verify native modules are linked (`npx expo prebuild`)
- Test on real device (not emulator)

### Connection Fails
- Verify robot IP address is correct
- Check TCP port 7777 is accessible
- Ensure robot is powered on and connected
- Check network connectivity

### Video Not Streaming
- Verify video port 10000 is accessible
- Check video connection request was sent (command 259)
- Review console logs for video data reception
- Ensure video format matches expected JPEG

### Action Files Not Found
- Verify files are in `assets/actions/` directory
- Check file names match exactly (case-sensitive)
- Ensure files are properly bundled with app
- Review `ActionFileReader.ts` path resolution logic

## Development Notes

- The app uses Expo Router's file-based routing system
- Native modules require development builds (not Expo Go)
- Network operations should be tested on real devices
- Video streaming implementation may need adjustments based on robot's actual protocol
- LUCI protocol commands are documented in `RobotCom.ts`

## License

Same as original project.
