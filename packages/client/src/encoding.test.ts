import tap from "tap";
import { Base64EnvelopeEncoding } from "./encoding";

tap.mochaGlobals();

const te = new TextEncoder();
const encoder = new Base64EnvelopeEncoding();

const tuple = <T extends [any] | any[]>(args: T): T => args;

describe("encoding", () => {
  it("encode/decode", function () {
    const header = te.encode("head data");
    const payload = te.encode("payload data");

    const envelope = { header, payload };
    const encoded = encoder.encodeEnvelope(envelope);
    console.log(encoded);
    const decoded = encoder.decodeEnvelope(encoded);
    const reconstructed = {
      header: new Uint8Array(decoded.header),
      payload: new Uint8Array(decoded.payload),
    };

    tap.strictSame(reconstructed, envelope);
  });

  it("encode/decode handshake", function () {
    const header = tuple([
      te.encode("header data"),
      te.encode("header data 2"),
    ]);
    const payload = tuple([
      te.encode("payload data"),
      te.encode("payload data 2"),
    ]);

    const envelope = { header, payload };
    const encoded = encoder.encodeHandshakeEnvelope(envelope);
    console.log(encoded);
    const decoded = encoder.decodeHandshakeEnvelope(encoded);
    const reconstructed = {
      header: tuple([
        new Uint8Array(decoded.header[0]),
        new Uint8Array(decoded.header[1]),
      ]),
      payload: tuple([
        new Uint8Array(decoded.payload[0]),
        new Uint8Array(decoded.payload[1]),
      ]),
    };

    tap.strictSame(reconstructed, envelope);
  });
});
