# Nina - Robot Remote Control App

A React Native application built with Expo for remotely controlling the Nino robot. The app provides device discovery, TCP communication, video streaming, and action sequence control.

**Written and Developed by Sirena R & D Team**

## Table of Contents

- [Overview](#overview)
- [Detailed App Structure](#detailed-app-structure)
- [Complete Application Flow](#complete-application-flow)
- [How It Works - Technical Deep Dive](#how-it-works---technical-deep-dive)
- [Key Components Explained](#key-components-explained)
- [Network Protocols](#network-protocols)
- [Setup Instructions](#setup-instructions)
- [Features](#features)
- [Technical Details](#technical-details)
- [Troubleshooting](#troubleshooting)

## Overview

Nina is a mobile application that allows users to:
- Discover robots on the local network using UDP multicast
- Connect to robots via TCP socket communication
- Control robot movements and actions using the LUCI protocol
- Receive and display live video feed from the robot
- Execute pre-defined action sequences

The app is built with **React Native** using **Expo Router** for file-based navigation and requires native modules for network communication.

## Detailed App Structure

### Root Configuration Files

```
nina/
├── package.json              # Dependencies and npm scripts
├── app.json                  # Expo configuration (app name, permissions, Android/iOS settings)
├── tsconfig.json             # TypeScript configuration
└── eslint.config.js          # ESLint rules
```

### App Screens (`app/` directory)

The app uses **Expo Router's file-based routing system**, where each file in the `app/` directory becomes a route.

#### 1. `app/_layout.tsx` - Root Layout
- **Purpose**: Defines the root navigation structure using React Navigation's Stack
- **Key Features**:
  - Sets up `ThemeProvider` for dark/light theme support
  - Configures all screens in a Stack navigator
  - All screens have `headerShown: false` for custom headers
  - `first-time.tsx` and `modal.tsx` are configured as modals
- **Screens Defined**:
  - `index` → Entry point (redirects to splash)
  - `splash` → Splash screen
  - `device-list` → Device discovery screen
  - `remote` → Main remote control interface
  - `first-time` → First-time user guide (modal)
  - `(tabs)` → Tab navigation group (currently unused in main flow)
  - `modal` → Generic modal screen

#### 2. `app/index.tsx` - Entry Point
- **Purpose**: App entry point that immediately redirects to splash screen
- **Implementation**: Simple `<Redirect href="/splash" />` component
- **Why**: Provides a clean entry point and allows for future initialization logic

#### 3. `app/splash.tsx` - Splash Screen
- **Purpose**: Shows app logo/icon while app initializes
- **Implementation**:
  - Displays app icon (`assets/images/icon.png`) centered on black background
  - Uses `useEffect` hook with 2-second timer
  - Automatically navigates to `/device-list` after 2 seconds
  - Cleans up timer on unmount to prevent memory leaks
- **UI**: Full-screen black background with centered 200x200 logo

#### 4. `app/device-list.tsx` - Device Discovery Screen
- **Purpose**: Main screen for discovering and selecting robots on the network
- **State Management**:
  - `devices`: Array of discovered devices
  - `isScanning`: Boolean for scan in progress
  - `refreshing`: Boolean for pull-to-refresh state
  - `error`: Error message string (null if no error)
  - `showManualEntry`: Boolean for manual IP entry modal
  - `manualIp`: String for manually entered IP address
- **Key Features**:
  - **Auto-scan on mount**: Automatically scans for devices when screen loads
  - **Search button**: Manual trigger to scan for devices
  - **Pull-to-refresh**: Swipe down to refresh device list
  - **Device list**: FlatList showing discovered devices with:
    - Device name
    - IP address
    - Port (if available)
    - Device state (if available)
    - Zone ID (if available)
    - Stream URL (if available)
    - MAC address (if available)
  - **Manual IP entry**: Modal dialog to enter IP address directly
  - **Device selection**: Tap device to navigate to remote control screen
- **Navigation**: 
  - On device tap → navigates to `/remote` with `ip` and `name` params
  - Manual IP → navigates to `/remote` with entered IP and "Manual Device" name
- **Error Handling**: 
  - Shows error message if UDP library not available
  - Displays helpful message about needing native modules
  - Gracefully handles network errors

#### 5. `app/remote.tsx` - Remote Control Screen
- **Purpose**: Main interface for controlling the robot after connection
- **State Management**:
  - `robot`: RobotCom instance (created once, reused)
  - `videoUri`: Base64 data URI string for current video frame
  - `videoStatus`: String status message ("Connecting...", "Streaming", etc.)
  - `isVideoStreaming`: Boolean for video stream state
  - `tcpConnected`: Boolean for TCP connection state
- **Connection Flow**:
  1. **TCP Connection** (`connectToRobot`):
     - Creates `TcpClient` instance via `RobotCom.openTcp()`
     - Connects to robot IP on port 7777
     - Polls connection status every 200ms
     - Implements retry logic with exponential backoff (max 3 retries)
     - 10-second timeout per connection attempt
     - Sends async command registration (command 3) when connected
     - Requests video connection after TCP is established
  2. **Video Stream** (`startVideoStream`):
     - Creates `VideoStream` instance
     - Requests video link configuration
     - Sends LUCI command 259 to request video connection
     - Establishes separate TCP connection on port 10000
     - Processes incoming video frames and updates UI
- **Action Buttons**:
  - Pre-defined actions: Neutral, Point Right, Hello, Relax, Namaste, Point Left, Head Nod
  - Each action sends LUCI command 245 with action message
  - Uses `mode=2` (CommandType=2) as expected by robot
  - Shows toast alert after sending command
- **UI Components**:
  - **Header**: Shows device name, IP, connection indicator (green dot = connected)
  - **Video Display**: 
     - Shows live video feed when streaming
     - Placeholder with status message when not streaming
     - "Retry Connection" button if connection fails
     - "Stop Video" button when streaming
  - **Action Buttons**: 2-column grid of action buttons
  - **Disconnect Button**: Returns to device list after confirmation
- **Error Handling**:
  - Checks TCP connection before sending commands
  - Shows alerts for connection errors
  - Provides retry options
  - Handles video stream errors gracefully

#### 6. `app/first-time.tsx` - First-Time Guide
- **Purpose**: Modal screen with welcome message and tips
- **Implementation**: 
  - Simple modal with welcome text and tips
  - "Got it!" button dismisses modal (navigates back)
  - Currently not automatically shown (can be triggered manually)

#### 7. `app/(tabs)/` - Tab Navigation Group
- **Purpose**: Tab-based navigation (currently unused in main app flow)
- **Files**:
  - `_layout.tsx`: Defines tab bar with Home and Explore tabs
  - `index.tsx`: Home tab screen
  - `explore.tsx`: Explore tab screen
- **Note**: These screens exist but are not part of the main robot control flow

### Core Utilities (`utils/` directory)

#### 1. `utils/NetworkDiscovery.ts` - UDP Device Discovery
- **Purpose**: Discovers robots on local network using UDP multicast
- **Class**: `NetworkDiscovery`
- **Key Methods**:
  - `discoverDevices(timeout: number)`: Main discovery method
    - Creates UDP socket on port 1800
    - Joins multicast group `239.255.255.250`
    - Sends M-SEARCH request (SSDP-like protocol)
    - Listens for device responses
    - Returns array of `DiscoveredDevice` objects
  - `stopDiscovery()`: Closes socket and stops discovery
- **Protocol Details**:
  - **Discovery Request**: 
    ```
    M-SEARCH * HTTP/1.1\r\n
    HOST: 239.255.255.250:1800\r\n\r\n
    PROTOCOL:Version 1.0\r\n
    ```
  - **Device Response Format**:
    ```
    HTTP/1.1 200 OK\r\n
    HOST: 239.255.255.250:1800\r\n
    PROTOCOL: Version 1.0
    DeviceName: Libre Node XXXXX\r\n
    DeviceState: M\r\n
    PORT: 3333\r\n
    ZoneID: XXXX-XXXX-XXXX-XXXX
    StreamURL: 239:255:255:251:3000\r\n
    DeviceMAC: XX:XX:XX:XX:XX:XX\r\n
    ```
- **Parsing**: Extracts device name, IP, port, state, zone ID, stream URL, and MAC address
- **Error Handling**: 
  - Gracefully handles missing native module
  - Checks for socket closure before operations
  - Handles network errors without crashing
- **Library**: Uses `react-native-udp` (requires native module)

#### 2. `utils/TcpClient.ts` - TCP Socket Client
- **Purpose**: Wrapper for TCP socket communication with robot
- **Class**: `TcpClient`
- **Key Properties**:
  - `SERVER_IP`: Robot IP address
  - `SERVER_PORT`: Port number (7777 for control, 10000 for video)
  - `delay`: Delay between writes (35ms, kept for compatibility)
- **Key Methods**:
  - `run()`: Establishes TCP connection
    - Creates socket using `react-native-tcp-socket`
    - Connects to `SERVER_IP:SERVER_PORT`
    - Sets `noDelay: true` for immediate data sending
    - Sets up event listeners (connect, error, data, close)
    - Marks connection as ready after 50ms stabilization
  - `sendMessage(message: string)`: Sends text message
  - `sendMessageBytes(msg: Uint8Array)`: Sends binary data
    - Converts Uint8Array to Buffer
    - Handles backpressure (retries if write returns false)
    - Logs packet preview for debugging
  - `readMessage()`: Reads message asynchronously (Promise-based)
  - `readVideoAsync(maxSize)`: Reads video data asynchronously
  - `getIsConnected()`: Returns connection status
  - `stopClient()`: Closes socket and cleans up
- **Data Handling**:
  - Converts between Buffer, Uint8Array, and Array formats
  - Parses LUCI protocol responses
  - Filters out video data on control port
  - Handles binary and text data
- **LUCI Response Parsing**:
  - Validates 10-byte header format
  - Extracts: remoteID, commandType, command, commandStatus, CRC, dataLen
  - Decodes payload as text or binary
- **Library**: Uses `react-native-tcp-socket` (requires native module)

#### 3. `utils/RobotCom.ts` - LUCI Protocol Implementation
- **Purpose**: Implements LUCI (robot control protocol) packet creation and sending
- **Class**: `RobotCom`
- **Key Properties**:
  - `mTcpClient`: TcpClient instance for communication
  - `serverip`: Robot IP address
  - `LatestReceivedBytes`: Buffer for received data
- **Key Methods**:
  - `openTcp(ip: string)`: Opens TCP connection to robot
    - Creates TcpClient instance
    - Sets IP and port (7777)
    - Starts connection
  - `LUCI_createPacket(mbnum, mode, packet0, packet1)`: Creates LUCI packet
    - **Header Format (10 bytes)**:
      ```
      [remoteID(2), CommandType(1), Command(2), CommandStatus(1), CRC(2), DataLen(2)]
      ```
    - remoteID: Always 0
    - CommandType: 0=SET, 1=GET, 2=default
    - Command: Command number (e.g., 245 for actions, 259 for video)
    - CommandStatus: Always 0
    - CRC: Always 0
    - DataLen: Payload length
    - Returns: 10-byte header + payload
  - `sendAsynchronousCommand()`: Sends async registration (command 3)
    - Must be sent before each action command
    - Uses mode=2 (CommandType=2)
    - Currently sends empty data (robot should still accept)
  - `sendLUCICommand(command, actionMessage, mode)`: Sends action command
    - **Flow**:
      1. Sends async command registration (command 3)
      2. Waits 300ms for registration to process
      3. Creates LUCI packet with command and action message
      4. Sends packet via TCP
    - **Command 245**: Used for action sequences (hello, relax, namaste, etc.)
    - **Mode 2**: CommandType=2 (expected by robot)
  - `request_video_connection()`: Requests video stream
    - Sends LUCI command 259 with mode=2
    - Empty payload
  - `sendMessageBytes(data)`: Sends raw bytes via TCP
  - `send_general_LUCI_packet(mbnum, packet)`: Sends general LUCI packet
  - `send_general_LUCI_string(mbnum, s)`: Sends string as LUCI packet
- **Packet Format Details**:
  - All values are little-endian
  - Header is always 10 bytes
  - Payload follows header
  - Total packet size = 10 + payload.length

#### 4. `utils/VideoStream.ts` - Video Streaming Handler
- **Purpose**: Handles video streaming from robot
- **Class**: `VideoStream`
- **Key Methods**:
  - `requestVideoLink(ip)`: Requests video configuration
    - Currently returns direct TCP connection config (IP:10000)
    - Future: Could use UDP multicast on port 1700
  - `startStreaming(config, onFrame)`: Starts video stream
    - Creates separate TcpClient for video (port 10000)
    - Waits 1.5 seconds for connection
    - Sets up data handler on socket
    - Processes incoming video data
  - `handleVideoData(data)`: Processes raw video data
  - `processVideoData(data)`: Extracts frames from byte stream
    - Looks for START marker: `[0x53, 0x54, 0x41, 0x52, 0x54]` ("START")
    - Looks for END marker: `[0x45, 0x4E, 0x44]` ("END")
    - Buffers data between markers
    - Extracts complete frames
  - `decodeAndDisplayFrame(frameData)`: Converts frame to displayable format
    - Checks for JPEG header (0xFF 0xD8)
    - Converts to base64 data URI
    - Calls `onFrameReceived` callback with data URI
  - `stopStreaming()`: Stops video stream and closes connection
- **Video Format**:
  - JPEG frames wrapped with START/END markers
  - Frames can also start directly with JPEG header (0xFF 0xD8)
  - Base64 encoding for React Native Image component
- **Connection**: Separate TCP connection on port 10000

#### 5. `utils/ActionFileReader.ts` - Action File Reader
- **Purpose**: Reads action sequence files from assets
- **Class**: `ActionFileReader` (static methods)
- **Key Methods**:
  - `readActionFile(filename)`: Reads action file
    - Tries multiple paths:
      1. `bundleDirectory/assets/actions/${filename}`
      2. `bundleDirectory/assets/${filename}`
      3. `documentDirectory/${filename}`
    - Parses CSV format (comma-separated values)
    - Returns 2D array of numbers
  - `s2b(a)`: String to byte conversion utility
- **File Format**: CSV files with comma-separated byte values
- **Location**: `assets/actions/` directory
- **Note**: Currently not actively used in remote.tsx (actions are sent as strings)

### Components (`components/` directory)

- **UI Components**: Reusable UI elements (icons, collapsible, themed components)
- **Haptic Tab**: Tab button with haptic feedback
- **Themed Components**: Components that adapt to light/dark theme

### Assets (`assets/` directory)

- **images/**: App icons, splash images, favicon
- **actions/**: Action sequence files (CSV format)
  - Movement sequences: `front.txt`, `back.txt`, `t_left.txt`, `t_right.txt`
  - Tilt sequences: `tilt_*.txt`
  - Lateral sequences: `l_*.txt`
  - Stance sequences: `stance.txt`, `stand.txt`, `sit.txt`

### Scripts (`scripts/` directory)

- **build-android.ps1**: Builds and installs app on Android device
- **build-apk.ps1**: Builds APK file for distribution
- **setup-java.ps1**: Sets up Java environment variables
- **setup-native-modules.js**: Configures native modules

## Complete Application Flow

### 1. App Launch → Splash Screen

**File**: `app/index.tsx` → `app/splash.tsx`

1. App starts at `/` route
2. `index.tsx` immediately redirects to `/splash`
3. `splash.tsx` displays app icon on black background
4. After 2 seconds, automatically navigates to `/device-list`

**Code Flow**:
```typescript
// index.tsx
<Redirect href="/splash" />

// splash.tsx
useEffect(() => {
  const timer = setTimeout(() => {
    router.replace('/device-list');
  }, 2000);
  return () => clearTimeout(timer);
}, []);
```

### 2. Device Discovery

**File**: `app/device-list.tsx`

1. **Screen Loads**:
   - Component mounts
   - `NetworkDiscovery` instance created
   - Auto-scan triggered (or user taps "Search")

2. **Discovery Process** (`NetworkDiscovery.discoverDevices()`):
   - Creates UDP socket on port 1800
   - Joins multicast group `239.255.255.250`
   - Sends M-SEARCH request
   - Listens for responses (2-second timeout)
   - Parses device responses
   - Updates `devices` state

3. **Device Response Parsing**:
   - Extracts: DeviceName, IP, PORT, DeviceState, ZoneID, StreamURL, DeviceMAC
   - Creates `DiscoveredDevice` objects
   - Adds to devices array (deduplicates by IP)

4. **UI Updates**:
   - FlatList displays discovered devices
   - Shows device name, IP, and optional info
   - Loading indicator while scanning
   - Error message if UDP not available

5. **User Actions**:
   - **Tap device**: Navigates to `/remote` with device IP and name
   - **Pull to refresh**: Triggers new scan
   - **Manual IP**: Opens modal to enter IP directly
   - **Search button**: Manual scan trigger

**Code Flow**:
```typescript
// Auto-scan on mount
useEffect(() => {
  scanForDevices();
}, []);

// Discovery
const discoveredDevices = await discovery.discoverDevices(2000);

// Device selection
handleDevicePress(device) → router.push('/remote', { ip, name })
```

### 3. Remote Control Connection

**File**: `app/remote.tsx`

1. **Screen Loads with Device Info**:
   - Receives `ip` and `name` from route params
   - Creates `RobotCom` instance
   - Starts connection process

2. **TCP Connection** (`connectToRobot()`):
   - Creates `TcpClient` via `RobotCom.openTcp(ip)`
   - Connects to `ip:7777`
   - Polls connection status every 200ms
   - On success:
     - Sets `tcpConnected = true`
     - Sends async command registration (command 3, mode 2)
     - Requests video connection after 500ms

3. **Video Stream Setup** (`startVideoStream()`):
   - Creates `VideoStream` instance
   - Requests video link (returns `{ip, port: 10000}`)
   - Sends LUCI command 259 to request video connection
   - Waits 1 second
   - Creates separate TCP connection on port 10000
   - Sets up data handler for video frames

4. **Video Frame Processing**:
   - Receives binary data on video socket
   - Looks for START/END markers or JPEG headers
   - Extracts complete frames
   - Converts to base64 data URI
   - Updates `videoUri` state
   - React Native Image component displays frame

**Code Flow**:
```typescript
// Connection
useEffect(() => {
  if (ip) connectToRobot(0);
}, [ip]);

// TCP connection
robot.openTcp(ip) → TcpClient.run() → socket.connect()

// Video stream
startVideoStream() → VideoStream.startStreaming() → socket.on('data')
```

### 4. Sending Robot Actions

**File**: `app/remote.tsx`

1. **User Taps Action Button**:
   - Action selected from `ACTION_ITEMS` array
   - Example: "Hello" → message: "hello"

2. **Command Validation**:
   - Checks if `robot.mTcpClient` exists
   - Checks if `getIsConnected()` returns true
   - Shows error alert if not connected

3. **Send LUCI Command** (`RobotCom.sendLUCICommand()`):
   - **Step 1**: Sends async command registration
     - Command: 3
     - Mode: 2 (CommandType=2)
     - Empty payload
   - **Step 2**: Waits 300ms
   - **Step 3**: Creates LUCI packet
     - Command: 245
     - Mode: 2
     - Payload: Action message (e.g., "hello")
   - **Step 4**: Sends packet via TCP

4. **LUCI Packet Format**:
   ```
   Header (10 bytes):
   [0, 0, 2, 245, 0, 0, 0, 0, 7, 0]
   └─┬─┘ └─┬─┘ └─┬─┘ └─┬─┘ └─┬─┘
   remoteID=0  cmdType=2  cmd=245  status=0  crc=0  len=7
   
   Payload (7 bytes):
   "hello" → [104, 101, 108, 108, 111]
   ```

5. **UI Feedback**:
   - Shows toast alert: "Nino will say Hello"
   - Logs command details to console

**Code Flow**:
```typescript
handleActionPress(index) → 
  robot.sendLUCICommand(245, "hello", 2) →
    sendAsynchronousCommand() → // Command 3
    setTimeout(300ms) →
    LUCI_createPacket(245, 2, "hello") →
    sendMessageBytes(packet)
```

### 5. Disconnection

**File**: `app/remote.tsx`

1. **User Taps Disconnect**:
   - Shows confirmation alert
   - On confirm:
     - Stops video stream (`VideoStream.stopStreaming()`)
     - Closes TCP connection (`TcpClient.stopClient()`)
     - Navigates back to `/device-list`

2. **Cleanup**:
   - Clears all timers and intervals
   - Removes event listeners
   - Resets state

**Code Flow**:
```typescript
handleDisconnect() →
  stopVideoStream() →
  robot.mTcpClient.stopClient() →
  router.replace('/device-list')
```

## How It Works - Technical Deep Dive

### Network Architecture

The app uses a **dual-connection architecture**:

1. **Control Connection (TCP Port 7777)**:
   - Main communication channel
   - Sends LUCI protocol commands
   - Receives command responses
   - Persistent connection during session

2. **Video Connection (TCP Port 10000)**:
   - Separate connection for video stream
   - Receives JPEG frames
   - Established after control connection
   - Can be stopped/restarted independently

### LUCI Protocol

**LUCI (Libre Universal Control Interface)** is a binary protocol for robot control.

#### Packet Structure

```
┌─────────────────────────────────────────┐
│           Header (10 bytes)             │
├─────────────────────────────────────────┤
│ Byte 0-1:   remoteID (little-endian)    │
│ Byte 2:     CommandType (0=SET, 1=GET)  │
│ Byte 3-4:   Command (little-endian)     │
│ Byte 5:     CommandStatus               │
│ Byte 6-7:   CRC (little-endian)         │
│ Byte 8-9:   DataLen (little-endian)     │
├─────────────────────────────────────────┤
│           Payload (DataLen bytes)        │
└─────────────────────────────────────────┘
```

#### Common Commands

- **Command 3**: Async command registration (must be sent before actions)
- **Command 245**: Action sequences (hello, relax, namaste, etc.)
- **Command 259**: Video connection request

#### Command Types

- **Mode 0 (LUCI_SET)**: Set command
- **Mode 1 (LUCI_GET)**: Get command
- **Mode 2**: Default/expected by robot

### UDP Discovery Protocol

**LSSDP (Libre Simple Service Discovery Protocol)** - SSDP-like protocol:

1. **Multicast Group**: `239.255.255.250:1800`
2. **Request Format**:
   ```
   M-SEARCH * HTTP/1.1\r\n
   HOST: 239.255.255.250:1800\r\n\r\n
   PROTOCOL:Version 1.0\r\n
   ```
3. **Response Format**:
   ```
   HTTP/1.1 200 OK\r\n
   HOST: 239.255.255.250:1800\r\n
   PROTOCOL: Version 1.0
   DeviceName: <name>\r\n
   DeviceState: <state>\r\n
   PORT: <port>\r\n
   ZoneID: <zone-id>\r\n
   StreamURL: <stream-url>\r\n
   DeviceMAC: <mac-address>\r\n
   ```

### Video Streaming Protocol

1. **Connection Request**: Send LUCI command 259 via control connection
2. **Video Connection**: Establish TCP connection to port 10000
3. **Frame Format**: 
   - Option 1: Wrapped with START/END markers
   - Option 2: Direct JPEG (starts with 0xFF 0xD8)
4. **Frame Processing**:
   - Buffer data until END marker found
   - Extract frame between START and END
   - Convert to base64 data URI
   - Update UI with latest frame

### State Management

The app uses **React hooks** for state management:

- **useState**: Component-level state (devices, connection status, video URI)
- **useRef**: Persistent references (video stream, timers, retry counters)
- **useEffect**: Side effects (connection on mount, cleanup on unmount)
- **useCallback**: Memoized callbacks (scan functions, refresh handlers)

### Error Handling Strategy

1. **Network Errors**:
   - UDP discovery: Graceful fallback, shows error message
   - TCP connection: Retry with exponential backoff (max 3 retries)
   - Video stream: Silent failure (video may not be enabled)

2. **Native Module Errors**:
   - Checks for module availability before use
   - Shows helpful error messages
   - Suggests running `npx expo prebuild`

3. **Connection Timeouts**:
   - 10-second timeout for TCP connection
   - Automatic retry with backoff
   - User can manually retry

## Key Components Explained

### NetworkDiscovery Class

**File**: `utils/NetworkDiscovery.ts`

**Purpose**: Discovers robots on local network using UDP multicast.

**How it works**:
1. Creates UDP socket on port 1800
2. Joins multicast group `239.255.255.250`
3. Sends M-SEARCH request
4. Listens for device responses
5. Parses response to extract device info
6. Returns array of discovered devices

**Key Features**:
- Handles missing native module gracefully
- Prevents duplicate devices (by IP)
- Automatic timeout (2 seconds default)
- Clean socket closure

### TcpClient Class

**File**: `utils/TcpClient.ts`

**Purpose**: TCP socket wrapper for bidirectional communication.

**How it works**:
1. Creates TCP socket using `react-native-tcp-socket`
2. Connects to specified IP and port
3. Sets `noDelay: true` for immediate sending
4. Handles data events (text and binary)
5. Parses LUCI protocol responses
6. Manages connection lifecycle

**Key Features**:
- Async message reading (Promise-based)
- Binary data support (Uint8Array)
- Connection state tracking
- Backpressure handling
- LUCI response parsing

### RobotCom Class

**File**: `utils/RobotCom.ts`

**Purpose**: LUCI protocol implementation and robot communication.

**How it works**:
1. Creates and manages TcpClient instance
2. Formats commands as LUCI packets
3. Sends async registration before actions
4. Handles action commands (command 245)
5. Requests video connections (command 259)

**Key Features**:
- LUCI packet creation (10-byte header + payload)
- Little-endian byte conversion
- Command sequencing (async reg → action)
- Detailed logging for debugging

### VideoStream Class

**File**: `utils/VideoStream.ts`

**Purpose**: Handles video streaming from robot.

**How it works**:
1. Creates separate TCP connection on port 10000
2. Receives binary video data
3. Processes frames (START/END markers or JPEG headers)
4. Converts frames to base64 data URIs
5. Updates UI via callback

**Key Features**:
- Frame extraction from byte stream
- JPEG format detection
- Base64 encoding
- Buffer management
- Error handling for missing video

## Network Protocols

### UDP Discovery (Port 1800)

- **Protocol**: LSSDP (SSDP-like)
- **Multicast**: `239.255.255.250:1800`
- **Request**: M-SEARCH message
- **Response**: HTTP-like response with device info
- **Library**: `react-native-udp`

### TCP Control (Port 7777)

- **Protocol**: LUCI (binary)
- **Connection**: Persistent during session
- **Commands**: Action sequences, video requests
- **Library**: `react-native-tcp-socket`

### TCP Video (Port 10000)

- **Protocol**: Raw JPEG frames
- **Connection**: Separate from control
- **Format**: START/END markers or direct JPEG
- **Library**: `react-native-tcp-socket`

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

### Building APK

See `BUILD_APK.md` for detailed instructions on building APK files.

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
- Retry logic with exponential backoff
- Video stream control (start/stop)
- Connection status indicators
- Error handling and user feedback

### 🔄 In Progress / Notes

- Video streaming may need format adjustments based on robot's actual video protocol
- Action files exist but are not actively used (actions sent as strings)
- Async command registration sends empty data (could send local IP + port)
- Tab navigation exists but is not part of main flow

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
[0, 0, 2]                    # Magic bytes (legacy, not used in new format)
[mbnum_low, mbnum_high]      # Command number (2 bytes, little-endian)
[0, 0, 0]                    # Reserved
[length_low, length_high]    # Data length (2 bytes, little-endian)
[mode]                        # Command mode (0=SET, 4/5=special)
[packet0len_low, packet0len_high]  # Packet 0 length
[packet1len_low, packet1len_high]  # Packet 1 length
[...data...]                  # Actual command data
```

**New Format (Current Implementation):**
```
Header (10 bytes):
[remoteID(2), CommandType(1), Command(2), CommandStatus(1), CRC(2), DataLen(2)]
Payload: data bytes
```

## Troubleshooting

### Devices Not Discovered

- Ensure device and robot are on the same network
- Check firewall settings (UDP port 1800)
- Verify native modules are linked (`npx expo prebuild`)
- Test on real device (not emulator)
- Check console for UDP library errors

### Connection Fails

- Verify robot IP address is correct
- Check TCP port 7777 is accessible
- Ensure robot is powered on and connected
- Check network connectivity
- Review connection retry logs in console
- Try manual IP entry

### Video Not Streaming

- Verify video port 10000 is accessible
- Check video connection request was sent (command 259)
- Review console logs for video data reception
- Ensure video format matches expected JPEG
- Video may not be enabled on robot (connection refused is normal)

### Action Commands Not Working

- Verify TCP connection is established (green dot in header)
- Check console for LUCI command logs
- Ensure async command registration is sent first
- Verify command format matches robot expectations
- Check robot logs for received commands

### Action Files Not Found

- Verify files are in `assets/actions/` directory
- Check file names match exactly (case-sensitive)
- Ensure files are properly bundled with app
- Review `ActionFileReader.ts` path resolution logic
- Note: Action files are currently not actively used

## Development Notes

- The app uses Expo Router's file-based routing system
- Native modules require development builds (not Expo Go)
- Network operations should be tested on real devices
- Video streaming implementation may need adjustments based on robot's actual protocol
- LUCI protocol commands are documented in `RobotCom.ts`
- All network operations are asynchronous
- Connection state is tracked with multiple flags for reliability
- Error handling is comprehensive with user-friendly messages

## License

Same as original project.
