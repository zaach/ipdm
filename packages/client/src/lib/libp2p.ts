import { Libp2p, createLibp2p } from "libp2p";
import { multiaddr } from "@multiformats/multiaddr";
import { bootstrap } from "@libp2p/bootstrap";
import { yamux } from "@chainsafe/libp2p-yamux";
import { webRTC, webRTCDirect } from "@libp2p/webrtc";
import { webSockets } from "@libp2p/websockets";
import * as filters from "@libp2p/websockets/filters";
import { mplex } from "@libp2p/mplex";
import { circuitRelayTransport } from "libp2p/circuit-relay";
import { noise } from "@chainsafe/libp2p-noise";
import { identifyService } from "libp2p/identify";

export async function createPrivateLibp2pNode(options: {
  bootstrapAddrs?: string[];
  relayAddr?: string;
}): Promise<{ node: Libp2p; connectingAddr?: string }> {
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
    streamMuxers: [mplex(), yamux()],
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
  const relayAddr = options.relayAddr;
  if (relayAddr) {
    // wait until peer update shows the webrtc relay address is ready
    return new Promise((resolve) => {
      node.addEventListener("self:peer:update", (_event) => {
        for (const addr of node.getMultiaddrs()) {
          const connectingAddr = addr.toString();
          if (
            connectingAddr.includes(relayAddr) &&
            connectingAddr.includes("webrtc")
          ) {
            resolve({ node, connectingAddr });
          }
        }
      });
      node.dial(multiaddr(relayAddr));
    });
  }
  return { node };
}

export async function createPublicLibp2pNode(options?: {
  bootstrapAddrs?: string[];
}) {
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
    streamMuxers: [mplex(), yamux()],
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
