import tap from "tap";
import { InitiatorCryptoContext, JoinerCryptoContext } from "./crypto";
import {
  EncryptedSession,
  EncryptedSessionCreator,
  SessionEventType,
} from "./session";
import { ReceiverTransport, SenderTransport, SendResponse } from "./transports";
import { EventIterator } from "./event-iterator";

tap.mochaGlobals();

function assertEquals(a: any, b: any) {
  tap.strictSame(a, b);
}

class TestReceiverTransport implements ReceiverTransport {
  constructor(private et: EventTarget) {}
  async *listen(_channelId: string) {
    const iterator = new EventIterator(this.et, ["open", "message"])[
      Symbol.asyncIterator
    ]();
    for await (const ev of iterator) {
      yield ev;
    }
  }
  close() {
    return Promise.resolve();
  }
}

class TestSenderTransport implements SenderTransport {
  constructor(private et: EventTarget) {}
  send(data: string, _channelId: string) {
    this.et.dispatchEvent(new MessageEvent("message", { data }));
    return Promise.resolve({} as SendResponse);
  }
}

class TestEncryptedSessionCreator extends EncryptedSessionCreator {
  constructor(
    private joinerSendEvents: EventTarget,
    private initiatorSendEvents: EventTarget
  ) {
    super();
  }

  protected createInitiatorSession(initiator: InitiatorCryptoContext) {
    return new EncryptedSession(
      initiator,
      new TestReceiverTransport(this.joinerSendEvents),
      new TestSenderTransport(this.initiatorSendEvents)
    );
  }

  protected createJoinerSession(joiner: JoinerCryptoContext) {
    return new EncryptedSession(
      joiner,
      new TestReceiverTransport(this.initiatorSendEvents),
      new TestSenderTransport(this.joinerSendEvents)
    );
  }
}

function msg(detail: Record<string, unknown>): {
  type: SessionEventType.message;
  detail: Record<string, unknown>;
} {
  return { type: SessionEventType.message, detail };
}

describe("EncryptedSession", () => {
  it("sessionCreator", async function () {
    const joinerSendEvents = new EventTarget();
    const initiatorSendEvents = new EventTarget();
    const creator = new TestEncryptedSessionCreator(
      joinerSendEvents,
      initiatorSendEvents
    );

    const invite = await creator.createInvite();

    (async function () {
      const { joinMessage, session } = await creator.waitForJoin(invite);
      assertEquals(joinMessage, { nice: "v nice" });

      await session.send({ ello: "poppet" });
      await session.send({ ello: "guvnah" });

      const iReceiver = session.listen();

      await iReceiver
        .next()
        .then((e) => assertEquals(e.value, msg({ req: "res" })));
      await iReceiver
        .next()
        .then((e) => assertEquals(e.value, msg({ send: "recv" })));
    })();

    await creator
      .joinWithInvite(invite, {
        nice: "v nice",
      })
      .then(async (joinerSession) => {
        const jReceiver = joinerSession.listen();
        await jReceiver
          .next()
          .then((e) => assertEquals(e.value, msg({ ello: "poppet" })));
        await jReceiver
          .next()
          .then((e) => assertEquals(e.value, msg({ ello: "guvnah" })));
        await joinerSession.send({ req: "res" });
        await joinerSession.send({ send: "recv" });
      });
  });
});
