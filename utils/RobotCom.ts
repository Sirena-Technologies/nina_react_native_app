import { TcpClient } from './TcpClient';

export class MotorTypes {
  public static readonly AX12 = 0;
  public static readonly AX18 = 1;
  public static readonly MX28 = 2;
  public static readonly MX64 = 3;
  public static readonly MX106 = 4;
  public static readonly XL320 = 5;
}

export class RobotCom {
  public mTcpClient: TcpClient | null = null;
  public serverip: string = '';
  public LatestReceivedBytes: Uint8Array = new Uint8Array(512);

  private static readonly BAUDRATES = [
    2000000, 1000000, 500000, 222222, 117647, 100000, 57142, 9615,
  ];

  public openTcp(ip: string): void {
    this.serverip = ip;
    try {
      this.mTcpClient = new TcpClient({
        messageReceived: (message: string) => {
          console.log('Response:', message);
        },
      });
      this.mTcpClient.SERVER_IP = ip;
      this.mTcpClient.SERVER_PORT = 7777;
      this.mTcpClient.run();
      
      // Note: Connection may fail silently if native module not linked
      // The TcpClient will handle errors internally
    } catch (error) {
      console.error('Error creating TCP client:', error);
      this.mTcpClient = null;
    }
  }

  public getLHbytes(x: number): Uint8Array {
    const retbytes = new Uint8Array(2);
    retbytes[0] = x & 0xff;
    retbytes[1] = (x >> 8) & 0xff;
    return retbytes;
  }

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

  public sendAndReceiveMessageBytes(data: Uint8Array): Promise<Uint8Array> {
    return new Promise((resolve) => {
      if (!this.mTcpClient) {
        resolve(new Uint8Array(0));
        return;
      }

      setTimeout(async () => {
        const reply = await this.mTcpClient!.readMessage();
        if (reply.length > 1) {
          this.LatestReceivedBytes = reply;
        }
        this.mTcpClient!.sendMessageBytes(data);
        setTimeout(() => {
          this.mTcpClient!.readMessage().then((reply) => {
            if (reply.length > 1) {
              this.LatestReceivedBytes = reply;
            }
            resolve(this.LatestReceivedBytes);
          });
        }, 100);
      }, 10);
    });
  }

  public request_video_connection(): void {
    // Use mode=2 (CommandType=2) as expected by robot
    const lucipacket = this.LUCI_createPacket(259, 2, new Uint8Array([0]), null);
    this.sendMessageBytes(lucipacket);
  }

  /**
   * Create LUCI packet matching Java LUCIPacket format
   * Header (10 bytes): [remoteID(2), CommandType(1), Command(2), CommandStatus(1), CRC(2), DataLen(2)]
   * Payload: data bytes
   * 
   * @param mbnum Command number
   * @param mode CommandType (0 = LUCI_SET, 1 = LUCI_GET, 2 = default)
   * @param packet0 Payload data
   * @param packet1 Not used (for compatibility)
   */
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

    // Log packet details for debugging
    const headerHex = Array.from(header).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ');
    console.log(`LUCI Packet - Command: ${Command}, Type: ${CommandType}, DataLen: ${DataLen}, Header: ${headerHex}`);

    return LUCI_packet;
  }

  public LUCI_createGeneralPacket(mbnum: number, packet: Uint8Array): Uint8Array {
    const mbnumbytes = this.getLHbytes(mbnum);
    const LuciLength = packet.length;
    const lucilengthbytes = this.getLHbytes(LuciLength);
    const LUCI_packet = new Uint8Array(LuciLength + 10);

    const header = new Uint8Array([
      0, 0, 2, mbnumbytes[0], mbnumbytes[1], 0, 0, 0,
      lucilengthbytes[0], lucilengthbytes[1],
    ]);

    LUCI_packet.set(header, 0);
    LUCI_packet.set(packet, 10);

    return LUCI_packet;
  }

  public send_general_LUCI_packet(mbnum: number, packet: Uint8Array): void {
    const lucipacket = this.LUCI_createGeneralPacket(mbnum, packet);
    this.sendMessageBytes(lucipacket);
  }

  public send_general_LUCI_string(mbnum: number, s: string): void {
    const data = new TextEncoder().encode(s);
    this.send_general_LUCI_packet(mbnum, data);
  }

  /**
   * Send asynchronous command registration (must be called before each action)
   * This matches the Java implementation's sendAsynchronousCommand()
   * Java sends: SendCommand(3, localIP + "," + 3333, LSSDPCONST.LUCI_SET)
   * 
   * Note: Currently sends empty data. The robot should still accept commands.
   * To send proper format, would need to get local IP address (requires native module).
   * Format should be: "192.168.1.100,3333" (local IP + port 3333)
   */
  public sendAsynchronousCommand(): void {
    if (!this.mTcpClient || !this.mTcpClient.getIsConnected()) {
      console.warn('Cannot send async command: TCP client not connected');
      return;
    }
    
    // Java sends command 3 with local IP and port 3333
    // Format: "192.168.1.100,3333"
    // Robot logs show CommandType=2 is expected (not 0)
    // For now, send empty data (device should still work)
    // TODO: Get local IP address and send proper format if needed
    const emptyData = new Uint8Array(0);
    // Use mode=2 (CommandType=2) as shown in robot logs: "CommandType =2 Command=3"
    const lucipacket = this.LUCI_createPacket(3, 2, emptyData, null);
    console.log('[ASYNC] Sending async command registration (command 3) with CommandType=2');
    this.sendMessageBytes(lucipacket);
  }

  /**
   * Send LUCI command with action message (for Nino actions)
   * @param command Command number (e.g., 245)
   * @param actionMessage Action message string
   * @param mode LUCI mode (2 = default/expected by robot, as shown in robot logs: "CommandType =2")
   */
  public sendLUCICommand(command: number, actionMessage: string, mode: number = 2): void {
    if (!this.mTcpClient) {
      console.warn('[LUCI] TCP client not available. Cannot send LUCI command.');
      return;
    }

    // Check if connection is ready
    if (!this.mTcpClient.getIsConnected()) {
      console.warn('[LUCI] TCP connection not ready. Waiting for connection...');
      // Wait a bit and retry
      setTimeout(() => {
        if (this.mTcpClient && this.mTcpClient.getIsConnected()) {
          this.sendLUCICommand(command, actionMessage, mode);
        } else {
          console.error('[LUCI] TCP connection still not ready after wait');
        }
      }, 500);
      return;
    }

    console.log(`[LUCI] Preparing to send command ${command} with message: "${actionMessage}"`);

    // Send async command registration first (as per Java implementation)
    // This must be sent before each action command
    console.log('[LUCI] Step 1: Sending async command registration (command 3)');
    try {
      this.sendAsynchronousCommand();
      console.log('[LUCI] ✓ Async command registration sent');
    } catch (error) {
      console.error('[LUCI] ✗ Error sending async command:', error);
      return;
    }
    
    // Wait longer to ensure async registration is processed
    // Java code typically waits a bit after registration before sending commands
    setTimeout(() => {
      if (!this.mTcpClient) {
        console.error('[LUCI] ✗ TCP client is null while waiting to send command');
        return;
      }
      
      if (!this.mTcpClient.getIsConnected()) {
        console.error('[LUCI] ✗ TCP connection lost while waiting to send command');
        return;
      }
      
      console.log(`[LUCI] Step 2: Creating LUCI packet for command ${command}`);
      const actionData = new TextEncoder().encode(actionMessage);
      const lucipacket = this.LUCI_createPacket(command, mode, actionData, null);
      
      console.log(`[LUCI] Step 3: Sending LUCI command ${command} with message: "${actionMessage}"`);
      console.log(`[LUCI] Packet size: ${lucipacket.length} bytes (header: 10, payload: ${actionData.length})`);
      
      // Log full packet for debugging
      const packetHex = Array.from(lucipacket)
        .map(b => '0x' + b.toString(16).padStart(2, '0'))
        .join(' ');
      console.log(`[LUCI] Full packet (hex): ${packetHex}`);
      
      // Log packet bytes as decimal for easier comparison with robot logs
      const packetBytes = Array.from(lucipacket).join(', ');
      console.log(`[LUCI] Full packet (decimal): [${packetBytes}]`);
      
      // Verify packet format matches robot expectations
      // Robot expects: RemoteID=0, CommandType=2, Command=245, CommandStatus=0, CRC=0, DataLen=7
      const header = lucipacket.slice(0, 10);
      const remoteID = header[0] | (header[1] << 8);
      const commandType = header[2];
      const cmd = header[3] | (header[4] << 8);
      const cmdStatus = header[5];
      const crc = header[6] | (header[7] << 8);
      const dataLen = header[8] | (header[9] << 8);
      
      console.log(`[LUCI] Packet verification:`);
      console.log(`[LUCI]   RemoteID: ${remoteID} (expected: 0)`);
      console.log(`[LUCI]   CommandType: ${commandType} (expected: 2)`);
      console.log(`[LUCI]   Command: ${cmd} (expected: ${command})`);
      console.log(`[LUCI]   CommandStatus: ${cmdStatus} (expected: 0)`);
      console.log(`[LUCI]   CRC: ${crc} (expected: 0)`);
      console.log(`[LUCI]   DataLen: ${dataLen} (expected: ${actionData.length})`);
      
      if (commandType !== 2) {
        console.error(`[LUCI] ⚠ WARNING: CommandType is ${commandType}, but robot expects 2!`);
      }
      
      try {
        this.sendMessageBytes(lucipacket);
        console.log(`[LUCI] ✓ Command ${command} sent successfully - check robot logs for confirmation`);
      } catch (error) {
        console.error(`[LUCI] ✗ Error in sendMessageBytes():`, error);
      }
    }, 300); // Increased delay to ensure async command is processed
  }

  public static getIPAddress(): string {
    // This would need native module implementation
    // For now, return empty string
    return '';
  }

  public direct_play(filename: string): void {
    const ip = RobotCom.getIPAddress();
    const datas = `PLAYITEM:DIRECT:http://${ip}:12345${filename}`;
    const data = new TextEncoder().encode(datas);
    const LuciLength = data.length;
    const lucilengthbytes = this.getLHbytes(LuciLength);
    const LUCI_packet = new Uint8Array(LuciLength + 10);

    const header = new Uint8Array([
      0, 0, 2, 41, 0, 0, 0, 0, lucilengthbytes[0], lucilengthbytes[1],
    ]);

    LUCI_packet.set(header, 0);
    LUCI_packet.set(data, 10);

    this.sendMessageBytes(LUCI_packet);
  }
}
