// Note: react-native-udp may require native module setup
// This is a placeholder implementation that may need adjustment based on the actual library API
let dgram: any = null;

function initializeUdpLibrary(): boolean {
  if (dgram !== null) {
    return dgram !== undefined;
  }
  
  try {
    const udpModule = require('react-native-udp');
    // Check if the module is properly initialized
    if (udpModule && typeof udpModule.createSocket === 'function') {
      dgram = udpModule;
      return true;
    } else if (udpModule && udpModule.default && typeof udpModule.default.createSocket === 'function') {
      dgram = udpModule.default;
      return true;
    } else {
      console.warn('react-native-udp module found but createSocket is not available');
      dgram = undefined;
      return false;
    }
  } catch (e) {
    console.warn('react-native-udp not available:', e);
    dgram = undefined;
    return false;
  }
}

export interface DiscoveredDevice {
  name: string;
  ip: string;
  port?: number;
  deviceState?: string;
  zoneId?: string;
  streamUrl?: string;
  macAddress?: string;
}

export class NetworkDiscovery {
  private socket: any = null;
  private devices: DiscoveredDevice[] = [];
  private isDiscovering: boolean = false;
  private isSocketClosing: boolean = false;

  public async discoverDevices(timeout: number = 2000): Promise<DiscoveredDevice[]> {
    return new Promise((resolve) => {
      this.devices = [];
      this.isDiscovering = true;

      // Initialize and check if UDP library is available
      const isUdpAvailable = initializeUdpLibrary();
      
      if (!isUdpAvailable || !dgram) {
        // Only warn once, not on every discovery attempt
        if (this.devices.length === 0) {
          console.warn('UDP library not available. Build a development build (npm run android) - Expo Go does not support native modules.');
        }
        setTimeout(() => {
          this.isDiscovering = false;
          resolve(this.devices);
        }, timeout);
        return;
      }

      try {
        // Double-check createSocket exists before calling
        if (!dgram || typeof dgram.createSocket !== 'function') {
          throw new Error('UDP createSocket is not available - native module not linked');
        }
        
        let socket;
        try {
          // This call may fail if native module is not linked, even though the JS module loaded
          socket = dgram.createSocket('udp4');
        } catch (createError: any) {
          // Handle case where native module is null (common error when native module not linked)
          const errorMsg = createError?.message || String(createError) || '';
          const errorStr = errorMsg.toLowerCase();
          
          // Check for various patterns indicating native module not linked
          if (
            errorStr.includes('null') || 
            errorStr.includes('cannot read property') ||
            errorStr.includes('createsocket') ||
            errorStr.includes('undefined') ||
            createError?.name === 'TypeError'
          ) {
            // Native module not initialized - return empty list gracefully
            // Only log once to reduce console spam
            if (!this.isDiscovering) {
              console.warn('UDP native module not initialized. Build a development build (not Expo Go) for native modules to work.');
            }
            this.isDiscovering = false;
            resolve(this.devices);
            return;
          }
          // Re-throw other errors
          throw createError;
        }
        
        if (!socket) {
          throw new Error('Failed to create UDP socket');
        }
        
        this.socket = socket;
        this.isSocketClosing = false;

        socket.bind(1800, () => {
          // Check if socket is still valid and not closing
          if (this.isSocketClosing || !socket || socket !== this.socket) {
            console.warn('[UDP] Socket was closed before bind callback completed');
            return;
          }

          // setBroadcast() - wrap in try-catch to handle closed socket errors
          try {
            if (socket && typeof socket.setBroadcast === 'function') {
              socket.setBroadcast(true);
            } else {
              console.warn('[UDP] setBroadcast() not available');
            }
          } catch (error: any) {
            // Socket might be closed - this is expected if discovery was stopped
            if (error?.message?.includes('closed') || error?.key === 'setBroadcast') {
              console.warn('[UDP] Socket closed before setBroadcast() - discovery may have been stopped');
              return;
            }
            console.error('[UDP] Error setting broadcast:', error);
          }
          
          // Check again before continuing
          if (this.isSocketClosing || !socket || socket !== this.socket) {
            return;
          }
          
          // setMulticastTTL() may not be implemented in react-native-udp
          // Wrap in try-catch to handle gracefully
          try {
            if (socket && typeof socket.setMulticastTTL === 'function') {
              socket.setMulticastTTL(128);
            } else {
              console.warn('[UDP] setMulticastTTL() not available in react-native-udp - continuing without it');
            }
          } catch (error: any) {
            // Method not implemented - this is expected for react-native-udp
            // Multicast should still work without setting TTL
            if (error?.message?.includes('closed') || error?.key === 'setMulticastTTL') {
              console.warn('[UDP] Socket closed before setMulticastTTL()');
              return;
            }
            console.warn('[UDP] setMulticastTTL() not implemented - continuing without it');
          }
          
          // Check again before continuing
          if (this.isSocketClosing || !socket || socket !== this.socket) {
            return;
          }
          
          try {
            if (socket && typeof socket.addMembership === 'function') {
              socket.addMembership('239.255.255.250');
            }
          } catch (error: any) {
            if (error?.message?.includes('closed') || error?.key === 'addMembership') {
              console.warn('[UDP] Socket closed before addMembership()');
              return;
            }
            console.error('[UDP] Error joining multicast group:', error);
          }
          
          // Final check before sending
          if (this.isSocketClosing || !socket || socket !== this.socket) {
            return;
          }

          // LSSDP M-SEARCH request format:
          // M-SEARCH * HTTP/1.1\r\n
          // HOST: 239.255.255.250:1800\r\n\r\n
          // PROTOCOL:Version 1.0
          const msg = 'M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1800\r\n\r\nPROTOCOL:Version 1.0\r\n';
          // Convert string to buffer/array
          let message: any;
          if (typeof Buffer !== 'undefined') {
            message = Buffer.from(msg);
          } else {
            message = new TextEncoder().encode(msg);
          }
          const port = 1800;
          const address = '239.255.255.250';

          const messageLength = message.length || message.byteLength || msg.length;
          
          // Check socket is still valid before sending
          if (this.isSocketClosing || !socket || socket !== this.socket) {
            console.warn('[UDP] Socket closed before send()');
            return;
          }
          
          try {
            socket.send(message, 0, messageLength, port, address, (err: any) => {
              if (err) {
                // Don't log errors if socket was intentionally closed
                if (!this.isSocketClosing && !err.message?.includes('closed')) {
                  console.error('[UDP] Error sending discovery message:', err);
                }
                this.isDiscovering = false;
                resolve(this.devices);
              }
            });
          } catch (error: any) {
            if (!this.isSocketClosing && !error?.message?.includes('closed')) {
              console.error('[UDP] Error in send():', error);
            }
            this.isDiscovering = false;
            resolve(this.devices);
          }
        });

        socket.on('message', (msg: any, rinfo: any) => {
          // Convert buffer/array to string
          let received: string;
          if (typeof Buffer !== 'undefined' && Buffer.isBuffer(msg)) {
            received = msg.toString();
          } else if (msg instanceof Uint8Array) {
            received = new TextDecoder().decode(msg);
          } else if (typeof msg === 'string') {
            received = msg;
          } else {
            received = String.fromCharCode.apply(null, Array.from(msg));
          }
          // Parse LSSDP M-SEARCH response:
          // HTTP/1.1 200 OK\r\n
          // HOST: 239.255.255.250:1800\r\n
          // PROTOCOL: Version 1.0
          // DeviceName: Libre Node XXXXX\r\n
          // DeviceState: M\r\n
          // PORT: 3333\r\n
          // ZoneID: XXXX-XXXX-XXXX-XXXX
          // StreamURL: 239:255:255:251:3000\r\n
          
          if (received.includes('HTTP/1.1 200 OK') || received.includes('DeviceName:')) {
            let deviceName: string | undefined = undefined;
            if (received.includes('DeviceName:')) {
              deviceName = received.split('DeviceName:')[1].split('\r\n')[0].trim();
            }
            
            if (!deviceName) {
              return; // Skip if no device name
            }
            
            const deviceIp = rinfo.address;
            
            // Extract PORT
            let port: number | undefined = undefined;
            if (received.includes('PORT:')) {
              try {
                const portStr = received.split('PORT:')[1].split('\r\n')[0].trim();
                port = parseInt(portStr, 10);
              } catch (e) {
                // Ignore parse errors
              }
            }
            
            // Extract DeviceState
            let deviceState: string | undefined = undefined;
            if (received.includes('DeviceState:')) {
              deviceState = received.split('DeviceState:')[1].split('\r\n')[0].trim();
            }
            
            // Extract ZoneID
            let zoneId: string | undefined = undefined;
            if (received.includes('ZoneID:')) {
              zoneId = received.split('ZoneID:')[1].split('\r\n')[0].trim();
            }
            
            // Extract StreamURL
            let streamUrl: string | undefined = undefined;
            if (received.includes('StreamURL:')) {
              streamUrl = received.split('StreamURL:')[1].split('\r\n')[0].trim();
            }
            
            // Try to extract MAC address from response if available (not in standard LSSDP)
            let macAddress: string | undefined = undefined;
            if (received.includes('DeviceMAC:')) {
              macAddress = received.split('DeviceMAC:')[1].split('\r\n')[0].trim();
            } else if (received.includes('MAC:')) {
              macAddress = received.split('MAC:')[1].split('\r\n')[0].trim();
            } else if (received.includes('MacAddress:')) {
              macAddress = received.split('MacAddress:')[1].split('\r\n')[0].trim();
            }
            
            // Check if device already exists
            const exists = this.devices.some(d => d.ip === deviceIp);
            if (!exists) {
              this.devices.push({
                name: deviceName,
                ip: deviceIp,
                port: port,
                deviceState: deviceState,
                zoneId: zoneId,
                streamUrl: streamUrl,
                macAddress: macAddress,
              });
            }
          }
        });

        socket.on('error', (err: any) => {
          // Don't log errors if socket was intentionally closed
          if (!this.isSocketClosing) {
            // Only log if it's not a "closed" error
            if (!err?.message?.includes('closed') && err?.key !== 'setBroadcast') {
              console.error('[UDP] Discovery socket error:', err);
            }
          }
          this.isDiscovering = false;
          resolve(this.devices);
        });

        // Set timeout
        setTimeout(() => {
          this.isDiscovering = false;
          this.isSocketClosing = true;
          if (socket && socket === this.socket) {
            try {
              socket.close();
            } catch (error) {
              // Socket might already be closed
              console.warn('[UDP] Error closing socket in timeout:', error);
            }
          }
          resolve(this.devices);
        }, timeout);
      } catch (error) {
        console.error('Error in discoverDevices:', error);
        this.isDiscovering = false;
        resolve(this.devices);
      }
    });
  }

  public stopDiscovery(): void {
    this.isSocketClosing = true;
    this.isDiscovering = false;
    if (this.socket) {
      try {
        this.socket.close();
      } catch (error) {
        // Socket might already be closed
        console.warn('[UDP] Error closing socket in stopDiscovery():', error);
      }
      this.socket = null;
    }
  }
}
