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
    
    try {
      if (this.socket.writable) {
        this.socket.write(message + '\n');
      }
    } catch (error) {
      console.error('Error sending TCP message:', error);
    }
  }

  public sendMessageBytes(msg: Uint8Array): void {
    if (!this.socket) {
      console.warn('TCP socket not available. Cannot send message.');
      return;
    }
    
    try {
      if (this.socket.writable) {
        // Convert Uint8Array to Buffer if available, otherwise use array directly
        let buffer: any = msg;
        if (typeof Buffer !== 'undefined') {
          buffer = Buffer.from(msg);
        } else {
          // Fallback: convert to array
          buffer = Array.from(msg);
        }
        this.socket.write(buffer);
        setTimeout(() => {}, this.delay);
      }
    } catch (error) {
      console.error('Error sending TCP message:', error);
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
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
    this.mMessageListener = null;
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
    };

    try {
      // This call may fail if native module is not linked
      this.socket = TcpSocket.createConnection(options, () => {
        console.log('TCP Client: Connected');
        
        // Register async packet for port 7777
        if (this.SERVER_PORT === 7777) {
          const registerAsyncPacket = new Uint8Array([0, 0, 2, 3, 0, 0, 0, 0, 0, 0]);
          this.sendMessageBytes(registerAsyncPacket);
          setTimeout(() => {
            this.readMessage();
          }, 500);
        }
      });

      this.socket.on('error', (error: any) => {
        console.error('TCP Client: Error', error);
      });

      this.socket.on('data', (data: any) => {
        if (this.mMessageListener) {
          // Convert buffer/array to string
          let message: string;
          if (typeof Buffer !== 'undefined' && Buffer.isBuffer(data)) {
            message = data.toString();
          } else if (data instanceof Uint8Array) {
            message = new TextDecoder().decode(data);
          } else if (typeof data === 'string') {
            message = data;
          } else {
            message = String.fromCharCode.apply(null, Array.from(data));
          }
          this.mMessageListener.messageReceived(message);
        }
      });

      this.socket.on('close', () => {
        console.log('TCP Client: Connection closed');
        this.mRun = false;
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
