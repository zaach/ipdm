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

    let found = 0;
    const prom1 = (async () => {
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
    })();
    await sender2.send("hello from sender2", "test");

    let found2 = 0;
    const prom2 = (async () => {
      for await (const msg of receiver2.listen("test2")) {
        if (msg.type === "message") {
          tap.equal(msg.data, "hello from sender1");
          found2++;
        }
        if (msg.type === "open") {
          tap.same(msg.data, { readyState: 1 });
          found2++;
        }
        if (found2 === 2) {
          break;
        }
      }
    })();
    await sender1.send("hello from sender1", "test2");
    await Promise.all([prom1, prom2]);
    tap.equal(found, 2);
    tap.equal(found2, 2);

    let found3 = 0;
    const prom3 = (async () => {
      for await (const msg of receiver1.listen("test3")) {
        if (msg.type === "message") {
          tap.equal(msg.data, "hello again from sender2");
          found3++;
          await sender2.close();
        }
        if (msg.type === "open") {
          tap.same(msg.data, { readyState: 1 });
          found3++;
        }
        if (msg.type === "error") {
          tap.same(msg.data, { readyState: 2 });
          found3++;
        }
        if (found3 === 3) {
          break;
        }
      }
    })();

    await sender2.send("hello again from sender2", "test3");

    await prom3;
    tap.equal(found3, 3);

    await node1.stop();
    await node2.stop();
  });
});
