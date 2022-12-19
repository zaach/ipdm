import base64 from "@stablelib/base64";

export function encodeUrlParam(payload: ArrayBuffer): string {
  return base64.encodeURLSafe(new Uint8Array(payload));
}

export function decodeUrlParam(param: string): ArrayBuffer {
  return base64.decodeURLSafe(param);
}
