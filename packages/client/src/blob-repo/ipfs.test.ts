import tap from "tap";
import all from "it-all";
import { concat as uint8ArrayConcat } from "uint8arrays/concat";
import { createPublicLibp2pNode } from "../lib/libp2p";
import { IPFSBlobRepo } from "./ipfs";

tap.mochaGlobals();

describe("IPFSBlobRepo", () => {
  it("puts and gets", async () => {
    const node1 = await createPublicLibp2pNode();
    const repo1 = await IPFSBlobRepo.fromLibp2pNode(node1);
    const connectingAddress = node1.getMultiaddrs()[0].toString();

    const node2 = await createPublicLibp2pNode({
      bootstrapAddrs: [connectingAddress.toString()],
    });
    const repo2 = await IPFSBlobRepo.fromLibp2pNode(node2);

    const cleartext = "Hello, world!";
    const plaintext = new TextEncoder().encode(cleartext);

    {
      const put = await repo1.put(plaintext);
      const get = await repo2.get(put.ref);
      const data = uint8ArrayConcat(await all(get.data));
      const received = new TextDecoder().decode(data);
      tap.equal(received, cleartext);
    }

    await node1.stop();
    await node2.stop();
  });
});
