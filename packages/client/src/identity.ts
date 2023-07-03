import * as jose from "jose";
import {
  TransportCreator,
  SenderTransport,
  ReceiverTransport,
  P2PTransportCreator,
} from "./transports";
import { InitiatorCryptoContext, JoinerCryptoContext } from "./crypto";
import {
  Base64EnvelopeEncoding,
  EnvelopeEncoding,
  InternalFormat,
  InternalFormatJson,
  HandshakeEnvelope,
} from "./encoding";
import { Message, MessageType } from "./chat-events";
import {
  didFromKeyBytes,
  EDWARDS_DID_PREFIX,
  keyBytesFromDid,
} from "./did/mod";
import {
  Session,
  SessionCreator,
  ConnectedSession,
  SessionEventType,
  SessionEventValues,
} from "./session";

export interface InviteParams {
  iss: Uint8Array;
  claims?: { addr?: string };
}

export interface Identity {
  encode(payload: Uint8Array): string;
  decode(param: string): Uint8Array;
  encodeInvite(params: InviteParams): string;
  decodeInvite(invite: string): InviteParams;
}

export class DecentralizedIdentity implements Identity {
  #prefix: Uint8Array;
  #defaultClaims?: InviteParams["claims"];

  constructor(
    defaultClaims: InviteParams["claims"] = {},
    prefix = EDWARDS_DID_PREFIX
  ) {
    this.#prefix = prefix;
    this.#defaultClaims = defaultClaims;
  }

  encode(payload: Uint8Array): string {
    return didFromKeyBytes(payload, this.#prefix);
  }

  decode(param: string): Uint8Array {
    return keyBytesFromDid(param, this.#prefix);
  }

  encodeInvite(params: InviteParams): string {
    const { iss, claims } = params;
    const unsecuredJwt = new jose.UnsecuredJWT({
      ...this.#defaultClaims,
      ...claims,
    })
      .setIssuer(this.encode(iss))
      .encode();
    return unsecuredJwt;
  }

  decodeInvite(param: string): InviteParams {
    const unsecuredJwt = jose.UnsecuredJWT.decode(param);
    if (!unsecuredJwt.payload.iss) {
      throw new Error("invalid invite");
    }
    console.log("invite payload", unsecuredJwt);
    const iss = this.decode(unsecuredJwt.payload.iss);
    const parsedClaims = unsecuredJwt.payload as InviteParams["claims"];
    const claims: InviteParams["claims"] = {};
    if (parsedClaims?.addr) {
      claims.addr = parsedClaims.addr;
    }
    return { iss, claims };
  }
}

export class EphemeralHPKEIdentity {
  #username?: string;
  #sessionCreator: SessionCreator;
  #format: InternalFormat;
  #wireFormat: EnvelopeEncoding;

  constructor(
    sessionCreator: SessionCreator,
    format: InternalFormat = new InternalFormatJson(),
    wireFormat: EnvelopeEncoding = new Base64EnvelopeEncoding(),
    protected readonly transportCreator: TransportCreator,
    { username }: { username: string }
  ) {
    this.#username = username;
    this.#sessionCreator = sessionCreator;
    this.#format = format;
    this.#wireFormat = wireFormat;
  }

  protected async accept(channelId: string): Promise<
    | {
        ok: true;
        message: string;
        senderTransport: SenderTransport;
        receiverTransport: ReceiverTransport;
      }
    | { ok: false }
  > {
    const { senderTransport, receiverTransport } =
      await this.transportCreator.createTransports();
    for await (const event of receiverTransport.listen(channelId)) {
      if (event.type === "open") {
        console.log("open", event);
      } else if (event.type === "error") {
        console.log("error", event);
      } else {
        try {
          // TODO drop if not intended for us
          return {
            message: event.data,
            ok: true,
            senderTransport,
            receiverTransport,
          };
        } catch (e) {
          console.warn(event, e);
        }
      }
    }
    return { ok: false };
  }

  async initSessionFromKeyBundle(invite: string) {
    const joiner = new JoinerCryptoContext();

    const joinMessage: Message<MessageType.meta> = {
      type: MessageType.meta,
      name: this.#username || "👽",
      id: 0,
      lastSeenId: 0,
    };
    const plaintext = this.#format.encode(joinMessage);

    const { envelope, toChannelId, sessionId, toSessionId } =
      await joiner.initSender(invite.iss, plaintext);

    const session = await this.#sessionCreator.joinWithInvite(
      invite,
      this.format.encode(joinMessage)
    );
  }
}
