import { TcpClient } from './TcpClient';
import { NetworkDiscovery } from './NetworkDiscovery';

export interface VideoStreamConfig {
  ip: string;
  multicastIp?: string;
  port?: number;
}

export class VideoStream {
  private videoClient: TcpClient | null = null;
  private isStreaming: boolean = false;
  private videoBuffer: number[] = [];
  private onFrameReceived?: (imageData: string) => void;

  /**
   * Request video link via UDP multicast
   */
  public async requestVideoLink(ip: string): Promise<VideoStreamConfig | null> {
    return new Promise((resolve) => {
      // This would require UDP multicast on port 1700
      // For now, fall back to direct TCP connection
      console.log('Requesting video link for IP:', ip);
      
      // Try to get multicast info via UDP (if available)
      // Otherwise, use direct TCP connection
      setTimeout(() => {
        // Fallback to direct TCP connection
        resolve({
          ip: ip,
          port: 10000,
        });
      }, 1000);
    });
  }

  /**
   * Start video streaming
   */
  public async startStreaming(
    config: VideoStreamConfig,
    onFrame: (imageData: string) => void
  ): Promise<void> {
    this.onFrameReceived = onFrame;
    this.isStreaming = true;
    this.videoBuffer = [];

    const videoIp = config.multicastIp || config.ip;
    const videoPort = config.port || 10000;

    console.log(`Starting video stream: ${videoIp}:${videoPort}`);

    try {
      this.videoClient = new TcpClient({
        messageReceived: () => {
          // Video data comes as binary, not text messages
        },
      });

      this.videoClient.SERVER_IP = videoIp;
      this.videoClient.SERVER_PORT = videoPort;
      this.videoClient.run();

      // Wait for connection to establish
      // react-native-tcp-socket doesn't have readyState, so we wait a bit
      // The connection callback in TcpClient.run() indicates when connected
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Set up data handler on the socket directly
      const socket = this.videoClient.getSocket();
      if (socket) {
        console.log('Video stream socket ready, waiting for data...');
        
        socket.on('data', (data: any) => {
          if (this.isStreaming) {
            this.handleVideoData(data);
          }
        });

        socket.on('error', (error: any) => {
          console.error('Video stream socket error:', error);
          this.isStreaming = false;
        });

        socket.on('close', () => {
          console.log('Video stream socket closed');
          this.isStreaming = false;
        });
      } else {
        console.error('Video client socket not available');
        this.isStreaming = false;
      }
    } catch (error) {
      console.error('Error starting video stream:', error);
      this.isStreaming = false;
    }
  }

  /**
   * Handle incoming video data from socket
   */
  private handleVideoData(data: any): void {
    // Convert data to Uint8Array
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

    if (bytes.length > 0) {
      // Log first chunk to verify data is coming
      if (this.videoBuffer.length === 0 && bytes.length > 0) {
        console.log(`Video data received: ${bytes.length} bytes, first bytes:`, 
          Array.from(bytes.slice(0, Math.min(20, bytes.length))).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
      }
      this.processVideoData(bytes);
    }
  }

  /**
   * Process video data and extract frames
   * Looks for START and END markers in the byte stream
   */
  private processVideoData(data: Uint8Array): void {
    // Find START and END markers in byte array
    const START_MARKER = [0x53, 0x54, 0x41, 0x52, 0x54]; // "START" in ASCII
    const END_MARKER = [0x45, 0x4E, 0x44]; // "END" in ASCII

    let startIndex = -1;
    let endIndex = -1;

    // Search for START marker
    for (let i = 0; i <= data.length - START_MARKER.length; i++) {
      let match = true;
      for (let j = 0; j < START_MARKER.length; j++) {
        if (data[i + j] !== START_MARKER[j]) {
          match = false;
          break;
        }
      }
      if (match) {
        startIndex = i;
        break;
      }
    }

    // Search for END marker
    for (let i = 0; i <= data.length - END_MARKER.length; i++) {
      let match = true;
      for (let j = 0; j < END_MARKER.length; j++) {
        if (data[i + j] !== END_MARKER[j]) {
          match = false;
          break;
        }
      }
      if (match) {
        endIndex = i;
        break;
      }
    }

    // If we find END marker, we have a complete frame
    if (endIndex !== -1) {
      // Add all buffered data plus data up to END marker
      const frameData = new Uint8Array(this.videoBuffer.length + endIndex);
      frameData.set(new Uint8Array(this.videoBuffer), 0);
      frameData.set(data.slice(0, endIndex), this.videoBuffer.length);

      // Convert buffer to image if we have data
      if (frameData.length > 0) {
        console.log(`Complete frame received: ${frameData.length} bytes`);
        this.decodeAndDisplayFrame(frameData);
      }
      this.videoBuffer = [];
    }

    // If we find START marker, clear buffer and start fresh
    if (startIndex !== -1) {
      this.videoBuffer = [];
      // Add data after START marker
      const dataAfterStart = data.slice(startIndex + START_MARKER.length);
      this.videoBuffer.push(...Array.from(dataAfterStart));
    }

    // If no markers, add all data to buffer (accumulate until we find markers)
    if (startIndex === -1 && endIndex === -1 && data.length > 0) {
      this.videoBuffer.push(...Array.from(data));
    }
  }

  /**
   * Decode video frame and convert to displayable format
   */
  private decodeAndDisplayFrame(frameData: Uint8Array): void {
    if (frameData.length === 0 || !this.onFrameReceived) {
      return;
    }

    try {
      // Check if data looks like JPEG (starts with FF D8)
      if (frameData.length < 2 || frameData[0] !== 0xFF || frameData[1] !== 0xD8) {
        // Try to find JPEG start marker
        let jpegStart = -1;
        for (let i = 0; i < frameData.length - 1; i++) {
          if (frameData[i] === 0xFF && frameData[i + 1] === 0xD8) {
            jpegStart = i;
            break;
          }
        }
        if (jpegStart > 0) {
          frameData = frameData.slice(jpegStart);
        } else {
          console.warn('Video frame does not appear to be a valid JPEG');
          return;
        }
      }

      // Convert byte array to base64 data URI
      let base64 = '';
      
      // React Native - use Buffer if available (most reliable)
      if (typeof Buffer !== 'undefined') {
        const buffer = Buffer.from(frameData);
        base64 = 'data:image/jpeg;base64,' + buffer.toString('base64');
      } else if (typeof btoa !== 'undefined') {
        // Browser environment
        const binary = String.fromCharCode.apply(null, Array.from(frameData));
        base64 = 'data:image/jpeg;base64,' + btoa(binary);
      } else {
        // Fallback: manual base64 encoding
        base64 = this.arrayBufferToBase64(frameData);
      }

      this.onFrameReceived(base64);
    } catch (error) {
      console.error('Error decoding video frame:', error);
    }
  }

  /**
   * Convert Uint8Array to base64 string
   */
  private arrayBufferToBase64(buffer: Uint8Array): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    
    // Use btoa if available, otherwise need polyfill
    if (typeof btoa !== 'undefined') {
      return 'data:image/jpeg;base64,' + btoa(binary);
    } else {
      // Fallback base64 encoding
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
      let result = '';
      let i = 0;
      while (i < binary.length) {
        const a = binary.charCodeAt(i++);
        const b = i < binary.length ? binary.charCodeAt(i++) : 0;
        const c = i < binary.length ? binary.charCodeAt(i++) : 0;

        const bitmap = (a << 16) | (b << 8) | c;

        result += chars.charAt((bitmap >> 18) & 63);
        result += chars.charAt((bitmap >> 12) & 63);
        result += i - 2 < binary.length ? chars.charAt((bitmap >> 6) & 63) : '=';
        result += i - 1 < binary.length ? chars.charAt(bitmap & 63) : '=';
      }
      return 'data:image/jpeg;base64,' + result;
    }
  }

  /**
   * Stop video streaming
   */
  public stopStreaming(): void {
    this.isStreaming = false;
    if (this.videoClient) {
      this.videoClient.stopClient();
      this.videoClient = null;
    }
    this.videoBuffer = [];
  }
}
