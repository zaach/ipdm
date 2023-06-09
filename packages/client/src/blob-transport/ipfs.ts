import type { BlobTransport } from "../blob-transport";
import type { Libp2p } from "libp2p";
import type { Helia } from "@helia/interface";
import type { Blockstore } from "interface-blockstore";
import type { Datastore } from "interface-datastore";
import { unixfs } from "@helia/unixfs";
import { MemoryBlockstore } from "blockstore-core";
import { MemoryDatastore } from "datastore-core";
import { createHelia } from "helia";
import { CID } from "multiformats/cid";

export class IPFSBlobTransport implements BlobTransport {
  #node?: Helia;

  static async fromLibp2pNode(
    libp2p: Libp2p,
    blockstore: Blockstore = new MemoryBlockstore(),
    datastore: Datastore = new MemoryDatastore()
  ): Promise<IPFSBlobTransport> {
    return new IPFSBlobTransport(
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
    if (!this.#node) {
      throw new Error("node not initialized");
    }
    const fs = unixfs(this.#node);
    // add the bytes to your node and receive a unique content identifier
    const cid = await fs.addBytes(data);

    return { ref: cid.toString() };
  }

  get(ref: string): { data: AsyncIterable<Uint8Array> } {
    if (!this.#node) {
      throw new Error("node not initialized");
    }
    const fs = unixfs(this.#node);
    const cid = CID.parse(ref);
    return { data: fs.cat(cid) };
  }
}
