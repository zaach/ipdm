import t from "tap";
import { createPublicLibp2pNode } from "../lib/libp2p";
import { IPFSBlobRepo } from "../blob-repo/ipfs";
import { EncryptedBlobStore } from "./encrypted";

t.test("EncryptedBlobStore - puts and gets", { skip: true }, async (t) => {
  const node1 = await createPublicLibp2pNode();
  const repo1 = await IPFSBlobRepo.fromLibp2pNode(node1);
  const store1 = new EncryptedBlobStore(repo1);
  const connectingAddress = node1.getMultiaddrs()[0].toString();

  const node2 = await createPublicLibp2pNode({
    bootstrapAddrs: [connectingAddress.toString()],
  });
  const repo2 = await IPFSBlobRepo.fromLibp2pNode(node2);
  const store2 = new EncryptedBlobStore(repo2);

  const cleartext = "Hello, world!";
  const plaintext = new TextEncoder().encode(cleartext);

  {
    const put = await store1.put(plaintext.buffer);
    t.ok(put.ref);
    t.ok(put.key);
    t.ok(put.iv);
    const get = await store2.get(put);
    const received = new TextDecoder().decode(get.data);
    t.equal(received, cleartext);
  }

  await node1.stop();
  await node2.stop();
});
