import base64 from "@stablelib/base64";
import all from "it-all";
import { concat as uint8ArrayConcat } from "uint8arrays/concat";
import type { Libp2p } from "libp2p";
import type { BlobStore, BlobStoreGetParams } from "../blob-store";
import { BlobRepo, IPFSBlobRepo } from "../blob-repo";

let crypto = globalThis.crypto;

// Use IIFE to avoid TLA error with rollup: https://github.com/rollup/rollup/issues/3621
(async function () {
  // handle nodejs environment
  if (!crypto) {
    // @ts-expect-error `Crypto.getRandomValues` in `lib.dom.ts` is incorrectly typed: https://github.com/microsoft/TypeScript-DOM-lib-generator/issues/1194
    crypto = (await import("node:crypto")).webcrypto;
  }
})();

export class EncryptedBlobStore implements BlobStore {
  #repo: BlobRepo;

  constructor(repo: BlobRepo) {
    this.#repo = repo;
  }

  static async fromLibp2pNode(node: Libp2p) {
    const repo = await IPFSBlobRepo.fromLibp2pNode(node);
    return new EncryptedBlobStore(repo);
  }

  async put(data: ArrayBuffer) {
    // get encryption key from web crypto
    const key = await crypto.subtle.generateKey(
      {
        name: "AES-GCM",
        length: 256,
      },
      true,
      ["encrypt", "decrypt"]
    );
    const iv = crypto.getRandomValues(new Uint8Array(16));
    const ciphertext = await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv,
      },
      key,
      data
    );
    const result = await this.#repo.put(new Uint8Array(ciphertext));

    return {
      ref: result.ref,
      key: await crypto.subtle.exportKey("jwk", key),
      iv: base64.encode(iv),
    };
  }

  async get(params: BlobStoreGetParams) {
    const { ref, key, iv } = params;
    const result = await this.#repo.get(ref);
    const ciphertext = uint8ArrayConcat(await all(result.data));

    const ekey = await crypto.subtle.importKey(
      "jwk",
      key,
      {
        name: "AES-GCM",
        length: 256,
      },
      true,
      ["encrypt", "decrypt"]
    );
    return {
      data: new Uint8Array(
        await crypto.subtle.decrypt(
          {
            name: "AES-GCM",
            iv: base64.decode(iv),
          },
          ekey,
          ciphertext
        )
      ),
    };
  }
}
