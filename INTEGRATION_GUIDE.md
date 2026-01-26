# Integration Guide: Device Discovery, Video Feed, and Actions Control

This guide explains how to integrate the three core features from this React Native app into another application. Each feature has specific requirements and dependencies that must be properly configured.

---

## Table of Contents

1. [Device Discovery](#1-device-discovery)
2. [Video Feed](#2-video-feed)
3. [Actions Control](#3-actions-control)
4. [Common Requirements](#common-requirements)
5. [Platform-Specific Considerations](#platform-specific-considerations)
6. [Troubleshooting](#troubleshooting)

---

## 1. Device Discovery

### Overview
Device Discovery uses UDP multicast to find robots on the local network using the LSSDP (Local Simple Service Discovery Protocol) protocol.

### Key Components

**File:** `utils/NetworkDiscovery.ts`

**Protocol Details:**
- **Multicast Address:** `239.255.255.250:1800`
- **Discovery Message:** `M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1800\r\n\r\nPROTOCOL:Version 1.0\r\n`
- **Response Format:** HTTP/1.1 200 OK with device information

### Integration Steps

#### Step 1: Install Dependencies

```bash
npm install react-native-udp
```

For Expo projects:
```bash
npx expo prebuild
```

#### Step 2: Copy Utility Files

Copy the following files to your project:
- `utils/NetworkDiscovery.ts`
- `utils/TcpClient.ts` (required for connection management)

#### Step 3: Implement Discovery in Your App

```typescript
import { NetworkDiscovery, DiscoveredDevice } from './utils/NetworkDiscovery';

// Initialize discovery
const discovery = new NetworkDiscovery();

// Discover devices
const devices = await discovery.discoverDevices(2000); // 2 second timeout

// Handle discovered devices
devices.forEach((device: DiscoveredDevice) => {
  console.log(`Found: ${device.name} at ${device.ip}:${device.port}`);
  // device.name, device.ip, device.port, device.deviceState, 
  // device.zoneId, device.streamUrl, device.macAddress
});

// Cleanup when done
discovery.stopDiscovery();
```

### Response Parsing

The discovery response contains:
- `DeviceName`: Robot name (e.g., "Libre Node XXXXX")
- `DeviceState`: Current state (e.g., "M")
- `PORT`: Control port (typically 3333)
- `ZoneID`: Unique zone identifier
- `StreamURL`: Video stream multicast address
- `DeviceMAC`: MAC address (optional)

### Important Considerations

1. **Native Module Requirement:**
   - UDP sockets require native modules
   - **Expo Go does NOT support this** - you must build a development build
   - Run `npx expo prebuild` before building

2. **Network Permissions:**
   - Android: Requires `INTERNET` and `ACCESS_NETWORK_STATE` permissions
   - iOS: Requires network entitlements

3. **Firewall/VPN:**
   - UDP multicast may be blocked by firewalls
   - VPN connections can interfere with local network discovery

4. **Socket Lifecycle:**
   - Always call `stopDiscovery()` to clean up sockets
   - Handle socket errors gracefully (network unavailable, etc.)

5. **Timeout Handling:**
   - Default timeout is 2000ms
   - Adjust based on network latency
   - Devices may respond at different times

---

## 2. Video Feed

### Overview
Video streaming receives JPEG frames over TCP connection, extracts frames using START/END markers, and displays them as base64-encoded images.

### Key Components

**Files:**
- `utils/VideoStream.ts`
- `utils/TcpClient.ts` (required)

**Protocol Details:**
- **Control Port:** 7777 (TCP)
- **Video Port:** 10000 (TCP) - default
- **Frame Markers:** 
  - START: `[0x53, 0x54, 0x41, 0x52, 0x54]` ("START")
  - END: `[0x45, 0x4E, 0x44]` ("END")
- **Format:** JPEG frames wrapped with markers

### Integration Steps

#### Step 1: Install Dependencies

```bash
npm install react-native-tcp-socket expo-image
```

For Expo projects:
```bash
npx expo prebuild
```

#### Step 2: Copy Utility Files

Copy the following files:
- `utils/VideoStream.ts`
- `utils/TcpClient.ts`
- `utils/RobotCom.ts` (for video connection request)

#### Step 3: Request Video Connection

Before starting video stream, you must:
1. Establish TCP control connection (port 7777)
2. Send video connection request via LUCI protocol

```typescript
import { RobotCom } from './utils/RobotCom';
import { VideoStream } from './utils/VideoStream';

// Step 1: Connect to robot control port
const robot = new RobotCom();
robot.openTcp(deviceIp); // Connects to port 7777

// Wait for connection (check robot.mTcpClient.getIsConnected())

// Step 2: Request video connection
robot.request_video_connection(); // Sends LUCI command 259

// Wait a moment for connection to be ready
await new Promise(resolve => setTimeout(resolve, 1000));
```

#### Step 4: Start Video Stream

```typescript
const videoStream = new VideoStream();

// Request video link (gets IP and port)
const videoConfig = await videoStream.requestVideoLink(deviceIp);
// Returns: { ip: string, port?: number, multicastIp?: string }

// Start streaming with frame callback
await videoStream.startStreaming(videoConfig, (imageData: string) => {
  // imageData is base64-encoded JPEG: "data:image/jpeg;base64,..."
  // Update your UI component with this data
  setVideoFrame(imageData);
});

// Stop streaming when done
videoStream.stopStreaming();
```

#### Step 5: Display Video in UI

```typescript
import { Image } from 'expo-image';

// In your component
{videoFrame && (
  <Image 
    source={{ uri: videoFrame }} 
    style={{ width: '100%', height: 300 }}
    contentFit="contain"
  />
)}
```

### Frame Processing Details

The video stream:
1. Receives binary data chunks over TCP
2. Accumulates data in buffer
3. Searches for START marker (0x53 0x54 0x41 0x52 0x54)
4. Collects data until END marker (0x45 0x4E 0x44)
5. Extracts JPEG data (starts with 0xFF 0xD8)
6. Converts to base64 data URI
7. Calls callback with `data:image/jpeg;base64,...`

### Important Considerations

1. **Connection Order:**
   - Control connection (7777) must be established first
   - Video connection request must be sent before streaming
   - Video port (10000) may not be available if video is disabled on robot

2. **Error Handling:**
   - Video stream may fail with `ECONNREFUSED` if video is disabled
   - Handle connection errors gracefully
   - Implement retry logic for dropped connections

3. **Performance:**
   - JPEG decoding happens on main thread
   - Large frames may cause UI lag
   - Consider frame rate limiting or downscaling

4. **Memory Management:**
   - Base64 images consume significant memory
   - Clear old frames when new ones arrive
   - Stop streaming when component unmounts

5. **Network Requirements:**
   - Video stream requires stable TCP connection
   - Bandwidth: ~100KB-500KB per frame depending on resolution
   - Frame rate: Typically 10-30 FPS

---

## 3. Actions Control

### Overview
Actions are sent to the robot using the LUCI protocol over TCP. Each action requires:
1. Asynchronous command registration (command 3)
2. Action command (command 245) with action message string

### Key Components

**Files:**
- `utils/RobotCom.ts` (main control interface)
- `utils/TcpClient.ts` (TCP communication)
- `utils/ActionFileReader.ts` (optional - for reading action files)

**Protocol Details:**
- **Control Port:** 7777 (TCP)
- **LUCI Packet Format:**
  - Header (10 bytes): `[remoteID(2), CommandType(1), Command(2), CommandStatus(1), CRC(2), DataLen(2)]`
  - Payload: Variable length data
- **Command Types:**
  - `0` = LUCI_SET
  - `1` = LUCI_GET
  - `2` = Default (most common)
- **Action Command:** 245
- **Async Registration Command:** 3

### Integration Steps

#### Step 1: Install Dependencies

```bash
npm install react-native-tcp-socket
```

For Expo projects:
```bash
npx expo prebuild
```

#### Step 2: Copy Utility Files

Copy the following files:
- `utils/RobotCom.ts`
- `utils/TcpClient.ts`
- `utils/ActionFileReader.ts` (if using action files)

#### Step 3: Establish Connection

```typescript
import { RobotCom } from './utils/RobotCom';

const robot = new RobotCom();
robot.openTcp(deviceIp); // Connects to port 7777

// Wait for connection
// Check: robot.mTcpClient?.getIsConnected()
```

#### Step 4: Send Asynchronous Command Registration

**IMPORTANT:** This must be sent before each action command.

```typescript
// Send async command registration (command 3)
robot.sendAsynchronousCommand();

// Wait a moment (300ms recommended)
await new Promise(resolve => setTimeout(resolve, 300));
```

#### Step 5: Send Action Command

```typescript
// Send action with message
robot.sendLUCICommand(245, 'hello', 2);
// Parameters: command number, action message, command type

// Common action messages:
// - 'hello' - Hello gesture
// - 'point_right' - Point right
// - 'point_left' - Point left
// - 'relax' - Relax pose
// - 'namaste' - Namaste gesture
// - 'head_node' - Head nod
// - 'Neutral' - Neutralize robot
```

#### Step 6: Complete Example

```typescript
import { RobotCom } from './utils/RobotCom';

class RobotController {
  private robot: RobotCom;
  private deviceIp: string;
  private isConnected: boolean = false;

  constructor(deviceIp: string) {
    this.deviceIp = deviceIp;
    this.robot = new RobotCom();
  }

  async connect(): Promise<boolean> {
    this.robot.openTcp(this.deviceIp);
    
    // Wait for connection with timeout
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (this.robot.mTcpClient?.getIsConnected()) {
          clearInterval(checkInterval);
          this.isConnected = true;
          
          // Send async command registration
          setTimeout(() => {
            this.robot.sendAsynchronousCommand();
            resolve(true);
          }, 200);
        }
      }, 100);

      // Timeout after 10 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve(false);
      }, 10000);
    });
  }

  async sendAction(actionMessage: string): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Not connected to robot');
    }

    // Send async command registration first
    this.robot.sendAsynchronousCommand();
    
    // Wait before sending action
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Send action command
    this.robot.sendLUCICommand(245, actionMessage, 2);
  }

  disconnect(): void {
    if (this.robot.mTcpClient) {
      this.robot.mTcpClient.stopClient();
    }
    this.isConnected = false;
  }
}

// Usage
const controller = new RobotController('192.168.1.100');
await controller.connect();
await controller.sendAction('hello');
controller.disconnect();
```

### LUCI Packet Format

**Packet Structure:**
```
[Header: 10 bytes][Payload: N bytes]
```

**Header Breakdown:**
- Bytes 0-1: `remoteID` (little-endian, typically 0)
- Byte 2: `CommandType` (0=SET, 1=GET, 2=default)
- Bytes 3-4: `Command` (little-endian, e.g., 245 for actions)
- Byte 5: `CommandStatus` (typically 0)
- Bytes 6-7: `CRC` (little-endian, typically 0)
- Bytes 8-9: `DataLen` (little-endian, payload length)

**Example Packet (command 245, message "hello"):**
```
Header: [0x00, 0x00, 0x02, 0xF5, 0x00, 0x00, 0x00, 0x00, 0x05, 0x00]
Payload: [0x68, 0x65, 0x6C, 0x6C, 0x6F] // "hello" in ASCII
```

### Important Considerations

1. **Command Sequence:**
   - **Always** send async command registration (command 3) before action command
   - Wait 200-300ms between async registration and action
   - Robot expects `CommandType=2` for most commands

2. **Connection State:**
   - Verify connection before sending commands
   - Handle connection drops gracefully
   - Implement retry logic for failed commands

3. **Action Messages:**
   - Action messages are case-sensitive strings
   - Robot must support the action message
   - Invalid messages may be ignored silently

4. **Timing:**
   - Don't send commands too rapidly
   - Wait for previous command to complete
   - Robot may queue commands but has limits

5. **Error Handling:**
   - Check `robot.mTcpClient?.getIsConnected()` before sending
   - Handle TCP errors (connection refused, timeout, etc.)
   - Log command failures for debugging

---

## Common Requirements

### Dependencies

All three features require:

```json
{
  "dependencies": {
    "react-native-tcp-socket": "^5.4.0",
    "react-native-udp": "^4.1.2",
    "expo-image": "~3.0.11"  // For video display
  }
}
```

### Native Module Setup

**For Expo Projects:**
```bash
# 1. Install dependencies
npm install

# 2. Prebuild native modules
npx expo prebuild

# 3. Build for your platform
npm run android  # or ios
```

**For React Native CLI:**
```bash
# 1. Install dependencies
npm install

# 2. Link native modules (auto-linked in RN 0.60+)
# If manual linking needed:
cd ios && pod install && cd ..
```

### Permissions

**Android (`android/app/src/main/AndroidManifest.xml`):**
```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

**iOS (`ios/YourApp/Info.plist`):**
```xml
<key>NSLocalNetworkUsageDescription</key>
<string>This app needs network access to discover and control robots</string>
```

### Network Configuration

1. **Same Network:**
   - App and robot must be on the same local network
   - VPN may interfere with discovery
   - Firewall may block UDP multicast

2. **Ports:**
   - UDP 1800: Device discovery
   - TCP 7777: Control commands
   - TCP 10000: Video stream (default)

3. **IP Addresses:**
   - Discovery finds devices automatically
   - Manual IP entry as fallback
   - Static IPs recommended for production

---

## Platform-Specific Considerations

### Android

1. **Network Security:**
   - Android 9+ blocks cleartext traffic by default
   - Add `android:usesCleartextTraffic="true"` to AndroidManifest.xml if needed
   - Or configure network security config

2. **Background Restrictions:**
   - Android may kill background network connections
   - Use foreground service for persistent connections
   - Request battery optimization exemption

3. **Permissions:**
   - Runtime permissions not required for network (INTERNET is install-time)
   - Location permission may be needed for WiFi scanning (not used here)

### iOS

1. **Network Entitlements:**
   - Enable "Outgoing Connections" in capabilities
   - Add App Transport Security exceptions if needed

2. **Background Modes:**
   - Enable "Background fetch" or "Background processing" if needed
   - Video streaming may stop when app backgrounds

3. **Multicast:**
   - iOS handles multicast differently than Android
   - Test thoroughly on actual devices (simulator may not work)

### Web (React Native Web)

**Note:** These features **do not work** in web browsers due to:
- No UDP socket support
- Limited TCP socket support
- Security restrictions on local network access

Use native mobile platforms only.

---

## Troubleshooting

### Device Discovery Issues

**Problem: No devices found**
- ✅ Check UDP library is properly linked (`npx expo prebuild`)
- ✅ Verify app and robot are on same network
- ✅ Disable VPN/firewall temporarily
- ✅ Check robot is powered on and connected
- ✅ Try manual IP entry as fallback

**Problem: Discovery crashes**
- ✅ Check native module is linked
- ✅ Verify permissions in AndroidManifest.xml
- ✅ Check console for native module errors

### Video Stream Issues

**Problem: Video not connecting**
- ✅ Verify control connection (port 7777) is established first
- ✅ Check video connection request was sent
- ✅ Verify video is enabled on robot
- ✅ Check video port (default 10000) is correct
- ✅ Handle `ECONNREFUSED` gracefully (video may be disabled)

**Problem: Video frames not displaying**
- ✅ Check frame callback is being called
- ✅ Verify base64 data URI format is correct
- ✅ Check Image component is properly configured
- ✅ Monitor memory usage (large frames can cause issues)

**Problem: Video stream drops**
- ✅ Implement reconnection logic
- ✅ Check network stability
- ✅ Handle socket close events
- ✅ Restart stream on error

### Actions Control Issues

**Problem: Commands not working**
- ✅ Verify TCP connection is established
- ✅ Check async command registration is sent first
- ✅ Wait 200-300ms between async registration and action
- ✅ Verify action message is correct (case-sensitive)
- ✅ Check robot logs for command reception

**Problem: Connection refused**
- ✅ Verify robot IP address is correct
- ✅ Check robot is powered on
- ✅ Verify port 7777 is not blocked by firewall
- ✅ Try manual IP entry

**Problem: Commands sent but robot doesn't respond**
- ✅ Check robot supports the action message
- ✅ Verify CommandType=2 is used (not 0 or 1)
- ✅ Check robot logs for errors
- ✅ Try different action messages

### General Issues

**Problem: Native modules not working**
- ✅ Run `npx expo prebuild` (Expo)
- ✅ Run `cd ios && pod install` (iOS)
- ✅ Rebuild app completely (clean build)
- ✅ Check native module versions are compatible

**Problem: Network errors**
- ✅ Verify INTERNET permission is granted
- ✅ Check network connectivity
- ✅ Disable VPN/firewall
- ✅ Test on different network

**Problem: App crashes on startup**
- ✅ Check all dependencies are installed
- ✅ Verify TypeScript types are correct
- ✅ Check console for import errors
- ✅ Verify file paths are correct

---

## Example Integration

Here's a complete example integrating all three features:

```typescript
import React, { useState, useEffect } from 'react';
import { View, Button, FlatList, Text } from 'react-native';
import { NetworkDiscovery, DiscoveredDevice } from './utils/NetworkDiscovery';
import { RobotCom } from './utils/RobotCom';
import { VideoStream } from './utils/VideoStream';
import { Image } from 'expo-image';

export default function RobotApp() {
  const [devices, setDevices] = useState<DiscoveredDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<DiscoveredDevice | null>(null);
  const [robot, setRobot] = useState<RobotCom | null>(null);
  const [videoFrame, setVideoFrame] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  // Discover devices
  const discoverDevices = async () => {
    const discovery = new NetworkDiscovery();
    const found = await discovery.discoverDevices(2000);
    setDevices(found);
    discovery.stopDiscovery();
  };

  // Connect to device
  const connectToDevice = async (device: DiscoveredDevice) => {
    const robotCom = new RobotCom();
    robotCom.openTcp(device.ip);
    
    // Wait for connection
    const checkConnection = setInterval(() => {
      if (robotCom.mTcpClient?.getIsConnected()) {
        clearInterval(checkConnection);
        setRobot(robotCom);
        setSelectedDevice(device);
        setConnected(true);
        
        // Send async command registration
        setTimeout(() => {
          robotCom.sendAsynchronousCommand();
        }, 200);
        
        // Start video stream
        startVideoStream(device.ip, robotCom);
      }
    }, 100);

    setTimeout(() => clearInterval(checkConnection), 10000);
  };

  // Start video stream
  const startVideoStream = async (ip: string, robotCom: RobotCom) => {
    // Request video connection
    robotCom.request_video_connection();
    await new Promise(resolve => setTimeout(resolve, 1000));

    const videoStream = new VideoStream();
    const config = await videoStream.requestVideoLink(ip);
    
    if (config) {
      await videoStream.startStreaming(config, (imageData) => {
        setVideoFrame(imageData);
      });
    }
  };

  // Send action
  const sendAction = async (actionMessage: string) => {
    if (!robot || !robot.mTcpClient?.getIsConnected()) {
      console.error('Not connected');
      return;
    }

    robot.sendAsynchronousCommand();
    await new Promise(resolve => setTimeout(resolve, 300));
    robot.sendLUCICommand(245, actionMessage, 2);
  };

  useEffect(() => {
    discoverDevices();
  }, []);

  return (
    <View>
      {!selectedDevice ? (
        <>
          <Button title="Discover Devices" onPress={discoverDevices} />
          <FlatList
            data={devices}
            keyExtractor={(item) => item.ip}
            renderItem={({ item }) => (
              <Button
                title={`${item.name} - ${item.ip}`}
                onPress={() => connectToDevice(item)}
              />
            )}
          />
        </>
      ) : (
        <>
          <Text>Connected to: {selectedDevice.name}</Text>
          {videoFrame && (
            <Image source={{ uri: videoFrame }} style={{ width: 300, height: 200 }} />
          )}
          <Button title="Hello" onPress={() => sendAction('hello')} />
          <Button title="Point Right" onPress={() => sendAction('point_right')} />
          <Button title="Disconnect" onPress={() => {
            robot?.mTcpClient?.stopClient();
            setRobot(null);
            setSelectedDevice(null);
            setConnected(false);
            setVideoFrame(null);
          }} />
        </>
      )}
    </View>
  );
}
```

---

## Summary Checklist

Before integrating, ensure:

- [ ] Native modules are properly installed and linked
- [ ] Network permissions are configured
- [ ] App and robot are on same network
- [ ] TCP/UDP ports are not blocked
- [ ] Error handling is implemented
- [ ] Connection lifecycle is managed (connect/disconnect)
- [ ] Video stream cleanup on unmount
- [ ] Action commands include async registration
- [ ] Testing on actual devices (not just simulator)

---

## Additional Resources

- **LUCI Protocol:** Robot-specific protocol for command/control
- **LSSDP Protocol:** Local Simple Service Discovery Protocol
- **React Native TCP/UDP:** Native socket libraries
- **Expo Image:** For displaying video frames

For questions or issues, refer to the main codebase implementation in:
- `utils/NetworkDiscovery.ts`
- `utils/VideoStream.ts`
- `utils/RobotCom.ts`
- `utils/TcpClient.ts`
