export interface BlobTransport {
  put(data: Uint8Array): Promise<{ ref: string }>;
  get(ref: string): { data: AsyncIterable<Uint8Array> };
}

export * from "./blob-transport/ipfs";
