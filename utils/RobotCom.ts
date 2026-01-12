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
    const lucipacket = this.LUCI_createPacket(259, 0, new Uint8Array([0]), null);
    this.sendMessageBytes(lucipacket);
  }

  public LUCI_createPacket(
    mbnum: number,
    mode: number,
    packet0: Uint8Array,
    packet1: Uint8Array | null
  ): Uint8Array {
    if (mode !== 4 && mode !== 5) {
      const packet0lenbytes = this.getLHbytes(packet0.length);
      const packet1lenbytes = this.getLHbytes(0);
      const mbnumbytes = this.getLHbytes(mbnum);
      const LuciLength = packet0.length + 0 + 5;
      const lucilengthbytes = this.getLHbytes(LuciLength);
      const LUCI_packet = new Uint8Array(LuciLength + 10);

      const header = new Uint8Array([
        0, 0, 2, mbnumbytes[0], mbnumbytes[1], 0, 0, 0,
        lucilengthbytes[0], lucilengthbytes[1], mode,
        packet0lenbytes[0], packet0lenbytes[1],
        packet1lenbytes[0], packet1lenbytes[1],
      ]);

      LUCI_packet.set(header, 0);
      LUCI_packet.set(packet0, 15);

      return LUCI_packet;
    } else {
      return new Uint8Array([0, 0, 2]);
    }
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
   * Send LUCI command with action message (for Nino actions)
   * @param command Command number (e.g., 245)
   * @param actionMessage Action message string
   * @param mode LUCI mode (0 = SET)
   */
  public sendLUCICommand(command: number, actionMessage: string, mode: number = 0): void {
    const actionData = new TextEncoder().encode(actionMessage);
    const lucipacket = this.LUCI_createPacket(command, mode, actionData, null);
    this.sendMessageBytes(lucipacket);
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
