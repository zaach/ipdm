import * as hpke from "hpke-js";
import * as ed25519 from "@stablelib/ed25519";
import * as uint8arrays from "uint8arrays";

const { Kem, Kdf, Aead, CipherSuite } = hpke;

const EMPTY_SALT = new Uint8Array(0).buffer as ArrayBuffer;
const LABEL_CHANNEL_ID = new TextEncoder().encode("channel_id");
const EXPORT_LABEL_NONCE = new TextEncoder().encode("ipdm nonce").buffer as ArrayBuffer;
const EXPORT_LABEL_KEY = new TextEncoder().encode("ipdm key").buffer as ArrayBuffer;
const EXPORT_LABEL_SESSIONID_RECIPIENT = new TextEncoder().encode(
  "ipdm recipient session id"
).buffer as ArrayBuffer;
const EXPORT_LABEL_SESSIONID_SENDER = new TextEncoder().encode(
  "ipdm sender session id"
).buffer as ArrayBuffer;

export interface Envelope {
  // header: channelid
  header: ArrayBuffer;
  // payload: ciphertext
  payload: ArrayBuffer;
}
export interface HandshakeEnvelope {
  // header: context and ciphertext
  header: [ArrayBuffer, ArrayBuffer];
  // payload: context and ciphertext
  payload: [ArrayBuffer, ArrayBuffer];
}

export type ByteLike = ArrayBuffer | Uint8Array<ArrayBuffer>;
function byteParam(param: ByteLike): ArrayBuffer {
  return "buffer" in param ? param.buffer as ArrayBuffer : param;
}

const concatBuffers = function (buffer1: ArrayBuffer, buffer2: ArrayBuffer): ArrayBuffer {
  return uint8arrays.concat([new Uint8Array(buffer1), new Uint8Array(buffer2)]).buffer as ArrayBuffer;
};

// bidirectional refactor: https://github.com/dajiaji/hpke-js/issues/284

export abstract class Encrypter {
  sessionId?: ArrayBuffer;
  toSessionId?: ArrayBuffer;
  nonce?: ArrayBuffer;
  protected context?: hpke.AeadEncryptionContext;

  constructor(
    protected suite = new CipherSuite({
      kem: Kem.DhkemX25519HkdfSha256,
      kdf: Kdf.HkdfSha256,
      aead: Aead.Aes256Gcm,
    })
  ) {}

  async seal(
    bytes: ByteLike,
    additionalData?: ArrayBuffer
  ): Promise<Envelope> {
    if (!this.context || !this.toSessionId || !this.nonce) {
      throw new Error("CryptoContext not initialized");
    }
    const ad = additionalData
      ? concatBuffers(this.toSessionId, additionalData)
      : this.toSessionId;
    return {
      header: ad,
      payload: await this.context.seal(this.nonce, byteParam(bytes), ad),
    };
  }

  async open(
    bytes: ByteLike,
    header: ArrayBuffer,
    additionalData?: ArrayBuffer
  ): Promise<ArrayBuffer> {
    if (!this.context || !this.nonce) {
      throw new Error("CryptoContext not initialized");
    }
    const ad = additionalData ? concatBuffers(header, additionalData) : header;
    try {
      const result = await this.context.open(this.nonce, byteParam(bytes), ad);
      return result;
    } catch (err) {
      console.log("failed to decrypt.", err);
      throw err;
    }
  }

  protected async deriveChannelId(pubkey: ArrayBuffer): Promise<ArrayBuffer> {
    const raw = await this.suite.kdf.labeledExtract(
      EMPTY_SALT,
      LABEL_CHANNEL_ID,
      new Uint8Array(pubkey)
    );
    // use first 16 bits of hashed public key
    const truncated = new Uint8Array(16);
    truncated.set(new Uint8Array(raw, 0, 16));
    return truncated.buffer;
  }
}

export class InitiatorCryptoContext extends Encrypter {
  #sk?: CryptoKey;
  handshakeChannelId?: ArrayBuffer;

  // Create a stable keypair for this instance
  async init(): Promise<{
    serializedPublicKey: ArrayBuffer;
    handshakeChannelId: ArrayBuffer;
  }> {
    const edkp = ed25519.generateKeyPair();
    const x25519sk = ed25519.convertSecretKeyToX25519(edkp.secretKey).buffer as ArrayBuffer;
    this.#sk = await this.suite.importKey("raw", x25519sk, false);
    // serialize publicKey for sharing
    const serializedPublicKey = edkp.publicKey.buffer as ArrayBuffer;
    const handshakeChannelId = await this.deriveChannelId(serializedPublicKey);
    this.handshakeChannelId = handshakeChannelId;
    return { serializedPublicKey, handshakeChannelId };
  }

  async handleJoin(envelope: HandshakeEnvelope): Promise<{
    plaintext: ArrayBuffer;
    sessionId: ArrayBuffer;
    toSessionId: ArrayBuffer;
  }> {
    if (!this.#sk || !this.handshakeChannelId) {
      throw new Error("CryptoContext not initialized");
    }

    const [senderPkContext, senderPkCiphertext] = envelope.header;
    const [senderInitContext, senderInitCiphertext] = envelope.payload;

    let senPubKeyRaw;
    try {
      senPubKeyRaw = await this.suite.open(
        {
          recipientKey: this.#sk,
          enc: senderPkContext,
        },
        senderPkCiphertext,
        senderInitCiphertext
      );
    } catch (err) {
      console.log("failed to decrypt sender public key.", err);
      throw err;
    }
    if (!senPubKeyRaw) {
      throw new Error("Could not decrypt handshake payload");
    }

    const senderPublicKey = await this.suite.importKey(
      "raw",
      ed25519.convertPublicKeyToX25519(new Uint8Array(senPubKeyRaw)).buffer as ArrayBuffer
    );

    const recipient = await this.suite.createRecipientContext({
      recipientKey: this.#sk,
      enc: senderInitContext,
      senderPublicKey,
    });

    const keySeed = await recipient.export(EXPORT_LABEL_KEY, this.suite.aead.keySize);
    const nonceSeed = await recipient.export(EXPORT_LABEL_NONCE, this.suite.aead.nonceSize);
    const sessionId = await recipient.export(
      EXPORT_LABEL_SESSIONID_RECIPIENT,
      16
    );
    const toSessionId = await recipient.export(
      EXPORT_LABEL_SESSIONID_SENDER,
      16
    );

    const encContext = await this.suite.aead.createEncryptionContext(keySeed);
    this.nonce = nonceSeed;
    this.context = encContext;
    this.sessionId = sessionId;
    this.toSessionId = toSessionId;

    // decrypt
    let plaintext = new ArrayBuffer(0);
    try {
      plaintext = await this.context.open(
        nonceSeed,
        senderInitCiphertext,
        this.handshakeChannelId
      );
    } catch (err) {
      console.log("failed to decrypt.", err);
      throw err;
    }

    return {
      plaintext,
      sessionId,
      toSessionId,
    };
  }
}

export class JoinerCryptoContext extends Encrypter {
  toChannelId?: ArrayBuffer;

  async initSender(
    receiverPublicKeyRaw: ArrayBuffer,
    appPayload: ByteLike
  ): Promise<{
    envelope: HandshakeEnvelope;
    toChannelId: ArrayBuffer;
    sessionId: ArrayBuffer;
    toSessionId: ArrayBuffer;
  }> {
    const edkp = ed25519.generateKeyPair();
    const x25519sk = ed25519.convertSecretKeyToX25519(edkp.secretKey);
    const sk = await this.suite.importKey("raw", x25519sk.buffer as ArrayBuffer, false);
    // import receiver public key received from outside channel
    const recPubKey = await this.suite.importKey(
      "raw",
      ed25519.convertPublicKeyToX25519(new Uint8Array(receiverPublicKeyRaw)).buffer as ArrayBuffer
    );

    // setup sender context
    const sender = await this.suite.createSenderContext({
      recipientPublicKey: recPubKey,
      senderKey: sk,
    });

    const keySeed = await sender.export(EXPORT_LABEL_KEY, this.suite.aead.keySize);
    const nonceSeed = await sender.export(EXPORT_LABEL_NONCE, this.suite.aead.nonceSize);
    const toSessionId = await sender.export(
      EXPORT_LABEL_SESSIONID_RECIPIENT,
      16
    );
    const sessionId = await sender.export(EXPORT_LABEL_SESSIONID_SENDER, 16);

    const encContext = await this.suite.aead.createEncryptionContext(keySeed);

    const toChannelId = await this.deriveChannelId(receiverPublicKeyRaw);
    this.toChannelId = toChannelId;
    this.sessionId = sessionId;
    this.toSessionId = toSessionId;
    this.context = encContext;
    this.nonce = nonceSeed;
    const senderInitCiphertext = await encContext.seal(
      nonceSeed,
      byteParam(appPayload),
      toChannelId
    );

    // Create encrypted header containing sender public key
    const serializedPublicKey = edkp.publicKey.buffer as ArrayBuffer;
    const { ct: senderPkCiphertext, enc: senderPkContext } =
      await this.suite.seal(
        {
          recipientPublicKey: recPubKey,
        },
        serializedPublicKey, // plaintext
        senderInitCiphertext // use main payload as additional data to bind header to payload
      );

    return {
      toChannelId,
      sessionId,
      toSessionId,
      envelope: {
        payload: [sender.enc, senderInitCiphertext],
        header: [senderPkContext, senderPkCiphertext],
      },
    };
  }
}
