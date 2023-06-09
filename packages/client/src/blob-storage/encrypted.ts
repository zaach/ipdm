import all from "it-all";
import { concat as uint8ArrayConcat } from "uint8arrays/concat";
import type { BlobTransport } from "../blob-transport";
import type { BlobStore, BlobStoreGetParams } from "../blob-store";

let crypto = globalThis.crypto;

// handle nodejs environment
if (!crypto) {
  // @ts-expect-error `Crypto.getRandomValues` in `lib.dom.ts` is incorrectly typed: https://github.com/microsoft/TypeScript-DOM-lib-generator/issues/1194
  crypto = (await import("node:crypto")).webcrypto;
}

export class EncryptedBlobStore implements BlobStore {
  #repo: BlobTransport;

  constructor(repo: BlobTransport) {
    this.#repo = repo;
  }

  async put(data: Uint8Array) {
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
      key: await crypto.subtle.exportKey("raw", key),
      iv,
    };
  }

  async get(params: BlobStoreGetParams) {
    const { ref, key, iv } = params;
    const result = this.#repo.get(ref);
    const ciphertext = uint8ArrayConcat(await all(result.data));

    const ekey = await crypto.subtle.importKey(
      "raw",
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
            iv,
          },
          ekey,
          ciphertext
        )
      ),
    };
  }
}
