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
  macAddress?: string;
}

export class NetworkDiscovery {
  private socket: any = null;
  private devices: DiscoveredDevice[] = [];
  private isDiscovering: boolean = false;

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

        socket.bind(1800, () => {
          socket.setBroadcast(true);
          socket.setMulticastTTL(128);
          
          try {
            socket.addMembership('239.255.255.250');
          } catch (error) {
            console.error('Error joining multicast group:', error);
          }

          const msg = 'M-SEARCH * HTTP/1.1\r\n';
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
          socket.send(message, 0, messageLength, port, address, (err: any) => {
            if (err) {
              console.error('Error sending discovery message:', err);
              this.isDiscovering = false;
              resolve(this.devices);
            }
          });
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
          if (received.includes('DeviceName:')) {
            const deviceName = received.split('DeviceName:')[1].split('\r\n')[0];
            const deviceIp = rinfo.address;
            
            // Try to extract MAC address from response if available
            let macAddress: string | undefined = undefined;
            if (received.includes('DeviceMAC:')) {
              macAddress = received.split('DeviceMAC:')[1].split('\r\n')[0].trim();
            } else if (received.includes('MAC:')) {
              macAddress = received.split('MAC:')[1].split('\r\n')[0].trim();
            } else if (received.includes('MacAddress:')) {
              macAddress = received.split('MacAddress:')[1].split('\r\n')[0].trim();
            }
            
            // If MAC not in response, try to get it via ARP (requires native module)
            // For now, we'll leave it undefined if not in response
            // TODO: Implement ARP lookup if needed
            
            // Check if device already exists
            const exists = this.devices.some(d => d.ip === deviceIp);
            if (!exists) {
              this.devices.push({
                name: deviceName,
                ip: deviceIp,
                macAddress: macAddress,
              });
            }
          }
        });

        socket.on('error', (err: any) => {
          console.error('Discovery socket error:', err);
          this.isDiscovering = false;
          resolve(this.devices);
        });

        // Set timeout
        setTimeout(() => {
          this.isDiscovering = false;
          if (socket) {
            socket.close();
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
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.isDiscovering = false;
  }
}
