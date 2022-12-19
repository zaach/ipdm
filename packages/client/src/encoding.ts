import base64 from "@stablelib/base64";

export interface Envelope {
  // header: channelid
  header: ArrayBuffer;
  // payload: ciphertext
  payload: ArrayBuffer;
}

export interface HandshakeEnvelope {
  // encrypted header: context and ciphertext
  header: [ArrayBuffer, ArrayBuffer];
  // handshake payload: context and ciphertext
  payload: [ArrayBuffer, ArrayBuffer];
}

export interface EnvelopeEncoding {
  encodeHandshakeEnvelope(envelope: HandshakeEnvelope): string;
  decodeHandshakeEnvelope(encoded: string): HandshakeEnvelope;
  encodeEnvelope(envelope: Envelope): string;
  decodeEnvelope(encoded: string): Envelope;
}

export class Base64EnvelopeEncoding implements EnvelopeEncoding {
  protected INTER_SPLIT = ":";
  protected INTRA_SPLIT = ".";

  public encodeHandshakeEnvelope(envelope: HandshakeEnvelope): string {
    const h = envelope.header.map((h: ArrayBuffer) =>
      base64.encode(new Uint8Array(h))
    );
    const p = envelope.payload.map((p: ArrayBuffer) =>
      base64.encode(new Uint8Array(p))
    );
    return [h.join(this.INTER_SPLIT), p.join(this.INTER_SPLIT)].join(
      this.INTRA_SPLIT
    );
  }

  public decodeHandshakeEnvelope(encoded: string): HandshakeEnvelope {
    const [ha, pa] = encoded.split(this.INTRA_SPLIT);
    const h = ha.split(this.INTER_SPLIT);
    const p = pa.split(this.INTER_SPLIT);
    const header: HandshakeEnvelope["header"] = [
      base64.decode(h[0]),
      base64.decode(h[1]),
    ];
    const payload: HandshakeEnvelope["payload"] = [
      base64.decode(p[0]),
      base64.decode(p[1]),
    ];
    return {
      header,
      payload,
    };
  }

  public encodeEnvelope(envelope: Envelope): string {
    const h = base64.encode(new Uint8Array(envelope.header));
    const p = base64.encode(new Uint8Array(envelope.payload));
    return [h, p].join(this.INTRA_SPLIT);
  }

  public decodeEnvelope(encoded: string): Envelope {
    const [h, p] = encoded.split(this.INTRA_SPLIT);
    const header: Envelope["header"] = base64.decode(h);
    const payload: Envelope["payload"] = base64.decode(p);
    return {
      header,
      payload,
    };
  }
}

type ObjectValue = Record<string, unknown>;
export interface InternalFormat<T extends ObjectValue = ObjectValue> {
  encode(data: T): ArrayBuffer;
  decode(raw: ArrayBuffer): T;
}

export class InternalFormatJson<T extends ObjectValue = ObjectValue>
  implements InternalFormat<T>
{
  encode(data: T): ArrayBuffer {
    const text = JSON.stringify(data);
    return new TextEncoder().encode(text);
  }

  decode(raw: ArrayBuffer): T {
    return JSON.parse(new TextDecoder().decode(raw));
  }
}
