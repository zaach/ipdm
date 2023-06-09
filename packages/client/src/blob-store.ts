export interface BlobStoreGetParams {
  ref: string;
  key: ArrayBuffer;
  iv: ArrayBuffer;
}

export interface BlobStorePutResult {
  ref: string;
  key: ArrayBuffer;
  iv: ArrayBuffer;
}

export interface BlobStore {
  put(data: Uint8Array): Promise<BlobStorePutResult>;
  get(params: BlobStoreGetParams): Promise<{ data: Uint8Array }>;
}

export * from "./blob-storage/encrypted";
