import { mplex } from "@libp2p/mplex";
import { tcp } from "@libp2p/tcp";
import { yamux } from "@chainsafe/libp2p-yamux";
import { createLibp2p } from "libp2p";
import { noise } from "@chainsafe/libp2p-noise";
import { webRTC, webRTCDirect } from "@libp2p/webrtc";
import { circuitRelayServer } from "libp2p/circuit-relay";
import { webSockets } from "@libp2p/websockets";
import * as filters from "@libp2p/websockets/filters";
import { identifyService } from "libp2p/identify";
import { keys } from "@libp2p/crypto";
import { createFromPrivKey } from "@libp2p/peer-id-factory";
import { fromString as uint8ArrayFromString } from "uint8arrays/from-string";
//import { toString as uint8ArrayToString } from "uint8arrays/to-string";
import "dotenv/config";

let peerId;
if (process.env.PEER_SECRET) {
  peerId = await createFromPrivKey(
    await keys.unmarshalPrivateKey(
      uint8ArrayFromString(process.env.PEER_SECRET, "base64pad")
    )
  );
} else {
  const key = await keys.generateKeyPair("Ed25519");
  peerId = await createFromPrivKey(key);
  //console.log(uint8ArrayToString(keys.marshalPrivateKey(key), "base64pad"));
}

const server = await createLibp2p({
  peerId,
  addresses: {
    listen: ["/ip4/0.0.0.0/tcp/59351/ws", "/ip4/0.0.0.0/tcp/59353"],
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
  streamMuxers: [mplex(), yamux()],
  services: {
    identify: identifyService(),
    relay: circuitRelayServer(),
  },
});

console.log(
  "p2p addr: ",
  server.getMultiaddrs().map((ma) => ma.toString())
);
