import tap from "tap";
import { P2PPublicTransportCreator } from "./p2p";

tap.mochaGlobals();

describe("P2PTransport", () => {
  it("sends and receives", async () => {
    const node1 = await P2PPublicTransportCreator.createPublicLibp2pNode();
    const creator1 = new P2PPublicTransportCreator(node1);
    const sender1 = await creator1.createSenderTransport();
    const receiver1 = await creator1.createReceiverTransport();

    const node2 = await P2PPublicTransportCreator.createPublicLibp2pNode();
    const creator2 = new P2PPublicTransportCreator(node2);
    const sender2 = await creator2.createSenderTransport();
    const receiver2 = await creator2.createReceiverTransport();

    const addr1 = node1.getMultiaddrs()[0].toString();
    const addr2 = node2.getMultiaddrs()[0].toString();

    const promises = Promise.all([
      (async () => {
        for await (const msg of receiver1.listen("test")) {
          tap.equal(msg.data, "hello from sender2");
          break;
        }
      })(),

      (async () => {
        for await (const msg of receiver2.listen("test")) {
          tap.equal(msg.data, "hello from sender1");
          break;
        }
      })(),
    ]);

    await sender1.send("hello from sender1", addr2);
    await sender2.send("hello from sender2", addr1);

    await promises;

    await node1.stop();
    await node2.stop();
  });
});
