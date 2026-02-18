import t from "tap";
import { InitiatorCryptoContext, JoinerCryptoContext } from "./crypto";

const te = new TextEncoder();
const td = new TextDecoder();

t.test("crypto - encrypt/decrypt", async (t) => {
  // setup
  const initiator = new InitiatorCryptoContext();
  const { serializedPublicKey: ipk } = await initiator.init();

  const joiner = new JoinerCryptoContext();
  const joinAppData = te.encode("json or something from joiner");
  const joinResult = await joiner.initSender(ipk, joinAppData);

  const result = await initiator.handleJoin(joinResult.envelope);
  console.log("plaintext from joiner", td.decode(result.plaintext));
  t.strictSame(result.plaintext, joinAppData.buffer);

  const responseData = te.encode("json or something from initiator");
  const responseResult = await initiator.seal(responseData);
  const result2 = await joiner.open(
    responseResult.payload,
    responseResult.header
  );
  t.strictSame(result2, responseData.buffer);
  console.log("plaintext from initiator", td.decode(result2));

  t.strictSame(
    new Uint8Array(joiner.sessionId!),
    new Uint8Array(initiator.toSessionId!)
  );
  t.strictSame(
    new Uint8Array(initiator.sessionId!),
    new Uint8Array(joiner.toSessionId!)
  );
  t.notSame(
    new Uint8Array(initiator.sessionId!),
    new Uint8Array(initiator.toSessionId!)
  );

  {
    const raw = "try";
    const msg = await initiator.seal(te.encode(raw));
    const result = await joiner.open(msg.payload, msg.header);
    t.equal(td.decode(result), raw);
    console.log("decrypted: ", td.decode(result));
  }

  {
    const raw = "again";
    const msg = await initiator.seal(te.encode(raw));
    const result = await joiner.open(msg.payload, msg.header);
    t.equal(td.decode(result), raw);
    console.log("decrypted: ", td.decode(result));
  }
});
