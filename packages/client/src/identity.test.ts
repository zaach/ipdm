import t from "tap";
import { DecentralizedIdentity } from "./identity";

const te = new TextEncoder();

t.test("identity - encode/decode", (t) => {
  const identity = new DecentralizedIdentity({ addr: "foo" });

  const invite = identity.encodeInvite({ iss: te.encode("bar") });

  t.strictSame(identity.decodeInvite(invite), {
    iss: te.encode("bar"),
    claims: { addr: "foo" },
  });
  t.end();
});
