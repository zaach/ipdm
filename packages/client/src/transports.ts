export interface ReceiverTransport {
  listen(url: string): AsyncGenerator<MessageEvent, void, void>;
  close(): Promise<void>;
}

export type SendResponse = Pick<Response, "ok" | "status" | "statusText">;
export interface SenderTransport {
  send: (body: string, channelId: string) => Promise<SendResponse>;
  close(): Promise<void>;
}

export interface TransportCreator {
  createSenderTransport: () => Promise<SenderTransport>;
  createReceiverTransport: () => Promise<ReceiverTransport>;
}

export * from "./transports/http";
export * from "./transports/p2p";
