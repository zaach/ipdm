import type {
  ReceiverTransport,
  SenderTransport,
  TransportCreator,
  TransportParams,
} from "../transports";
import type { Libp2p } from "libp2p";
import type { Stream } from "@libp2p/interface-connection";
import { createPrivateLibp2pNode, createPublicLibp2pNode } from "../lib/libp2p";
import { pushable, Pushable } from "it-pushable";
import { multiaddr } from "@multiformats/multiaddr";
import { pipe } from "it-pipe";

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
    if (options?.connectingAddress) {
      this.#addr = options?.connectingAddress;
    }

    libp2p.addEventListener("connection:open", (event) => {
      console.log("connection:open", event.detail);
    });
    libp2p.addEventListener("connection:close", (event) => {
      console.log("connection:close", event.detail);
    });
  }

  #newSource(): AsyncGenerator<MessageEvent<any>, void, void> {
    const self = this;
    let started = false;
    let ended = false;
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
        if (ended) {
          return {
            done: true,
            value: null,
          };
        }
        const next = await stream.source.next();
        if (next.done) {
          ended = true;
          return {
            done: false,
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
    this.#stream?.close();
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
      await this.#libp2p.unhandle(PROTO);
    }

    return this.#stream;
  }

  async send(body: string, _channelId: string) {
    await this.#connect();
    this.#outChannel.push(new TextEncoder().encode(body));
    return { ok: true, status: 200, statusText: "OK" };
  }

  async closeSender() {
    this.#stream?.close();
    this.#outChannel.end();
  }
}

export class P2PTransportCreator implements TransportCreator {
  #libp2p: Libp2p;

  constructor(libp2p: Libp2p) {
    this.#libp2p = libp2p;
  }

  static async createPrivateLibp2pNode(options: {
    bootstrapAddrs?: string[];
    relayAddr?: string;
  }): Promise<{ node: Libp2p; connectingAddr?: string }> {
    return createPrivateLibp2pNode(options);
  }

  static async createPublicLibp2pNode(options?: { bootstrapAddrs?: string[] }) {
    return createPublicLibp2pNode(options);
  }

  async createTransports(params?: TransportParams) {
    const transport = new P2PTransport(this.#libp2p, params);
    return {
      senderTransport: new P2PSenderTransport(transport),
      receiverTransport: new P2PReceiverTransport(transport),
    };
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
