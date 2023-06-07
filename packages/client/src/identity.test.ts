import tap from "tap";
import { DecentralizedIdentity } from "./identity";

tap.mochaGlobals();

const te = new TextEncoder();

describe("encoding", () => {
  it("encode/decode", () => {
    const identity = new DecentralizedIdentity({ addr: "foo" });

    const invite = identity.encodeInvite({ iss: te.encode("bar") });

    tap.strictSame(identity.decodeInvite(invite), {
      iss: te.encode("bar"),
      claims: { addr: "foo" },
    });
  });
});
