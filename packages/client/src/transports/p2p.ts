import type {
  ReceiverTransport,
  SenderTransport,
  TransportCreator,
  TransportParams,
} from "../transports";
import { Libp2p, createLibp2p } from "libp2p";
import type { Stream } from "@libp2p/interface-connection";
import { pushable, Pushable } from "it-pushable";
import { multiaddr } from "@multiformats/multiaddr";
import { pipe } from "it-pipe";
import { bootstrap } from "@libp2p/bootstrap";
//import { yamux } from "@chainsafe/libp2p-yamux";
import { webRTC, webRTCDirect } from "@libp2p/webrtc";
import { webSockets } from "@libp2p/websockets";
import * as filters from "@libp2p/websockets/filters";
import { mplex } from "@libp2p/mplex";
import { circuitRelayTransport } from "libp2p/circuit-relay";
import { noise } from "@chainsafe/libp2p-noise";
import { identifyService } from "libp2p/identify";

const PROTO = "/ipdm/1.0.0";

// There are two cases:
// - initiator creates a receiver transport and sends an invite to the joiner
//    - the sender transport can share the duplex stream with the receiver transport once the joiner accepts the invite
// - joiner creates a sender transport and dials the initiator based on the invite
//   - the joiner's receiver transport should begin listening once the dial completes

class P2PTransport {
  #libp2p: Libp2p;
  #outChannel: Pushable<Uint8Array, void, void> = pushable();
  #addr?: string;
  #stream?: Stream;

  constructor(
    libp2p: Libp2p,
    options?: {
      connectingAddress: string;
    }
  ) {
    this.#libp2p = libp2p;
    this.#addr = options?.connectingAddress;

    libp2p.addEventListener("connection:open", (event) => {
      console.log("connection:open", event.detail);
      this.#checkConnections();
    });
    libp2p.addEventListener("connection:close", (event) => {
      console.log("connection:close", event.detail);
      this.#checkConnections();
    });
  }

  #checkConnections() {
    const connections = this.#libp2p.getConnections();
    console.log("connections", connections);
  }

  #newSource(): AsyncGenerator<MessageEvent<any>, void, void> {
    const self = this;
    let started = false;
    return {
      async next(): Promise<IteratorResult<MessageEvent<any>>> {
        const stream = await self.#connect();
        if (!started) {
          started = true;
          return {
            done: false,
            value: new MessageEvent("open", { data: { readyState: 1 } }),
          };
        }
        const next = await stream.source.next();
        if (next.done) {
          return {
            done: true,
            value: new MessageEvent("error", { data: { readyState: 2 } }),
          };
        }
        return {
          done: false,
          value: new MessageEvent("message", {
            data: new TextDecoder().decode(next.value.subarray()),
          }),
        };
      },
      async return(): Promise<IteratorResult<MessageEvent<any>>> {
        return {
          done: true,
          value: new MessageEvent("error", { data: { readyState: 2 } }),
        };
      },
      async throw(): Promise<IteratorResult<MessageEvent<any>>> {
        return {
          done: true,
          value: new MessageEvent("error", { data: { readyState: 2 } }),
        };
      },
      [Symbol.asyncIterator]() {
        return this;
      },
    };
  }

  listen(_channelId: string): AsyncGenerator<MessageEvent, void, void> {
    return this.#newSource()[Symbol.asyncIterator]();
  }

  async closeListener(): Promise<void> {
    await this.#libp2p.unhandle(PROTO);
  }

  async #connect() {
    if (this.#stream) {
      return this.#stream;
    }
    if (this.#addr) {
      const addr = this.#addr;
      const ma = multiaddr(addr);
      const conn = await this.#libp2p.dial(ma);
      const stream = await conn.newStream([PROTO]);
      this.#stream = stream;
      pipe(this.#outChannel, stream);
    } else {
      this.#stream = await new Promise((resolve) => {
        this.#libp2p.handle(PROTO, ({ stream, connection: _connection }) => {
          pipe(this.#outChannel, stream);
          resolve(stream);
        });
      });
    }

    return this.#stream;
  }

  async send(body: string, _channelId: string) {
    await this.#connect();
    this.#outChannel.push(new TextEncoder().encode(body));
    return { ok: true, status: 200, statusText: "OK" };
  }

  async closeSender() {
    this.#outChannel.end();
  }
}

export class P2PTransportCreator implements TransportCreator {
  #libp2p: Libp2p;
  #transport?: P2PTransport;

  constructor(libp2p: Libp2p) {
    this.#libp2p = libp2p;
  }

  static async createPrivateLibp2pNode(options: {
    bootstrapAddrs?: string[];
    relayAddr: string;
  }): Promise<{ node: Libp2p; connectingAddr: string }> {
    const node = await createLibp2p({
      addresses: {
        listen: ["/webrtc"],
      },
      transports: [
        webRTC(),
        webRTCDirect(),
        webSockets({
          filter: filters.all,
        }),
        circuitRelayTransport({
          discoverRelays: 1,
        }),
      ],
      connectionEncryption: [noise()],
      streamMuxers: [mplex()],
      peerDiscovery: options?.bootstrapAddrs?.length
        ? [
            bootstrap({
              list: options.bootstrapAddrs,
              timeout: 1000, // in ms,
              tagName: "bootstrap",
              tagValue: 50,
              tagTTL: 120000, // in ms
            }),
          ]
        : [],
      connectionGater: {
        denyDialMultiaddr: () => {
          // by default we refuse to dial local addresses from the browser since they
          // are usually sent by remote peers broadcasting undialable multiaddrs but
          // here we are explicitly connecting to a local node so do not deny dialing
          // any discovered address
          return false;
        },
      },
      services: {
        identify: identifyService(),
      },
    });
    // wait until peer update shows the webrtc relay address is ready
    return new Promise(async (resolve) => {
      node.addEventListener("self:peer:update", (_event) => {
        for (const addr of node.getMultiaddrs()) {
          const connectingAddr = addr.toString();
          if (
            connectingAddr.includes(options.relayAddr) &&
            connectingAddr.includes("webrtc")
          ) {
            resolve({ node, connectingAddr });
          }
        }
      });
      await node.dial(multiaddr(options.relayAddr));
    });
  }

  static async createPublicLibp2pNode(options?: { bootstrapAddrs?: string[] }) {
    const { tcp } = await import("@libp2p/tcp");
    const node = await createLibp2p({
      addresses: {
        listen: [
          "/ip4/0.0.0.0/tcp/0",
          "/ip4/0.0.0.0/tcp/0/ws",
          "/ip4/0.0.0.0/udp/0/webrtc-direct",
          "/ip4/0.0.0.0/udp/0/webrtc",
        ],
      },
      transports: [
        tcp(),
        webSockets({
          filter: filters.all,
        }),
        webRTCDirect(),
      ],
      connectionEncryption: [noise()],
      streamMuxers: [mplex()],
      peerDiscovery: options?.bootstrapAddrs?.length
        ? [
            bootstrap({
              list: options.bootstrapAddrs,
              timeout: 1000, // in ms,
              tagName: "bootstrap",
              tagValue: 50,
              tagTTL: 120000, // in ms
            }),
          ]
        : [],
      connectionGater: {
        denyDialMultiaddr: () => {
          // by default we refuse to dial local addresses from the browser since they
          // are usually sent by remote peers broadcasting undialable multiaddrs but
          // here we are explicitly connecting to a local node so do not deny dialing
          // any discovered address
          return false;
        },
      },
      services: {
        identify: identifyService(),
      },
    });

    await node.start();

    return node;
  }

  async createSenderTransport(params?: TransportParams) {
    if (!this.#transport) {
      this.#transport = new P2PTransport(this.#libp2p, params);
    }
    return new P2PSenderTransport(this.#transport);
  }

  async createReceiverTransport(params?: TransportParams) {
    if (!this.#transport) {
      this.#transport = new P2PTransport(this.#libp2p, params);
    }
    return new P2PReceiverTransport(this.#transport);
  }
}

export class P2PReceiverTransport implements ReceiverTransport {
  #transport: P2PTransport;

  constructor(transport: P2PTransport) {
    this.#transport = transport;
  }
  listen(channelId: string): AsyncGenerator<MessageEvent, void, void> {
    return this.#transport.listen(channelId);
  }
  async close(): Promise<void> {
    this.#transport.closeListener();
  }
}

export class P2PSenderTransport implements SenderTransport {
  #transport: P2PTransport;

  constructor(transport: P2PTransport) {
    this.#transport = transport;
  }
  async send(body: string, channelId: string) {
    return this.#transport.send(body, channelId);
  }
  async close() {
    this.#transport.closeSender();
  }
}
