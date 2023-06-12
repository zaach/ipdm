import { useCallback, useRef, useContext } from "preact/hooks";
import { computed, useSignal } from "@preact/signals";
import { AppState, ChatStatus } from "../lib/state";

export function SendField() {
  const { chatStatus, chatContext, attachmentStore } = useContext(AppState);
  const message = useSignal("");
  const files = useSignal<File[]>([]);
  const filesRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const disabled = computed(
    () =>
      chatStatus.value === ChatStatus.uninitialized ||
      chatStatus.value === ChatStatus.disconnected
  );

  const onRemoveAttachments = useCallback(() => {
    files.value = [];
  }, [files]);

  const onAttach = useCallback(() => {
    filesRef.current?.click();
  }, []);

  const onFileChange = useCallback(() => {
    const newFiles = filesRef.current?.files;
    if (newFiles) {
      files.value = Array.from(newFiles);
    }
  }, [files]);

  const onInputChange = useCallback(
    (e: any) => {
      message.value = e.currentTarget.value;
    },
    [message]
  );

  const onSubmit = useCallback(
    async (e: any) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (!disabled.value) {
        if (message.value === "/bye") {
          chatContext.disconnect();
          inputRef.current!.value = "";
          message.value = "";
        } else if (files.value.length > 0) {
          const msg = message.value;
          Promise.all(
            files.value.map(async (file) => {
              const res = await attachmentStore.put(await file.arrayBuffer());
              console.log("put", res);
              return {
                name: file.name,
                mime: file.type,
                key: res.key,
                iv: res.iv,
                ref: res.ref,
              };
            })
          ).then((res) => {
            console.log("files res", res);
            files.value = [];
            message.value = "";
            inputRef.current!.value = "";
            const data = {
              msg,
              files: res,
            };
            chatContext.send(data);
          });
        } else {
          const msg = {
            msg: message.value,
          };
          chatContext.send(msg);
          message.value = "";
          inputRef.current!.value = "";
        }
      }
    },
    [message, files, disabled.value, chatContext, attachmentStore]
  );

  console.log("render");

  return (
    <div className="sticky pwa:pb-10 bottom-0 bg-base-200 self-end items-center justify-between w-full p-3">
      <AttachedFiles
        files={files.value}
        onRemoveAttachments={onRemoveAttachments}
      />
      <form className="flex" onSubmit={onSubmit}>
        <div className="input inline-flex w-full">
          <input
            ref={inputRef}
            type="text"
            placeholder="Message"
            onInput={onInputChange}
            className="transition input input-ghost focus:fg-content placeholder:text-gray-600 focus:placeholder:text-gray-500 focus:outline-none grow pl-0 disabled:bg-transparent disabled:border-0"
            autoComplete="off"
            disabled={disabled.value}
          />
          <input
            type="file"
            ref={filesRef}
            multiple
            className="hidden"
            onChange={onFileChange}
            disabled={disabled.value}
          />
          <button type="button" onClick={onAttach}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-5 h-5 transition hover:text-gray-400 text-gray-500"
            >
              <path
                fill-rule="evenodd"
                d="M15.621 4.379a3 3 0 00-4.242 0l-7 7a3 3 0 004.241 4.243h.001l.497-.5a.75.75 0 011.064 1.057l-.498.501-.002.002a4.5 4.5 0 01-6.364-6.364l7-7a4.5 4.5 0 016.368 6.36l-3.455 3.553A2.625 2.625 0 119.52 9.52l3.45-3.451a.75.75 0 111.061 1.06l-3.45 3.451a1.125 1.125 0 001.587 1.595l3.454-3.553a3 3 0 000-4.242z"
                clip-rule="evenodd"
              />
            </svg>
          </button>

          <button type="submit" disabled={disabled.value}>
            <svg
              className="w-5 h-5 transition hover:text-gray-400 text-gray-500 origin-center transform rotate-90 ml-3"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}

function AttachedFiles({
  files,
  onRemoveAttachments,
}: {
  files?: File[];
  onRemoveAttachments: () => void;
}) {
  console.log("files?", files);
  return files?.length ? (
    <div className="flex gap-2 justify-end items-center mb-2">
      {files.map((file) => (
        <File key={file.name} file={file} />
      ))}
      <button onClick={onRemoveAttachments}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="w-5 h-5 transition hover:text-gray-400 text-gray-500"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
            clipRule="evenodd"
          />
        </svg>
      </button>
    </div>
  ) : null;
}

function File({ file }: { file: File }) {
  const ref = useRef<HTMLImageElement>(null);
  return file.type.startsWith("image") ? (
    <img
      ref={ref}
      src={URL.createObjectURL(file)}
      onLoad={() => {
        if (ref.current) {
          URL.revokeObjectURL(ref.current.src);
        }
      }}
      className="w-20 h-20 object-cover"
    />
  ) : (
    <div className="flex items-center">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        class="w-5 h-5"
      >
        <path d="M3 3.5A1.5 1.5 0 014.5 2h6.879a1.5 1.5 0 011.06.44l4.122 4.12A1.5 1.5 0 0117 7.622V16.5a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 013 16.5v-13z" />
      </svg>

      <span>{file.name}</span>
    </div>
  );
}
