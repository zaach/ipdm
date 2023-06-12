import { useEffect, useRef, useContext } from "preact/hooks";
import { computed, useSignal, effect } from "@preact/signals";
import {
  AppState,
  AppStateData,
  ConnectionStatus,
  createAppState,
  setupMessageListeners,
} from "../lib/state";
import { getInvite } from "../lib/locationParams";

import { Message, DisplayMessage } from "../lib/types";
import { ShareLink } from "../components/ShareLink";
import { UpdateUsernameDialog } from "../components/UpdateUsernameDialog";
import { Header } from "../components/Header";
import { MessageBox } from "../components/Messages";
import { Spinner } from "../components/Spinner";
import { SendField } from "../components/SendField";

export default function StateWrapper() {
  const appState = useSignal<AppStateData>(undefined!);
  useEffect(() => {
    const fn = async () => {
      const state = await createAppState();
      appState.value = state;
    };
    fn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const isLoaded = computed(() => typeof appState.value !== "undefined");
  console.log("render?", isLoaded.value, appState.value);
  return isLoaded.value ? (
    <ChatWrapper appState={appState.value!} />
  ) : (
    <div class="flex flex-col h-screen justify-center items-center">
      <Spinner />
    </div>
  );
}

export function ChatWrapper({ appState }: { appState: AppStateData }) {
  return (
    <AppState.Provider value={appState}>
      <Chat />
    </AppState.Provider>
  );
}

export function Chat() {
  const { username, chatContext, connectionStatus } = useContext(AppState);
  const setUser = (name: string) => {
    username.value = name;
  };

  effect(() => {
    const invite = getInvite(location.hash);
    if (invite) {
      chatContext.joinWithInvite(invite);
    } else {
      connectionStatus.value = ConnectionStatus.connecting;
      chatContext.createInviteAndWait();
    }
  });

  return (
    <div
      className="flex flex-col h-full dark:bg-base-300 overflow-hidden"
      tabIndex={99}
    >
      <Header chatContext={chatContext} />
      <ChatHistory />
      <SendField />
      <UpdateUsernameDialog user={username.value} setUser={setUser} />
    </div>
  );
}

function ChatHistory() {
  const { chatReady, chatContext, partnerUsername } = useContext(AppState);
  const messages = useSignal<Message[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setupMessageListeners(chatContext, messages, partnerUsername);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView(false);
  }, [messages.value.length]);

  const displayMessages = computed(
    () => messages.value.filter((m) => !!(m.msg || m.files)) as DisplayMessage[]
  );

  return (
    <div className="grow relative w-full p-4 overflow-y-auto">
      {chatReady.value ? (
        <ul>
          {displayMessages.value.map((m) => (
            <MessageBox key={m.uid} {...m} />
          ))}
          <div ref={bottomRef} />
        </ul>
      ) : (
        <div className="grow w-full h-full flex place-content-center">
          <ShareLink />
        </div>
      )}
    </div>
  );
}
