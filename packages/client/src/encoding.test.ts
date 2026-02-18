import t from "tap";
import { Base64EnvelopeEncoding } from "./encoding";

const te = new TextEncoder();
const encoder = new Base64EnvelopeEncoding();

const tuple = <T extends [any] | any[]>(args: T): T => args;

t.test("encoding - encode/decode", (t) => {
  const header = te.encode("head data").buffer as ArrayBuffer;
  const payload = te.encode("payload data").buffer as ArrayBuffer;

  const envelope = { header, payload };
  const encoded = encoder.encodeEnvelope(envelope);
  console.log(encoded);
  const decoded = encoder.decodeEnvelope(encoded);
  const reconstructed = {
    header: decoded.header,
    payload: decoded.payload,
  };

  t.strictSame(reconstructed, envelope);
  t.end();
});

t.test("encoding - encode/decode handshake", (t) => {
  const header = tuple([
    te.encode("header data").buffer as ArrayBuffer,
    te.encode("header data 2").buffer as ArrayBuffer,
  ]);
  const payload = tuple([
    te.encode("payload data").buffer as ArrayBuffer,
    te.encode("payload data 2").buffer as ArrayBuffer,
  ]);

  const envelope = { header, payload };
  const encoded = encoder.encodeHandshakeEnvelope(envelope);
  console.log(encoded);
  const decoded = encoder.decodeHandshakeEnvelope(encoded);
  const reconstructed = {
    header: tuple([
      decoded.header[0],
      decoded.header[1],
    ]),
    payload: tuple([
      decoded.payload[0],
      decoded.payload[1],
    ]),
  };

  t.strictSame(reconstructed, envelope);
  t.end();
});
