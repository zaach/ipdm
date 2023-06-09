import * as jose from "jose";
import {
  didFromKeyBytes,
  EDWARDS_DID_PREFIX,
  keyBytesFromDid,
} from "./did/mod";

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
