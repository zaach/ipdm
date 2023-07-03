import { InitiatorCryptoContext, JoinerCryptoContext } from "./crypto";
import { Base64EnvelopeEncoding, EnvelopeEncoding } from "./encoding";
import { encodeUrlParam } from "./param-encoding";
import {
  FetchSenderTransport,
  HttpTransportCreator,
  ReceiverTransport,
  SenderTransport,
  SendResponse,
  SseTransport,
  TransportCreator,
  TransportParams,
} from "./transports";
import { DecentralizedIdentity, Identity } from "./identity";

export enum SessionEventType {
  channel_error = "channel_error",
  channel_open = "channel_open",
  open_error = "open_error",
  message = "message",
  handshake = "handshake",
}

interface BaseSessionEvent {
  [SessionEventType.channel_open]: { readyState: number };
  [SessionEventType.channel_error]: { readyState: number };
  [SessionEventType.message]: ArrayBuffer;
  [SessionEventType.handshake]: ArrayBuffer;
  [SessionEventType.open_error]: Record<never, never>;
}

interface SessionEvent<D extends keyof BaseSessionEvent> {
  type: D;
  detail: BaseSessionEvent[D];
}

type SessionEvents = {
  [K in keyof BaseSessionEvent]: SessionEvent<K>;
};
export type SessionEventValues = SessionEvents[keyof SessionEvents];

export interface Session {
  sessionId?: string;
  toSessionId?: string;

  listen(): AsyncGenerator<SessionEventValues, void, void>;
  send: (body: ArrayBuffer) => Promise<SendResponse & { requestId: number }>;
  disconnect(): Promise<void>;
}

export interface SessionWithReplay extends Session {
  clearCache(requestIds: number[]): void;
  resendFromCache(requestIds: number[]): Promise<void>;
}

export type ConnectedSession<SessionType extends Session = Session> = Omit<
  SessionType,
  "sessionId" | "toSessionId"
> &
  Required<Pick<Session, "sessionId" | "toSessionId">>;

export class EncryptedSession implements Session {
  sessionId?: string;
  toSessionId?: string;

  constructor(
    protected cryptoContext: InitiatorCryptoContext | JoinerCryptoContext,
    protected receiver: ReceiverTransport = new SseTransport(),
    protected sender: SenderTransport = new FetchSenderTransport(),
    protected wireFormat: EnvelopeEncoding = new Base64EnvelopeEncoding(),
    protected enableCache = true
  ) {}

  async disconnect() {
    await this.receiver.close();
  }

  async *waitForJoin(): AsyncGenerator<SessionEventValues, void, void> {
    if (
      !(this.cryptoContext instanceof InitiatorCryptoContext) ||
      !this.cryptoContext.handshakeChannelId
    ) {
      throw new Error("Must be the initiating party to accept joins");
    }
    const channelId = encodeUrlParam(this.cryptoContext.handshakeChannelId);
    for await (const event of this.receiver.listen(channelId)) {
      if (event.type === "open") {
        yield this.#openEvent(event);
      } else if (event.type === "error") {
        yield this.#errorEvent(event);
      } else {
        try {
          const decoded = this.wireFormat.decodeHandshakeEnvelope(event.data);
          const { plaintext, toSessionId, sessionId } =
            await this.cryptoContext.handleJoin(decoded);
          this.sessionId = encodeUrlParam(sessionId);
          this.toSessionId = encodeUrlParam(toSessionId);
          yield this.#event(SessionEventType.handshake, plaintext);
          return;
        } catch (e) {
          console.warn(event, e);
        }
      }
    }
  }

  async join(pk: Uint8Array, plaintext: ArrayBuffer) {
    if (!(this.cryptoContext instanceof JoinerCryptoContext)) {
      throw new Error("Must be the joining party to join");
    }

    const { envelope, toChannelId, sessionId, toSessionId } =
      await this.cryptoContext.initSender(pk, plaintext);
    const encoded = this.wireFormat.encodeHandshakeEnvelope(envelope);
    this.sessionId = encodeUrlParam(sessionId);
    this.toSessionId = encodeUrlParam(toSessionId);
    await this.sender.send(encoded, encodeUrlParam(toChannelId));
  }

  #event<T extends keyof BaseSessionEvent>(
    type: T,
    detail: BaseSessionEvent[T]
  ): SessionEvent<T> {
    return {
      type,
      detail,
    };
  }

  #openEvent(event: MessageEvent) {
    return this.#event(SessionEventType.channel_open, {
      readyState:
        (event.target as EventSource)?.readyState ?? event.data?.readyState,
    });
  }
  #errorEvent(event: MessageEvent) {
    return this.#event(SessionEventType.channel_error, {
      readyState:
        (event.target as EventSource)?.readyState ?? event.data?.readyState,
    });
  }

  async *listen(): AsyncGenerator<SessionEventValues, void, void> {
    if (!this.sessionId) {
      throw this.notInitializedError();
    }
    for await (const event of this.receiver.listen(this.sessionId)) {
      if (event.type === "open") {
        yield this.#openEvent(event);
      } else if (event.type === "error") {
        yield this.#errorEvent(event);
      } else {
        try {
          const decoded = this.wireFormat.decodeEnvelope(event.data);
          const plaintext = await this.cryptoContext.open(
            decoded.payload,
            decoded.header
          );
          yield this.#event(SessionEventType.message, plaintext);
        } catch (e) {
          console.warn(event, e);
          yield this.#event(SessionEventType.open_error, {});
        }
      }
    }
  }

  #requestIds = 0;
  protected async senderSend(encoded: string) {
    const requestId = this.#requestIds++;
    const result = await this.sender.send(encoded, this.toSessionId!);
    return { ...result, requestId };
  }

  async send(
    plaintext: ArrayBuffer
  ): Promise<SendResponse & { requestId: number }> {
    if (!this.toSessionId) {
      throw this.notInitializedError();
    }
    const encrypted = await this.cryptoContext.seal(plaintext);
    const encoded = this.wireFormat.encodeEnvelope(encrypted);
    return this.senderSend(encoded);
  }

  protected notInitializedError() {
    return new Error("Not initialized");
  }
}

export interface SessionCreator<
  BaseSessionType extends Session = Session,
  SessionType = ConnectedSession<BaseSessionType>
> {
  waitForJoin(handleEvent?: (e: SessionEventValues) => void): Promise<{
    invite: string;
    joinPromise: Promise<{
      joinMessage: ArrayBuffer;
      session: SessionType;
    }>;
  }>;
  joinWithInvite(
    invite: string,
    joinMessage: ArrayBuffer
  ): Promise<ConnectedSession<BaseSessionType>>;
}

export class EncryptedSessionCreator<
  BaseSessionType extends Session = EncryptedSession
> implements SessionCreator<BaseSessionType>
{
  constructor(
    protected readonly transportCreator: TransportCreator = new HttpTransportCreator(),
    protected readonly identity: Identity = new DecentralizedIdentity()
  ) {}

  protected async createInitiatorSession(
    initiator: InitiatorCryptoContext,
    params?: TransportParams
  ) {
    const { senderTransport, receiverTransport } =
      await this.transportCreator.createTransports(params);
    return new EncryptedSession(initiator, receiverTransport, senderTransport);
  }
  protected async createJoinerSession(
    joiner: JoinerCryptoContext,
    params?: TransportParams
  ) {
    const { senderTransport, receiverTransport } =
      await this.transportCreator.createTransports(params);
    return new EncryptedSession(joiner, receiverTransport, senderTransport);
  }

  async #createInvite() {
    const initiator = new InitiatorCryptoContext();
    const { serializedPublicKey: ipk } = await initiator.init();
    const invite = this.identity.encodeInvite({ iss: new Uint8Array(ipk) });
    return { initiator, invite };
  }

  public async waitForJoin(
    handleEvent?: (e: SessionEventValues) => void
  ): Promise<{
    invite: string;
    joinPromise: Promise<{
      joinMessage: ArrayBuffer;
      session: ConnectedSession<BaseSessionType>;
    }>;
  }> {
    const { initiator, invite } = await this.#createInvite();
    const session = await this.createInitiatorSession(initiator);
    return {
      invite,
      // eslint-disable-next-line no-async-promise-executor
      joinPromise: new Promise(async (resolve, _reject) => {
        let result: ArrayBuffer;
        for await (const evt of session.waitForJoin()) {
          if (evt.type === SessionEventType.handshake) {
            result = evt.detail;
            break;
          }
          if (handleEvent) {
            handleEvent(evt);
          }
        }
        return resolve({
          joinMessage: result!,
          session: this.#asConnectedSession(session),
        });
      }),
    };
  }

  public async joinWithInvite(
    invite: string,
    joinMessage: ArrayBuffer
  ): Promise<ConnectedSession<BaseSessionType>> {
    const joiner = new JoinerCryptoContext();
    const data = this.identity.decodeInvite(invite);
    const joinerSession = await this.createJoinerSession(
      joiner,
      data.claims?.addr
        ? {
            connectingAddress: data.claims.addr,
          }
        : undefined
    );
    await joinerSession.join(data.iss, joinMessage);
    return this.#asConnectedSession(joinerSession);
  }

  #isSessionConnected(
    session: Session
  ): session is ConnectedSession<BaseSessionType> {
    if (!("sessionId" in session) || !("toSessionId" in session)) {
      return false;
    }
    return true;
  }
  #asConnectedSession(session: Session): ConnectedSession<BaseSessionType> {
    if (!this.#isSessionConnected(session)) {
      throw new Error("bad session");
    }
    return session;
  }
}

export class EncryptedSessionWithReplay extends EncryptedSession {
  #requestCache: Map<number, string> = new Map();

  protected async senderSend(encoded: string) {
    const result = await super.senderSend(encoded);
    this.#requestCache.set(result.requestId, encoded);
    return result;
  }

  clearCache(requestIds: number[]): void {
    for (const id of requestIds) {
      this.#requestCache.delete(id);
    }
  }
  async resendFromCache(requestIds: number[]): Promise<void> {
    if (!this.toSessionId) {
      throw this.notInitializedError();
    }
    for (const requestId of requestIds) {
      const encoded = this.#requestCache.get(requestId);
      if (encoded) {
        await this.sender.send(encoded, this.toSessionId);
      }
    }
  }
}

export class EncryptedSessionWithReplayCreator<
  BaseSessionType extends EncryptedSessionWithReplay = EncryptedSessionWithReplay
> extends EncryptedSessionCreator<BaseSessionType> {
  protected async createInitiatorSession(
    initiator: InitiatorCryptoContext,
    params?: TransportParams
  ) {
    const { senderTransport, receiverTransport } =
      await this.transportCreator.createTransports(params);
    return new EncryptedSessionWithReplay(
      initiator,
      receiverTransport,
      senderTransport
    );
  }
  protected async createJoinerSession(
    joiner: JoinerCryptoContext,
    params?: TransportParams
  ) {
    const { senderTransport, receiverTransport } =
      await this.transportCreator.createTransports(params);
    return new EncryptedSessionWithReplay(
      joiner,
      receiverTransport,
      senderTransport
    );
  }
}
