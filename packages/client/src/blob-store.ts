export interface BlobStoreGetParams {
  ref: string;
  key: JsonWebKey;
  iv: string;
}

export interface BlobStorePutResult {
  ref: string;
  key: JsonWebKey;
  iv: string;
}

export interface BlobStore {
  put(data: ArrayBuffer): Promise<BlobStorePutResult>;
  get(params: BlobStoreGetParams): Promise<{ data: Uint8Array }>;
}

export * from "./blob-storage/encrypted";
