import { ComponentChildren } from "preact";
import { useContext, useEffect, useRef } from "preact/hooks";
import { useSignal, computed } from "@preact/signals";
import { DisplayMessage } from "../lib/types";
import { AppState } from "../lib/state";
import { Spinner } from "./Spinner";

type Expanded = string | { img: string; ltr: boolean };

const EMOJI_REGEX = /^(\p{Extended_Pictographic}|\p{Emoji_Presentation})+$/u;

const expandables: Record<string, Expanded> = {
  "~=[,,_,,]:3": { img: "/expand/nyan-cat.gif", ltr: true },
  "/nyan": { img: "/expand/nyan-cat.gif", ltr: true },
  "/ryu": { img: "/expand/ryu.gif", ltr: false },
  "/ken": { img: "/expand/ken.gif", ltr: true },
};

function expandMessage(msg: string, isSelf: boolean) {
  if (msg in expandables) {
    const mapped = expandables[msg];
    if (typeof mapped === "string") {
      msg = mapped;
    } else {
      const orient =
        (mapped.ltr && isSelf) || (!mapped.ltr && !isSelf)
          ? "-scale-x-100"
          : "";
      return <img src={mapped.img} className={`${orient} max-h-32`} />;
    }
  }
  if (typeof msg === "string" && EMOJI_REGEX.test(msg)) {
    return <EmojiMessage msg={msg} />;
  }
  return isSelf ? SelfBubble(msg) : PartnerBubble(msg);
}

export function MessageBox(message: DisplayMessage) {
  if (message.system) {
    return SystemMessage(message);
  }
  const expanded = expandMessage(message.msg, !!message.self);
  const isSelf = message.self;
  return isSelf ? (
    <>
      {message.files && (
        <SelfMessage message={message}>
          <Attachments files={message.files} />
        </SelfMessage>
      )}
      {message.msg && <SelfMessage message={message}>{expanded}</SelfMessage>}
    </>
  ) : (
    <>
      {message.files && (
        <OtherMessage message={message}>
          <Attachments files={message.files} />
        </OtherMessage>
      )}
      {message.msg && <OtherMessage message={message}>{expanded}</OtherMessage>}
    </>
  );
}

function SelfBubble(text: string) {
  return (
    <div className="relative sm:max-w-xl max-w-[80%] px-4 py-2 text-white bg-info rounded-lg rounded-br-none">
      <span className="block">{text}</span>
    </div>
  );
}

function PartnerBubble(text: string) {
  return (
    <div className="relative sm:max-w-xl max-w-[80%] px-4 py-2 dark:text-white fg-base-content dark:bg-gray-700 bg-base-200 rounded-lg rounded-bl-none">
      <span className="block">{text}</span>
    </div>
  );
}

export function SystemMessage({ msg, uid }: DisplayMessage) {
  return (
    <li
      id={uid}
      data-author="self"
      className={`flex justify-center my-4 text-gray-400 italic text-center`}
    >
      {msg}
    </li>
  );
}

function isImage(mime: string) {
  return mime.startsWith("image/");
}

function Attachment({
  file,
}: {
  file: Required<DisplayMessage>["files"][number];
}) {
  const { attachmentStore } = useContext(AppState);
  const uri = useSignal<string>("");
  const ref = useRef<HTMLImageElement>(null);
  const hasLoaded = computed(() => uri.value !== "");
  useEffect(() => {
    const fn = async () => {
      console.log("fetching", file);
      const raw = await attachmentStore.get(file).catch((e) => {
        console.error("failed to fetch attachment", e);
        throw e;
      });
      console.log("got raw");
      const blob = new Blob([raw.data], { type: file.mime });
      // convert to data uri using URL.createObjectURL
      const blobUri = URL.createObjectURL(blob);
      console.log("uri", blobUri);
      uri.value = blobUri;
    };
    fn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachmentStore, file]);
  console.log("hasLoaded", hasLoaded.value, file.name, uri.value);
  return isImage(file.mime) ? (
    hasLoaded.value ? (
      <img
        ref={ref}
        src={uri.value}
        onLoad={() => {
          if (ref.current) {
            URL.revokeObjectURL(ref.current.src);
          }
        }}
        className="max-h-48 rounded-lg"
      />
    ) : (
      <Spinner />
    )
  ) : hasLoaded.value ? (
    <a href={uri.value} download={file.name}>
      {file.name}
    </a>
  ) : (
    <a href={uri.value} download={file.name}>
      <Spinner />
      {file.name}
    </a>
  );
}

function Attachments({ files }: Required<Pick<DisplayMessage, "files">>) {
  return (
    <div className="flex flex-col">
      {files.map((file) => (
        <span key={file.ref}>
          <Attachment file={file} />
        </span>
      ))}
    </div>
  );
}

interface MessageProps {
  message: DisplayMessage;
  children: ComponentChildren;
}

export function SelfMessage({ message, children }: MessageProps) {
  const seenStyle = message.seen ? "" : "opacity-90";
  return (
    <li
      id={message.uid}
      data-author="self"
      className={`${seenStyle} peer flex justify-end peer-change-self:mt-4`}
    >
      {children}
    </li>
  );
}

export function OtherMessage({ message, children }: MessageProps) {
  return (
    <li
      id={message.uid}
      data-author="other"
      className="peer flex justify-start peer-change-other:mt-4"
    >
      {children}
    </li>
  );
}

function EmojiMessage({ msg }: { msg: string }) {
  const len = [...msg].length;
  const sizeClass = len <= 6 ? "text-6xl py-5" : "";
  return (
    <div className={`relative px-4 py-2 ${sizeClass}`}>
      <span className="block">{msg}</span>
    </div>
  );
}
