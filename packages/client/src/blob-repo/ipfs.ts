import type { BlobRepo } from "../blob-repo";
import type { Libp2p } from "libp2p";
import type { Helia } from "@helia/interface";
import type { Blockstore } from "interface-blockstore";
import type { Datastore } from "interface-datastore";
import { unixfs } from "@helia/unixfs";
import { MemoryBlockstore } from "blockstore-core";
import { MemoryDatastore } from "datastore-core";
import { createHelia } from "helia";
import { CID } from "multiformats/cid";

export class IPFSBlobRepo implements BlobRepo {
  #node: Helia;

  static async fromLibp2pNode(
    libp2p: Libp2p,
    blockstore: Blockstore = new MemoryBlockstore(),
    datastore: Datastore = new MemoryDatastore()
  ): Promise<IPFSBlobRepo> {
    return new IPFSBlobRepo(
      await createHelia({
        libp2p,
        blockstore,
        datastore,
      })
    );
  }

  constructor(node: Helia) {
    this.#node = node;
  }

  async put(data: Uint8Array): Promise<{ ref: string }> {
    const fs = unixfs(this.#node);
    // add the bytes to your node and receive a unique content identifier
    const cid = await fs.addBytes(data);

    return { ref: cid.toString() };
  }

  async get(ref: string): Promise<{ data: AsyncIterable<Uint8Array> }> {
    const fs = unixfs(this.#node);
    const cid = CID.parse(ref);
    // TODO figure out why this hangs for larger files (>100KB)
    const stat = await fs.stat(cid);
    console.log("stat", ref, stat);

    return { data: fs.cat(cid) };
  }
}
