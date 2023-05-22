import { mplex } from "@libp2p/mplex";
import { tcp } from "@libp2p/mplex";
import { yamux } from "@chainsafe/libp2p-yamux";
import { createLibp2p } from "libp2p";
import { noise } from "@chainsafe/libp2p-noise";
import { webRTC, webRTCDirect } from "@libp2p/webrtc";
import { circuitRelayServer } from "libp2p/circuit-relay";
import { webSockets } from "@libp2p/websockets";
import * as filters from "@libp2p/websockets/filters";
import { identifyService } from "libp2p/identify";

const server = await createLibp2p({
  addresses: {
    listen: [
      "/ip4/127.0.0.1/tcp/59351/ws",
      "/ip4/127.0.0.1/udp/59352/webrtc-direct",
      "/ip4/127.0.0.1/tcp/59353",
    ],
  },
  transports: [
    webSockets({
      filter: filters.all,
    }),
    webRTC(),
    webRTCDirect(),
    tcp(),
  ],
  connectionEncryption: [noise()],
  streamMuxers: [yamux(), mplex()],
  services: {
    identify: identifyService(),
    relay: circuitRelayServer(),
  },
});

console.log(
  "p2p addr: ",
  server.getMultiaddrs().map((ma) => ma.toString())
);
