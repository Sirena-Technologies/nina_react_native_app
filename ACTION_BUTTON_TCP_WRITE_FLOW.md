# Action Button TCP Write Flow

This document traces the complete TCP write flow when an action button is pressed in the React Native app.

## TCP Write Flow for Action Buttons

### 1. Entry Point — `handleActionPress()` in `remote.tsx`
```145:166:app/remote.tsx
const handleActionPress = (index: number) => {
  const action = ACTION_ITEMS[index];
  
  // Show toast message
  console.log(action.toast);
  Alert.alert('Action', action.toast, [{ text: 'OK' }]);

  // Check if TCP client is available and connected
  if (!robot.mTcpClient) {
    Alert.alert('Error', 'TCP client not available. Cannot send command.');
    return;
  }

  if (!robot.mTcpClient.getIsConnected()) {
    Alert.alert('Error', 'TCP connection not ready. Please wait for connection to establish.');
    return;
  }

  // Send LUCI command 245 with action message (matches Java: luciControl.SendCommand(245, action_messages[position], LSSDPCONST.LUCI_SET))
  // sendAsynchronousCommand() is already called inside sendLUCICommand() before sending the command
  robot.sendLUCICommand(245, action.message, 0);
};
```

**What happens:**
- User taps an action button (e.g., "Hello", "Relax", "Namaste")
- Extracts action message from `ACTION_ITEMS` array
- Validates TCP client exists and is connected
- Calls `robot.sendLUCICommand(245, action.message, 0)`

---

### 2. LUCI Command Handler — `RobotCom.sendLUCICommand()`
```196:234:utils/RobotCom.ts
public sendLUCICommand(command: number, actionMessage: string, mode: number = 0): void {
  if (!this.mTcpClient) {
    console.warn('TCP client not available. Cannot send LUCI command.');
    return;
  }

  // Check if connection is ready
  if (!this.mTcpClient.getIsConnected()) {
    console.warn('TCP connection not ready. Waiting for connection...');
    // Wait a bit and retry
    setTimeout(() => {
      if (this.mTcpClient && this.mTcpClient.getIsConnected()) {
        this.sendLUCICommand(command, actionMessage, mode);
      } else {
        console.error('TCP connection still not ready after wait');
      }
    }, 500);
    return;
  }

  // Send async command registration first (as per Java implementation)
  // This must be sent before each action command
  this.sendAsynchronousCommand();
  
  // Wait longer to ensure async registration is processed
  // Java code typically waits a bit after registration before sending commands
  setTimeout(() => {
    if (!this.mTcpClient || !this.mTcpClient.getIsConnected()) {
      console.error('TCP connection lost while waiting to send command');
      return;
    }
    
    const actionData = new TextEncoder().encode(actionMessage);
    const lucipacket = this.LUCI_createPacket(command, mode, actionData, null);
    console.log(`Sending LUCI command ${command} with message: ${actionMessage}`);
    console.log(`Packet size: ${lucipacket.length} bytes (header: 10, payload: ${actionData.length})`);
    this.sendMessageBytes(lucipacket);
  }, 300); // Increased delay to ensure async command is processed
}
```

**What happens:**
1. **Connection validation**: Checks if TCP client is connected
2. **Async registration**: Calls `sendAsynchronousCommand()` first (sends command 3)
3. **Packet creation**: After 300ms delay:
   - Encodes action message to UTF-8 bytes
   - Creates LUCI packet via `LUCI_createPacket()`
   - Calls `sendMessageBytes()` with the packet

**LUCI Packet Format:**
```100:140:utils/RobotCom.ts
public LUCI_createPacket(
  mbnum: number,
  mode: number,
  packet0: Uint8Array,
  packet1: Uint8Array | null
): Uint8Array {
  // Java LUCIPacket format: 10-byte header + payload
  const HEADER_SIZE = 10;
  const remoteID = 0; // Always 0
  const CommandType = mode; // cmd_type (0 = SET, 1 = GET, 2 = default)
  const Command = mbnum; // Command number
  const CommandStatus = 0; // Always 0
  const CRC = 0; // Always 0
  const DataLen = packet0.length; // Payload length

  // Create header (10 bytes) - matching Java format exactly
  const header = new Uint8Array(HEADER_SIZE);
  header[0] = remoteID & 0xFF; // remoteID low byte
  header[1] = (remoteID >> 8) & 0xFF; // remoteID high byte
  header[2] = CommandType; // CommandType
  header[3] = Command & 0xFF; // Command low byte
  header[4] = (Command >> 8) & 0xFF; // Command high byte
  header[5] = CommandStatus; // CommandStatus
  header[6] = CRC & 0xFF; // CRC low byte
  header[7] = (CRC >> 8) & 0xFF; // CRC high byte
  header[8] = DataLen & 0xFF; // DataLen low byte
  header[9] = (DataLen >> 8) & 0xFF; // DataLen high byte

  // Create complete packet: header + payload
  const LUCI_packet = new Uint8Array(HEADER_SIZE + DataLen);
  LUCI_packet.set(header, 0);
  if (DataLen > 0) {
    LUCI_packet.set(packet0, HEADER_SIZE);
  }

  return LUCI_packet;
}
```

**Packet Structure:**
- **Header (10 bytes)**: `[remoteID(2), CommandType(1), Command(2), CommandStatus(1), CRC(2), DataLen(2)]`
- **Payload**: Action message bytes (e.g., "hello", "relax", "namaste")
- **Example**: Command 245, message "hello" → 10-byte header + 5-byte payload = 15 bytes total

---

### 3. Message Dispatcher — `RobotCom.sendMessageBytes()`
```48:58:utils/RobotCom.ts
public sendMessageBytes(data: Uint8Array): void {
  if (this.mTcpClient) {
    try {
      this.mTcpClient.sendMessageBytes(data);
    } catch (error) {
      console.error('Error sending message bytes:', error);
    }
  } else {
    console.warn('TCP client not available. Cannot send message.');
  }
}
```

**What happens:**
- Simple wrapper that delegates to `TcpClient.sendMessageBytes()`
- Passes the LUCI packet (Uint8Array) to the TCP client

---

### 4. TCP Client Write — `TcpClient.sendMessageBytes()`
```76:151:utils/TcpClient.ts
public sendMessageBytes(msg: Uint8Array): void {
  if (!this.socket) {
    console.warn('[WRITE] TCP socket not available. Cannot send message.');
    return;
  }

  if (!this.isConnected) {
    console.warn('[WRITE] TCP socket not connected. Cannot send message.');
    return;
  }

  // Wait for connection to be fully ready (if not yet ready)
  if (!this.connectionReady) {
    console.warn('[WRITE] Connection not fully ready yet, waiting...');
    setTimeout(() => {
      if (this.connectionReady) {
        this.sendMessageBytes(msg);
      } else {
        console.error('[WRITE] Connection still not ready after wait');
      }
    }, 100);
    return;
  }
  
  try {
    // Convert Uint8Array to Buffer (Java uses DataOutputStream.write(byte[]))
    // react-native-tcp-socket expects Buffer or array for binary data
    let buffer: any;
    if (typeof Buffer !== 'undefined') {
      buffer = Buffer.from(msg);
    } else {
      // Fallback: convert to array (should work with react-native-tcp-socket)
      buffer = Array.from(msg);
    }
    
    // Log what we're about to send (first 20 bytes in hex)
    const preview = Array.from(msg.slice(0, Math.min(20, msg.length)))
      .map(b => '0x' + b.toString(16).padStart(2, '0'))
      .join(' ');
    console.log(`[WRITE] Attempting to write ${msg.length} bytes. Preview: ${preview}...`);
    
    // Java: sWriter.write(msg) - direct write to DataOutputStream
    // react-native-tcp-socket: socket.write(buffer) - should work similarly
    
    // Verify socket has write method
    if (typeof this.socket.write !== 'function') {
      throw new Error('Socket write method not available');
    }
    
    // Write directly - matching Java's DataOutputStream.write() behavior
    // react-native-tcp-socket write() should accept Buffer/Array directly
    const writeResult = this.socket.write(buffer);
    
    // Log result
    console.log(`[WRITE] socket.write() called. Return value: ${writeResult} (type: ${typeof writeResult})`);
    
    // In Java, DataOutputStream.write() doesn't return anything, it just writes
    // In react-native-tcp-socket, write() may return boolean (true/false) or undefined
    if (writeResult === false) {
      console.warn('[WRITE] Write returned false - buffer may be full');
    } else {
      console.log(`[WRITE] ✓ Write call completed successfully for ${msg.length} bytes`);
    }
    
    // Small delay after write (Java does Thread.sleep(delay))
    // This prevents overwhelming the socket
    setTimeout(() => {}, this.delay);
    
  } catch (error) {
    console.error('[WRITE] ERROR sending TCP message:', error);
    if (error instanceof Error) {
      console.error('[WRITE] Error details:', error.message);
      console.error('[WRITE] Stack:', error.stack);
    }
  }
}
```

**What happens:**
1. **Validation**: Checks socket exists and is connected
2. **Connection readiness**: Waits for `connectionReady` flag (set after connection stabilizes)
3. **Buffer conversion**: Converts `Uint8Array` to `Buffer` (or Array fallback)
4. **TCP write**: Calls `socket.write(buffer)` ← **ACTUAL TCP WRITE**
5. **Logging**: Logs write result and preview of data
6. **Delay**: Small delay (35ms default) to prevent overwhelming socket

---

### 5. Native TCP Socket — `socket.write()` (react-native-tcp-socket)
```127:127:utils/TcpClient.ts
const writeResult = this.socket.write(buffer);
```

**What happens:**
- `socket.write()` is provided by `react-native-tcp-socket` library
- This is a native module that wraps the platform's TCP socket API:
  - **Android**: Uses Java `Socket.getOutputStream().write()`
  - **iOS**: Uses Swift `OutputStream.write()`
- The buffer is written directly to the TCP socket's output stream
- Returns `true` if data was queued, `false` if buffer is full

**Socket Creation:**
```306:330:utils/TcpClient.ts
this.socket = TcpSocket.createConnection(options, () => {
  console.log('TCP Client: Connected to', this.SERVER_IP + ':' + this.SERVER_PORT);
  this.isConnected = true;
  
  // Verify socket has write method (critical for sending data)
  if (this.socket) {
    if (typeof this.socket.write === 'function') {
      console.log('✓ Socket write method verified');
      // Wait a small moment for connection to fully stabilize (like Java does)
      setTimeout(() => {
        this.connectionReady = true;
        console.log('✓ Connection fully ready for writes');
      }, 50);
    } else {
      console.error('✗ Socket write method NOT available after connection!');
      this.isConnected = false;
    }
  } else {
    console.error('✗ Socket is null after connection!');
    this.isConnected = false;
  }
});
```

---

## Complete Flow Summary

```
User taps action button
    ↓
handleActionPress() in remote.tsx
    ↓
robot.sendLUCICommand(245, "hello", 0)
    ↓
RobotCom.sendLUCICommand()
    ├─→ sendAsynchronousCommand() (command 3)
    └─→ setTimeout(300ms)
        └─→ LUCI_createPacket(245, 0, "hello" bytes)
        └─→ sendMessageBytes(lucipacket)
            ↓
RobotCom.sendMessageBytes()
    ↓
TcpClient.sendMessageBytes()
    ├─→ Convert Uint8Array → Buffer
    └─→ socket.write(buffer) ← ACTUAL TCP WRITE
        ↓
react-native-tcp-socket native module
    ↓
Platform TCP socket (Android/iOS)
    ↓
Network → Robot (IP:7777)
```

---

## Technical Details

### Protocol
- **Protocol**: LUCI (Libre Unified Control Interface)
- **Port**: 7777 (control port)
- **Command**: 245 (action command)
- **Mode**: 0 (LUCI_SET)

### Packet Format
- **Header**: 10 bytes
  - `[remoteID(2), CommandType(1), Command(2), CommandStatus(1), CRC(2), DataLen(2)]`
- **Payload**: UTF-8 encoded action message (e.g., "hello", "relax", "namaste")

### Action Messages
Pre-defined actions from `ACTION_ITEMS`:
- `"Neutral"` → Neutralize robot
- `"point_right"` → Point right gesture
- `"hello"` → Hello wave
- `"relax"` → Relax pose
- `"namaste"` → Namaste gesture
- `"point_left"` → Point left gesture
- `"head_node"` → Head nod

### Async Command Registration
Before each action command, the app sends:
- **Command 3** with empty data (async registration)
- **Wait 300ms** for registration to be processed
- **Then send** command 245 with action message

### Library Stack
1. **React Native**: UI layer (`remote.tsx`)
2. **TypeScript**: Business logic (`RobotCom.ts`, `TcpClient.ts`)
3. **react-native-tcp-socket**: Native TCP socket wrapper
4. **Platform Native**: Android Java Socket / iOS Swift Socket
5. **Network Stack**: TCP/IP → Robot device

---

## Differences from Java Implementation

### Java Flow (for comparison)
```
LUCIControl.SendCommand(245, "hello", LUCI_SET)
    ↓
TcpSendData(NettyAndroidClient, message)
    ↓
NettyAndroidClient.write(bytes)
    ↓
NettyClientHandler.write(bytes)
    ↓
Channel.writeAndFlush(ByteBuf).sync()
    ↓
Netty TCP Channel → Robot
```

### React Native Flow
```
handleActionPress() → sendLUCICommand(245, "hello", 0)
    ↓
TcpClient.sendMessageBytes(Uint8Array)
    ↓
socket.write(Buffer)
    ↓
react-native-tcp-socket native module
    ↓
Platform TCP Socket → Robot
```

**Key Differences:**
- **Java**: Uses Netty framework with `ByteBuf` and `writeAndFlush().sync()`
- **React Native**: Uses `react-native-tcp-socket` with `Buffer` and `socket.write()`
- **Java**: Synchronous write with `.sync()` wait
- **React Native**: Asynchronous write (returns immediately, may return `false` if buffer full)
- **Java**: Connection managed via Netty `Channel`
- **React Native**: Connection managed via `TcpSocket.createConnection()`

---

## Error Handling

1. **TCP client not available**: Alert shown to user
2. **Connection not ready**: Retry after 500ms delay
3. **Connection lost during wait**: Error logged, command not sent
4. **Write fails**: Error logged with stack trace
5. **Buffer full**: Write returns `false`, warning logged

---

## Example: Sending "Hello" Action

1. User taps "Hello" button
2. `handleActionPress(2)` called (index 2 = "Hello")
3. `action.message = "hello"`
4. `robot.sendLUCICommand(245, "hello", 0)`
5. `sendAsynchronousCommand()` → sends command 3 packet
6. Wait 300ms
7. `LUCI_createPacket(245, 0, [104, 101, 108, 108, 111])` → creates 15-byte packet
8. `sendMessageBytes([0, 0, 0, 245, 0, 0, 0, 0, 5, 0, 104, 101, 108, 108, 111])`
9. `socket.write(Buffer.from([...]))` → **TCP write to robot IP:7777**
10. Robot receives packet, executes "hello" action

---

## Notes

- The actual TCP socket write happens in `TcpClient.sendMessageBytes()` via `socket.write()`
- The socket is created by `react-native-tcp-socket` library's `createConnection()`
- All writes go through the same TCP connection (port 7777)
- Connection is persistent and reused for all commands
- Async command registration (command 3) must be sent before each action command
