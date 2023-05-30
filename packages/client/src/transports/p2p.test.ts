import tap from "tap";
import { P2PTransportCreator } from "./p2p";

tap.mochaGlobals();

describe("P2PTransport", () => {
  it("sends and receives", async () => {
    const node1 = await P2PTransportCreator.createPublicLibp2pNode();
    const creator1 = new P2PTransportCreator(node1);
    const sender1 = await creator1.createSenderTransport();
    const receiver1 = await creator1.createReceiverTransport();
    const connectingAddress = node1.getMultiaddrs()[0].toString();

    const node2 = await P2PTransportCreator.createPublicLibp2pNode();
    const creator2 = new P2PTransportCreator(node2);
    const sender2 = await creator2.createSenderTransport({
      connectingAddress,
    });
    const receiver2 = await creator2.createReceiverTransport({
      connectingAddress,
    });

    const promises = Promise.all([
      (async () => {
        let found = 0;
        for await (const msg of receiver1.listen("test")) {
          if (msg.type === "message") {
            tap.equal(msg.data, "hello from sender2");
            found++;
          }
          if (msg.type === "open") {
            tap.same(msg.data, { readyState: 1 });
            found++;
          }
          if (found === 2) {
            break;
          }
        }
      })(),

      (async () => {
        let found = 0;
        for await (const msg of receiver2.listen("test")) {
          if (msg.type === "message") {
            tap.equal(msg.data, "hello from sender1");
            found++;
          }
          if (msg.type === "open") {
            tap.same(msg.data, { readyState: 1 });
            found++;
          }
          if (found === 2) {
            break;
          }
        }
      })(),
    ]);

    await sender2.send("hello from sender2", "test");
    await sender1.send("hello from sender1", "test");

    await promises;

    await node1.stop();
    await node2.stop();
  });
});
