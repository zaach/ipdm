import type { Libp2p } from "libp2p";
import { InternalFormat, InternalFormatJson } from "./encoding";
import {
  BaseChatEvent,
  BaseMessages,
  ChatEvent,
  ChatEventType,
  Message,
  MessageType,
  MessageValue,
} from "./chat-events";
import {
  ConnectedSession,
  EncryptedSessionWithReplayCreator,
  Session,
  SessionCreator,
  SessionEventType,
  SessionEventValues,
  SessionWithReplay,
} from "./session";
import { DecentralizedIdentity } from "./identity";
import { HttpTransportCreator, P2PTransportCreator } from "./transports";

export class ChatContext<
  SessionCreatorType extends SessionCreator = SessionCreator
> {
  protected session?: ConnectedSession<Session>;
  #username?: string;
  #sendCount = 0;
  #lastSendTime = 0;
  #lastSeenId = 0;
  #lastSeenTime = 0;
  #partnerIsIdle = true;

  constructor(
    public eventTarget: EventTarget,
    private sessionCreator: SessionCreatorType,
    protected format: InternalFormat = new InternalFormatJson()
  ) {}

  static createEncryptedChatContext({
    baseApiUrl,
  }: { baseApiUrl?: string } = {}) {
    let config;
    if (baseApiUrl) {
      config = {
        baseSendApiUrl: `${baseApiUrl}/api/send?channelId=`,
        baseRecieveApiUrl: `${baseApiUrl}/api/sse?channelId=`,
      };
    }
    const eventTarget = new EventTarget();
    const chatContext = new DurableChatContext(
      eventTarget,
      new EncryptedSessionWithReplayCreator(new HttpTransportCreator(config))
    );
    return chatContext;
  }

  static async createP2PEncryptedChatContext({
    node,
    connectingAddr,
  }: {
    node: Libp2p;
    connectingAddr?: string;
  }) {
    const eventTarget = new EventTarget();
    const transportCreator = new P2PTransportCreator(node);
    const identity = new DecentralizedIdentity({ addr: connectingAddr });
    const chatContext = new DurableChatContext(
      eventTarget,
      new EncryptedSessionWithReplayCreator(transportCreator, identity)
    );
    return chatContext;
  }

  protected emit<T extends keyof BaseChatEvent, D extends BaseChatEvent[T]>(
    type: T,
    detail: D
  ): void {
    this.eventTarget.dispatchEvent(new ChatEvent<T, D>(type, { detail }));
  }

  on<T extends ChatEventType>(type: T, fn: (e: ChatEvent<T>) => void) {
    ChatEvent.addTypedListener(this.eventTarget, type, fn);
  }

  async joinWithInvite(invite: string) {
    if (this.session) {
      return;
    }
    const joinMessage: Message<MessageType.meta> = {
      type: MessageType.meta,
      name: this.#username || "👽",
      id: 0,
      lastSeenId: 0,
    };
    this.session = await this.sessionCreator.joinWithInvite(
      invite,
      this.format.encode(joinMessage)
    );
    this.#listen();
    this.emit(ChatEventType.initiated, {});
  }

  async createInviteAndWait() {
    const { invite, joinPromise } = await this.sessionCreator.waitForJoin((e) =>
      this.#handleSessionJoinEvent(e)
    );
    this.emit(ChatEventType.invite, { invite });
    const { session, joinMessage } = await joinPromise;
    this.session = session;
    this.#listen();
    await this.#handleMessage(joinMessage);
    this.emit(ChatEventType.initiated, {});
    await this.#send(MessageType.meta, { name: this.#username || "🤡" });
  }
  #handleSessionJoinEvent(evt: SessionEventValues) {
    switch (evt.type) {
      case SessionEventType.channel_error:
        this.emit(ChatEventType.channel_error, evt.detail);
        break;
      case SessionEventType.channel_open:
        this.emit(ChatEventType.channel_open, evt.detail);
        break;
    }
  }

  async setUsername(name: string) {
    this.#username = name;
    if (this.session) {
      await this.#send(MessageType.meta, { name });
    }
  }

  async send(msg: BaseMessages[MessageType.message]) {
    if (this.session) {
      await this.#send(MessageType.message, msg);
    }
  }

  async ping() {
    return await this.sendAck();
  }

  protected async sendAck() {
    await this.#send(MessageType.ack, {});
  }

  async disconnect() {
    if (this.session) {
      await this.#send(MessageType.disconnect, {});
      await this.#disconnect(true);
    }
  }

  async #disconnect(local: boolean) {
    if (this.session) {
      await this.session.disconnect();
      this.emit(ChatEventType.disconnected, { local });
      this.session = undefined;
    }
  }

  protected async sessionSend(out: MessageValue) {
    return await this.session!.send(this.format.encode(out));
  }

  async #send<T extends keyof BaseMessages, B extends BaseMessages[T]>(
    type: T,
    body: B
  ) {
    if (this.session) {
      const id = ++this.#sendCount;
      const out = {
        ...body,
        type,
        id,
        lastSeenId: this.#lastSeenId,
      } as MessageValue;
      this.emit(ChatEventType.queued, out);
      try {
        await this.sessionSend(out);
        this.#lastSendTime = Date.now();

        this.emit(ChatEventType.sent, out);
        setTimeout(() => this.#pollAck(), 31_000);
      } catch (_) {
        this.emit(ChatEventType.failed, out);
      }
    }
  }
  #pollAck() {
    // Send an ack 30 seconds after the last send unless the partner appears idle
    // or another message has been sent in the meantime
    const halfAMinuteAgo = Date.now() - 30_000;
    if (!this.#partnerIsIdle && this.#lastSendTime < halfAMinuteAgo) {
      this.sendAck();
    }
  }

  protected decodePlaintext(plaintext: ArrayBuffer): MessageValue {
    const data = this.format.decode(plaintext);
    if (!this.#isMsg(data)) {
      throw new Error("bad message");
    }
    return data;
  }
  #isMsg(data: any): data is MessageValue {
    if (!("id" in data) || !("type" in data) || !("lastSeenId" in data)) {
      return false;
    }
    return true;
  }

  async #handleMessage(plaintext: ArrayBuffer) {
    const msg = this.decodePlaintext(plaintext);
    if (msg.id > this.#lastSeenId) this.#lastSeenId = msg.id;
    this.#lastSeenTime = Date.now();
    if (this.#partnerIsIdle) {
      this.#partnerIsIdle = false;
      this.emit(ChatEventType.active, {});
    }

    this.emit(ChatEventType.message, msg);

    if (msg.type === MessageType.disconnect) {
      await this.#disconnect(false);
    }
    setTimeout(() => this.#checkIfIdle(), 61_000);
  }

  #checkIfIdle() {
    if (!this.session) return;
    // if a message hasn't been received in the last minute, flag as idle
    const aMinuteAgo = Date.now() - 60_000;
    if (!this.#partnerIsIdle && this.#lastSeenTime < aMinuteAgo) {
      this.#partnerIsIdle = true;
      this.emit(ChatEventType.idle, {});
    }
  }

  protected async *sessionListen() {
    for await (const evt of this.session!.listen()) {
      yield evt;
    }
  }

  async #listen() {
    if (!this.session) {
      throw new Error("Session hasn't been initiated.");
    }
    for await (const evt of this.sessionListen()) {
      switch (evt.type) {
        case SessionEventType.message:
          await this.#handleMessage(evt.detail);
          break;
      }
    }
  }
}

export class DurableChatContext extends ChatContext<EncryptedSessionWithReplayCreator> {
  protected declare session?: ConnectedSession<SessionWithReplay>;
  #lastSentId = 0;
  #lastClearId = 0;
  #partnerLastSeenId = 0;
  #outOfSync = false;
  #lastIdInSync = 0;
  #unconfirmedMessages: Map<number, number> = new Map();

  protected async sessionSend(out: MessageValue) {
    const result = await this.session!.send(this.format.encode(out));
    this.#unconfirmedMessages.set(out.id, result.requestId);
    this.#lastSentId = out.id;
    return result;
  }

  protected async *sessionListen() {
    let openErrors = 0;
    let channelErrored = false;
    this.#outOfSync = false;
    this.#lastIdInSync = this.#partnerLastSeenId; // id of the last good message they saw from us
    for await (const evt of this.session!.listen()) {
      switch (evt.type) {
        case SessionEventType.message: {
          const msg = this.decodePlaintext(evt.detail);
          openErrors = 0;
          this.#partnerLastSeenId = msg.lastSeenId;
          await this.#markMessagesConfirmedOrResend();
          // They're all caught up with our messages
          if (
            this.#outOfSync &&
            this.#partnerLastSeenId >= this.#lastIdInSync
          ) {
            this.#outOfSync = false;
          }
          break;
        }
        case SessionEventType.open_error:
          this.#lastIdInSync = this.#partnerLastSeenId;
          openErrors++;
          if (!this.#outOfSync) {
            // Send an ack if we can't open a message
            // so that the other party can resend any messages we might've missed
            await this.sendAck();
          }
          if (openErrors === 9) {
            // situation may be unrecoverable
            this.emit(ChatEventType.dead_session, { openErrors });
          }
          this.#outOfSync = true;
          break;
        case SessionEventType.channel_error:
          this.emit(ChatEventType.channel_error, evt.detail);
          channelErrored = true;
          break;
        case SessionEventType.channel_open:
          this.emit(ChatEventType.channel_open, evt.detail);
          // send an ack if we're recovering from a dropped connection
          if (channelErrored) {
            channelErrored = false;
            await this.sendAck();
          }
          break;
      }

      yield evt;
    }
  }

  async #markMessagesConfirmedOrResend() {
    // Clear out messages that have been confirmed received
    if (this.#partnerLastSeenId > this.#lastClearId) {
      this.#clearConfirmedFromCache(this.#partnerLastSeenId);
    }
    // Resend unconfirmed messages unless we're out of sync.
    // Out of sync means we missed old msgs from them, so we're waiting
    // for those to be resent in order to know the real `partnerLastSeenId`.
    // This avoids us spamming them prematurely.
    if (!this.#outOfSync && this.#partnerLastSeenId < this.#lastSentId) {
      await this.#resendUnconfirmed();
    }
  }
  #clearConfirmedFromCache(lastSeenId: number): void {
    const requestIds = [];
    for (const [id, requestId] of this.#unconfirmedMessages) {
      if (id <= lastSeenId) {
        requestIds.push(requestId);
        this.#unconfirmedMessages.delete(id);
      }
    }
    this.session!.clearCache(requestIds);
    this.#lastClearId = lastSeenId;
  }
  async #resendUnconfirmed(): Promise<void> {
    const requestIds = [...this.#unconfirmedMessages.values()];
    await this.session!.resendFromCache(requestIds);
  }
}
