import tap from "tap";
import { EventIterator } from "./event-iterator";

tap.mochaGlobals();

describe("EventIterator", () => {
  it("event iterator", async () => {
    const et = new EventTarget();
    const test = new EventIterator(et, ["open", "message"]);

    const n = test[Symbol.asyncIterator]();
    const promises = [
      n.next().then((a) => {
        tap.hasStrict(a.value, { data: "hi" });
      }),
      n.next().then((a) => {
        tap.hasStrict(a.value, { data: "there" });
      }),
    ];
    et.dispatchEvent(new MessageEvent("open", { data: "hi" }));
    et.dispatchEvent(new MessageEvent("message", { data: "there" }));
    await Promise.all(promises);
  });
});
