export type Message = {
  uid: string;
  id?: number;
  msg?: string;
  files?: {
    name: string;
    ref: string;
    mime: string;
    key: JsonWebKey;
    iv: string;
  }[];
  lastSeenId?: number;
  self?: boolean;
  seen?: boolean;
  system?: boolean;
  time?: number;
};

export type DisplayMessage = Omit<Message, "msg"> &
  Required<Pick<Message, "msg">>;
