import t from "tap";
import { EventIterator } from "./event-iterator";

t.test("EventIterator - event iterator", async (t) => {
  const et = new EventTarget();
  const test = new EventIterator(et, ["open", "message"]);

  const n = test[Symbol.asyncIterator]();
  const promises = [
    n.next().then((a) => {
      t.hasStrict(a.value, { data: "hi" });
    }),
    n.next().then((a) => {
      t.hasStrict(a.value, { data: "there" });
    }),
  ];
  et.dispatchEvent(new MessageEvent("open", { data: "hi" }));
  et.dispatchEvent(new MessageEvent("message", { data: "there" }));
  await Promise.all(promises);
});
