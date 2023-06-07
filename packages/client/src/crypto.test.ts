import tap from "tap";
import { InitiatorCryptoContext, JoinerCryptoContext } from "./crypto";

tap.mochaGlobals();
function assertEquals(a: any, b: any) {
  tap.strictSame(a, b);
}
function assertNotEquals(a: any, b: any) {
  tap.notStrictSame(a, b);
}

const te = new TextEncoder();
const td = new TextDecoder();

describe("crypto", () => {
  it("encrypt/decrypt", async () => {
    // setup
    const initiator = new InitiatorCryptoContext();
    const { serializedPublicKey: ipk } = await initiator.init();

    const joiner = new JoinerCryptoContext();
    const joinAppData = te.encode("json or something from joiner");
    const joinResult = await joiner.initSender(ipk, joinAppData);

    const result = await initiator.handleJoin(joinResult.envelope);
    console.log("plaintext from joiner", td.decode(result.plaintext));
    assertEquals(result.plaintext, joinAppData.buffer);

    const responseData = te.encode("json or something from initiator");
    const responseResult = await initiator.seal(responseData);
    const result2 = await joiner.open(
      responseResult.payload,
      responseResult.header
    );
    assertEquals(result2, responseData.buffer);
    console.log("plaintext from initiator", td.decode(result2));

    assertEquals(
      new Uint8Array(joiner.sessionId!),
      new Uint8Array(initiator.toSessionId!)
    );
    assertEquals(
      new Uint8Array(initiator.sessionId!),
      new Uint8Array(joiner.toSessionId!)
    );
    assertNotEquals(
      new Uint8Array(initiator.sessionId!),
      new Uint8Array(initiator.toSessionId!)
    );

    {
      const raw = "try";
      const msg = await initiator.seal(te.encode(raw));
      const result = await joiner.open(msg.payload, msg.header);
      assertEquals(td.decode(result), raw);
      console.log("decrypted: ", td.decode(result));
    }

    {
      const raw = "again";
      const msg = await initiator.seal(te.encode(raw));
      const result = await joiner.open(msg.payload, msg.header);
      assertEquals(td.decode(result), raw);
      console.log("decrypted: ", td.decode(result));
    }
  });
});
