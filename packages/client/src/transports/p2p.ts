import type {
  ReceiverTransport,
  SenderTransport,
  TransportCreator,
} from "../transports";
import { Libp2p, createLibp2p } from "libp2p";
import { pushable, Pushable } from "it-pushable";
import { multiaddr } from "@multiformats/multiaddr";
import { pipe } from "it-pipe";
import { bootstrap } from "@libp2p/bootstrap";
import { yamux } from "@chainsafe/libp2p-yamux";
import { webRTC, webRTCDirect } from "@libp2p/webrtc";
import { webSockets } from "@libp2p/websockets";
import * as filters from "@libp2p/websockets/filters";
import { mplex } from "@libp2p/mplex";
import { circuitRelayTransport } from "libp2p/circuit-relay";
import { noise } from "@chainsafe/libp2p-noise";
import { identifyService } from "libp2p/identify";

const PROTO = "/5edm/1.0.0";

export class P2PReceiverTransport implements ReceiverTransport {
  #libp2p: Libp2p;
  #channels: Map<string, Pushable<MessageEvent, void, void>> = new Map();

  constructor(libp2p: Libp2p) {
    this.#libp2p = libp2p;
  }

  #getChannel(channelId: string) {
    if (this.#channels.has(channelId)) {
      return this.#channels.get(channelId)!;
    }
    const sender = pushable<MessageEvent>({ objectMode: true });
    this.#channels.set(channelId, sender);
    return sender;
  }

  listen(channelId: string): AsyncGenerator<MessageEvent, void, void> {
    const pushableStream = this.#getChannel(channelId);
    this.#libp2p.handle(PROTO, ({ stream }) => {
      pipe(stream, async function (source) {
        for await (const msg of source) {
          pushableStream.push(
            new MessageEvent("message", {
              data: new TextDecoder().decode(msg.subarray()),
            })
          );
        }
      });
    });

    return pushableStream;
  }

  async close(): Promise<void> {
    await this.#libp2p.unhandle(PROTO);
    for (const s of this.#channels.values()) {
      s.end();
    }
  }
}

export class P2PSenderTransport implements SenderTransport {
  #libp2p: Libp2p;
  #relayAddr?: string;
  #channels: Map<string, Pushable<Uint8Array, void, void>> = new Map();

  constructor(libp2p: Libp2p, options: { relayAddr?: string } = {}) {
    this.#libp2p = libp2p;
    this.#relayAddr = options.relayAddr;
  }

  async #connect(channelId: string) {
    if (this.#channels.has(channelId)) {
      return this.#channels.get(channelId)!;
    }
    const sender = pushable();
    const addr =
      channelId.includes("webrtc") && this.#relayAddr
        ? this.#relayAddr + channelId
        : channelId;
    const stream = await this.#libp2p.dialProtocol(multiaddr(addr), PROTO);
    pipe(sender, stream);
    this.#channels.set(channelId, sender);
    return sender;
  }

  async send(body: string, channelId: string) {
    const sender = await this.#connect(channelId);
    sender.push(new TextEncoder().encode(body));
    return { ok: true, status: 200, statusText: "OK" };
  }

  async close() {
    for (const s of this.#channels.values()) {
      s.end();
    }
  }
}

export class P2PPrivateTransportCreator implements TransportCreator {
  #libp2p: Libp2p;
  #relayAddr?: string;

  constructor(libp2p: Libp2p, options: { relayAddr: string }) {
    this.#relayAddr = options.relayAddr;
    this.#libp2p = libp2p;
  }

  static async createPrivateLibp2pNode(options?: {
    bootstrapAddrs?: string[];
  }) {
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
      streamMuxers: [yamux(), mplex()],
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

    node.addEventListener("connection:open", (event) => {
      console.log("connection:open", event.detail);
    });
    node.addEventListener("connection:close", (event) => {
      console.log("connection:close", event.detail);
    });
    node.addEventListener("self:peer:update", (event) => {
      console.log("self:peer:update", event.detail);
    });

    return node;
  }

  async createSenderTransport() {
    const node = this.#libp2p;
    return new P2PSenderTransport(node, { relayAddr: this.#relayAddr });
  }

  async createReceiverTransport() {
    const node = this.#libp2p;
    await node.dial(multiaddr(this.#relayAddr));
    return new P2PReceiverTransport(node);
  }
}

export class P2PPublicTransportCreator implements TransportCreator {
  #libp2p: Libp2p;

  constructor(node: Libp2p) {
    this.#libp2p = node;
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
      streamMuxers: [yamux(), mplex()],
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

    node.addEventListener("connection:open", (event) => {
      console.log("connection:open", event.detail);
    });
    node.addEventListener("connection:close", (event) => {
      console.log("connection:close", event.detail);
    });
    node.addEventListener("self:peer:update", (event) => {
      console.log("self:peer:update", event.detail);
    });

    return node;
  }

  async createSenderTransport() {
    const node = this.#libp2p;
    await node.start();
    return new P2PSenderTransport(node);
  }

  async createReceiverTransport() {
    const node = this.#libp2p;
    await node.start();
    return new P2PReceiverTransport(node);
  }
}
