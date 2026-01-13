// Note: react-native-tcp-socket requires native module setup
let TcpSocket: any = null;

function initializeTcpLibrary(): boolean {
  if (TcpSocket !== null) {
    return TcpSocket !== undefined;
  }
  
  try {
    const tcpModule = require('react-native-tcp-socket');
    // Check if the module is properly initialized
    if (tcpModule && typeof tcpModule.createConnection === 'function') {
      TcpSocket = tcpModule;
      return true;
    } else if (tcpModule && tcpModule.default && typeof tcpModule.default.createConnection === 'function') {
      TcpSocket = tcpModule.default;
      return true;
    } else {
      console.warn('react-native-tcp-socket module found but createConnection is not available');
      TcpSocket = undefined;
      return false;
    }
  } catch (e) {
    console.warn('react-native-tcp-socket not available:', e);
    TcpSocket = undefined;
    return false;
  }
}

export interface OnMessageReceived {
  messageReceived: (message: string) => void;
}

export class TcpClient {
  public SERVER_IP: string = '';
  public SERVER_PORT: number = 7777;
  public delay: number = 35;
  private mMessageListener: OnMessageReceived | null = null;
  private mRun: boolean = false;
  private socket: any = null;
  private writeStream: any = null;
  private isConnected: boolean = false;
  private connectionReady: boolean = false; // Track if connection is fully ready for writes

  public getSocket(): any {
    return this.socket;
  }

  constructor(listener: OnMessageReceived) {
    this.mMessageListener = listener;
  }

  public sendMessage(message: string): void {
    if (!this.socket) {
      console.warn('TCP socket not available. Cannot send message.');
      return;
    }

    if (!this.isConnected) {
      console.warn('TCP socket not connected. Cannot send message.');
      return;
    }
    
    try {
      // Try to write - react-native-tcp-socket may not have writable property
      this.socket.write(message + '\n', (error?: any) => {
        if (error) {
          console.error('Error writing to TCP socket:', error);
        }
      });
    } catch (error) {
      console.error('Error sending TCP message:', error);
    }
  }

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
        console.warn('[WRITE] ⚠ Write returned false - buffer may be full. Consider implementing backpressure handling.');
        // Note: When write returns false, the socket will emit 'drain' event when ready
        // Try again after a short delay
        setTimeout(() => {
          if (this.socket && this.isConnected && this.connectionReady) {
            console.log('[WRITE] Retrying write after buffer drain...');
            const retryResult = this.socket.write(buffer);
            if (retryResult !== false) {
              console.log(`[WRITE] ✓ Retry successful for ${msg.length} bytes`);
            }
          }
        }, 50);
      } else {
        console.log(`[WRITE] ✓ Write call completed successfully for ${msg.length} bytes`);
        // Log confirmation that data was queued
        console.log(`[WRITE] Data queued to socket buffer, will be sent to ${this.SERVER_IP}:${this.SERVER_PORT}`);
      }
      
      // Note: In Java, Thread.sleep(delay) blocks synchronously
      // In JavaScript, we can't block, so the delay is handled by the async nature
      // and the socket's internal buffering. The delay property is kept for compatibility
      // but doesn't need to be implemented here as writes are already asynchronous.
      
    } catch (error) {
      console.error('[WRITE] ERROR sending TCP message:', error);
      if (error instanceof Error) {
        console.error('[WRITE] Error details:', error.message);
        console.error('[WRITE] Stack:', error.stack);
      }
    }
  }

  public readVideo(): Uint8Array {
    if (!this.socket) {
      return new Uint8Array(0);
    }

    try {
      // Try to read available data (non-blocking)
      // In React Native, we need to handle this via event listeners
      // This is a synchronous wrapper that returns what's immediately available
      return new Uint8Array(0);
    } catch (error) {
      console.error('Error reading video:', error);
      return new Uint8Array(0);
    }
  }

  /**
   * Read video data asynchronously
   * Returns a promise that resolves with video chunk when available
   */
  public readVideoAsync(maxSize: number = 1024): Promise<Uint8Array> {
    return new Promise((resolve) => {
      if (!this.socket) {
        resolve(new Uint8Array(0));
        return;
      }

      const chunks: number[] = [];
      let totalSize = 0;

      const dataHandler = (data: any) => {
        let bytes: number[];
        if (typeof Buffer !== 'undefined' && Buffer.isBuffer(data)) {
          bytes = Array.from(data);
        } else if (data instanceof Uint8Array) {
          bytes = Array.from(data);
        } else if (Array.isArray(data)) {
          bytes = data;
        } else {
          bytes = Array.from(new Uint8Array(data));
        }

        chunks.push(...bytes);
        totalSize += bytes.length;

        if (totalSize >= maxSize) {
          this.socket?.removeListener('data', dataHandler);
          resolve(new Uint8Array(chunks));
        }
      };

      this.socket.on('data', dataHandler);

      // Timeout after 100ms
      setTimeout(() => {
        this.socket?.removeListener('data', dataHandler);
        resolve(new Uint8Array(chunks));
      }, 100);
    });
  }

  public readMessage(): Promise<Uint8Array> {
    return new Promise((resolve) => {
      if (!this.socket) {
        resolve(new Uint8Array(0));
        return;
      }

      const buflist: number[] = [];
      let count = 0;
      const maxCount = 8192;

      const dataHandler = (data: any) => {
        // Convert buffer/array to number array
        let bytes: number[];
        if (typeof Buffer !== 'undefined' && Buffer.isBuffer(data)) {
          bytes = Array.from(data);
        } else if (data instanceof Uint8Array) {
          bytes = Array.from(data);
        } else if (Array.isArray(data)) {
          bytes = data;
        } else {
          bytes = Array.from(new Uint8Array(data));
        }
        buflist.push(...bytes);
        count += bytes.length;

        if (count >= maxCount) {
          this.socket?.removeListener('data', dataHandler);
          resolve(new Uint8Array(buflist));
        }
      };

      this.socket.on('data', dataHandler);

      // Timeout after 100ms if no data
      setTimeout(() => {
        this.socket?.removeListener('data', dataHandler);
        resolve(new Uint8Array(buflist));
      }, 100);
    });
  }

  public stopClient(): void {
    this.mRun = false;
    this.isConnected = false;
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
    this.mMessageListener = null;
  }

  public getIsConnected(): boolean {
    return this.isConnected && this.socket !== null;
  }

  /**
   * Send asynchronous command registration packet
   * This must be sent before each action command (as per Java implementation)
   * Java sends: SendCommand(3, localIP + "," + 3333, LSSDPCONST.LUCI_SET)
   * For now, we send command 3 with empty data (device will use default)
   */
  public sendAsynchronousCommand(): void {
    if (this.SERVER_PORT === 7777 && this.isConnected) {
      // Note: Java sends local IP + port 3333, but we can't easily get local IP in React Native
      // Sending empty data for now - the device should still register us
      // TODO: Get local IP address and send "IP,3333" format
      const emptyData = new Uint8Array(0);
      // This will be handled by RobotCom.sendLUCICommand with proper packet format
      console.log('Async command registration should be sent via RobotCom');
    }
  }

  public run(): void {
    this.mRun = true;

    // Initialize and check if TCP library is available
    const isTcpAvailable = initializeTcpLibrary();
    
    if (!isTcpAvailable || !TcpSocket) {
      console.warn('TCP library not available. Native module may not be linked. Run "npx expo prebuild" to link native modules.');
      this.mRun = false;
      return;
    }

    const options = {
      port: this.SERVER_PORT,
      host: this.SERVER_IP,
      noDelay: true, // Disable Nagle algorithm - send data immediately without buffering
      // This ensures packets are sent immediately, matching Java's writeAndFlush().sync() behavior
    };

    try {
      // This call may fail if native module is not linked
      this.socket = TcpSocket.createConnection(options, () => {
        console.log('[TCP] Client: Connected to', this.SERVER_IP + ':' + this.SERVER_PORT);
        console.log('[TCP] noDelay enabled - data will be sent immediately without buffering');
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
        
        // Note: Async registration is now handled by RobotCom.sendAsynchronousCommand()
        // which sends proper LUCI packet format (command 3)
      });

      this.socket.on('error', (error: any) => {
        // Only log detailed errors for control port (7777), not video port (10000)
        // Video port errors are expected if video is not enabled
        const errorMsg = error?.message || String(error) || '';
        if (this.SERVER_PORT === 7777) {
          // Control port - log all errors
          console.error('[TCP] Client: Socket Error', error);
          console.error('[TCP] Error details:', JSON.stringify(error));
        } else {
          // Video port - only log if not connection refused
          if (!errorMsg.includes('ECONNREFUSED') && !errorMsg.includes('Connection refused')) {
            console.error('[VIDEO] TCP Client: Socket Error', error);
          } else {
            console.log('[VIDEO] Connection refused - video stream may not be enabled');
          }
        }
        this.isConnected = false;
      });

      // Listen for write errors specifically
      this.socket.on('drain', () => {
        console.log('TCP socket buffer drained - ready for more data');
      });

      // Check if socket has write method
      if (typeof this.socket.write !== 'function') {
        console.error('Socket does not have write method!');
        this.isConnected = false;
      } else {
        console.log('Socket write method is available');
      }

      this.socket.on('data', (data: any) => {
        // Convert data to Uint8Array for processing
        let bytes: Uint8Array;
        if (typeof Buffer !== 'undefined' && Buffer.isBuffer(data)) {
          bytes = new Uint8Array(data);
        } else if (data instanceof Uint8Array) {
          bytes = data;
        } else if (Array.isArray(data)) {
          bytes = new Uint8Array(data);
        } else {
          bytes = new Uint8Array(data);
        }

        // Only process data on control port (7777), not video port
        if (this.SERVER_PORT !== 7777) {
          // This is video data, don't parse as LUCI
          return;
        }

        // Check if this looks like video data (JPEG or START marker)
        if (bytes.length > 0) {
          // Check for JPEG header (0xFF 0xD8) or START marker
          if ((bytes[0] === 0xFF && bytes[1] === 0xD8) || 
              (bytes.length >= 5 && bytes[0] === 0x53 && bytes[1] === 0x54 && bytes[2] === 0x41 && bytes[3] === 0x52 && bytes[4] === 0x54)) {
            // This is video data, ignore it
            console.log(`Ignoring video data on control port (${bytes.length} bytes)`);
            return;
          }
        }

        console.log(`Received ${bytes.length} bytes from TCP socket (control)`);
        if (bytes.length > 0 && bytes.length <= 100) {
          // Log first few bytes for debugging (only for small packets)
          const preview = Array.from(bytes.slice(0, Math.min(20, bytes.length)))
            .map(b => '0x' + b.toString(16).padStart(2, '0'))
            .join(' ');
          console.log(`Data preview: ${preview}...`);
        }

        if (this.mMessageListener) {
          // Try to parse as LUCI packet
          // Valid LUCI packet: 10-byte header + payload
          // Header format: [remoteID(2), CommandType(1), Command(2), CommandStatus(1), CRC(2), DataLen(2)]
          if (bytes.length >= 10) {
            // Parse LUCI packet header
            const remoteID = bytes[0] | (bytes[1] << 8);
            const commandType = bytes[2];
            const command = bytes[3] | (bytes[4] << 8);
            const commandStatus = bytes[5];
            const dataLen = bytes[8] | (bytes[9] << 8);
            
            // Validate: remoteID should be 0, commandType should be 0-2, dataLen should be reasonable
            // Also check if this looks like a valid LUCI packet (not video data)
            const isValidLUCI = remoteID === 0 && 
                                commandType <= 2 && 
                                dataLen < 10000 && // Reasonable max payload size
                                dataLen >= 0 &&
                                bytes.length >= 10 + dataLen;
            
            if (isValidLUCI) {
              console.log(`LUCI Response - Command: ${command}, CommandType: ${commandType}, DataLen: ${dataLen}`);
              
              // Extract payload
              if (dataLen > 0) {
                const payload = bytes.slice(10, 10 + dataLen);
                try {
                  const message = new TextDecoder().decode(payload);
                  console.log(`LUCI Response payload: ${message}`);
                  this.mMessageListener.messageReceived(message);
                } catch (e) {
                  console.warn('Failed to decode LUCI payload as text:', e);
                  // Try to send raw payload
                  this.mMessageListener.messageReceived(String.fromCharCode(...Array.from(payload)));
                }
              } else {
                // Empty payload, just acknowledge
                console.log('LUCI Response with empty payload');
                this.mMessageListener.messageReceived('');
              }
            } else {
              // Doesn't look like a valid LUCI packet, might be video data or corrupted
              console.log(`Data doesn't match LUCI packet format (remoteID=${remoteID}, cmdType=${commandType}, dataLen=${dataLen})`);
              // Don't try to parse as text, might be binary video data
            }
          } else if (bytes.length > 0 && bytes.length < 10) {
            // Too short to be LUCI packet, might be a partial response or error
            console.log(`Received short data (${bytes.length} bytes), might be partial LUCI packet`);
            // Try to decode as text for small responses
            try {
              const message = new TextDecoder().decode(bytes);
              if (message.length < 50) { // Only for short text messages
                console.log(`Short text response: ${message}`);
                this.mMessageListener.messageReceived(message);
              }
            } catch (e) {
              // Ignore binary data
            }
          }
        }
      });

      this.socket.on('close', () => {
        console.log('TCP Client: Connection closed');
        this.mRun = false;
        this.isConnected = false;
        this.connectionReady = false;
      });
    } catch (error: any) {
      // Handle case where native module is null
      const errorMsg = error?.message || String(error) || '';
      const errorStr = errorMsg.toLowerCase();
      
      if (
        errorStr.includes('null') || 
        errorStr.includes('cannot read property') ||
        errorStr.includes('connect') ||
        errorStr.includes('creatconnection') ||
        error?.name === 'TypeError'
      ) {
        console.warn('TCP native module not initialized. Run "npx expo prebuild" to link native modules.');
        this.mRun = false;
        this.socket = null;
      } else {
        console.error('TCP Client: Connection error', error);
        this.mRun = false;
      }
    }
  }
}
