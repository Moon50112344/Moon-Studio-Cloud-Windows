import net from 'node:net';
import { serverLogger } from './logger';

export interface RdpHealthResult {
  connected: boolean;
  latencyMs: number;
  rdpNegotiated: boolean;
  statusMessage: string;
  error?: string;
}

export class RdpHealthChecker {
  /**
   * Constructs an RFC 1086 / X.224 Connection Request (CR) PDU for RDP
   * TPKT: 0x03 0x00 (length high, length low)
   * X.224: length byte, 0xE0 (CR), DST-REF (0x0000), SRC-REF (0x0001), CLASS (0x00)
   * RDP NEG_REQ (optional / cookie)
   */
  private buildRdpConnectionRequest(username = 'Administrator'): Buffer {
    const cookie = `Cookie: mstshash=${username}\r\n`;
    const cookieBuf = Buffer.from(cookie, 'ascii');

    // RDP Negotiation Request structure:
    // TYPE: 0x01 (RDP_NEG_REQ), FLAGS: 0x00, LENGTH: 0x0008, REQUESTED_PROTOCOLS: 0x00000001 (SSL) or 0x00000003 (HYBRID)
    const negReq = Buffer.from([0x01, 0x00, 0x08, 0x00, 0x03, 0x00, 0x00, 0x00]);

    // X.224 Header: length (to end of packet), code 0xE0, dst-ref 0, src-ref 0x1234, class 0
    const x224Len = 1 + 1 + 2 + 2 + 1 + cookieBuf.length + negReq.length - 1; // length byte does not include itself
    const x224Buf = Buffer.from([
      x224Len,
      0xe0, // CR
      0x00, 0x00, // dst-ref
      0x12, 0x34, // src-ref
      0x00, // class option
    ]);

    // TPKT Header: Version 3, Reserved 0, Total Length (TPKT + X224 + payload)
    const tpktTotalLen = 4 + x224Buf.length + cookieBuf.length + negReq.length;
    const tpktBuf = Buffer.from([0x03, 0x00, (tpktTotalLen >> 8) & 0xff, tpktTotalLen & 0xff]);

    return Buffer.concat([tpktBuf, x224Buf, cookieBuf, negReq]);
  }

  public async checkRdp(
    host: string,
    port: number,
    timeoutMs = 4000,
    vmId?: string
  ): Promise<RdpHealthResult> {
    const startTime = Date.now();
    return new Promise((resolve) => {
      const socket = new net.Socket();
      let connected = false;
      let rdpNegotiated = false;
      let finished = false;

      const finish = (result: RdpHealthResult) => {
        if (finished) return;
        finished = true;
        socket.destroy();
        resolve(result);
      };

      socket.setTimeout(timeoutMs);

      socket.on('connect', () => {
        connected = true;
        serverLogger.debug(
          'RDPChecker',
          `TCP socket connected to ${host}:${port}. Sending X.224 Connection Request...`,
          vmId
        );
        try {
          const req = this.buildRdpConnectionRequest();
          socket.write(req);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          finish({
            connected: true,
            latencyMs: Date.now() - startTime,
            rdpNegotiated: false,
            statusMessage: `Socket connected but failed sending RDP PDU: ${msg}`,
          });
        }
      });

      socket.on('data', (data) => {
        const latency = Date.now() - startTime;
        // Verify TPKT response header (0x03 0x00 ...) and X.224 Connection Confirm (0xD0)
        if (data.length >= 5 && data[0] === 0x03 && data[1] === 0x00) {
          const pduType = data[5];
          if (pduType === 0xd0) {
            rdpNegotiated = true;
            serverLogger.info(
              'RDPChecker',
              `RDP Handshake Confirmed (CC 0xD0) from ${host}:${port} in ${latency}ms`,
              vmId
            );
            finish({
              connected: true,
              latencyMs: latency,
              rdpNegotiated: true,
              statusMessage: 'Remote Desktop Protocol confirmed and responding.',
            });
            return;
          }
        }

        // Received data from port, valid listener
        finish({
          connected: true,
          latencyMs: latency,
          rdpNegotiated: false,
          statusMessage: `Port open, received ${data.length} bytes response.`,
        });
      });

      socket.on('timeout', () => {
        serverLogger.warn('RDPChecker', `Connection timeout reaching ${host}:${port}`, vmId);
        finish({
          connected: false,
          latencyMs: Date.now() - startTime,
          rdpNegotiated: false,
          statusMessage: 'Connection timed out waiting for RDP response.',
          error: 'ETIMEDOUT',
        });
      });

      socket.on('error', (err: Error) => {
        finish({
          connected: false,
          latencyMs: Date.now() - startTime,
          rdpNegotiated: false,
          statusMessage: `Connection refused or unreachable: ${err.message}`,
          error: err.message,
        });
      });

      try {
        socket.connect(port, host);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        finish({
          connected: false,
          latencyMs: Date.now() - startTime,
          rdpNegotiated: false,
          statusMessage: `Failed to open socket: ${msg}`,
          error: msg,
        });
      }
    });
  }
}

export const rdpHealthChecker = new RdpHealthChecker();
