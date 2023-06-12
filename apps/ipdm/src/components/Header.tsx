import { computed } from "@preact/signals";
import { useCallback, useContext } from "preact/hooks";
import { ChatContext } from "@ipdm/client";
import { ConnectionStatus, ChatStatus, AppState } from "../lib/state";
import { Spinner } from "./Spinner";

export function Header({ chatContext }: { chatContext: ChatContext }) {
  const { partnerUsername, username, connectionStatus, chatReady, chatStatus } =
    useContext(AppState);

  const badgeState = computed(() => {
    switch (connectionStatus.value) {
      case ConnectionStatus.connecting:
        return "badge-warning";
      case ConnectionStatus.connected:
        return "badge-success";
      case ConnectionStatus.disconnected:
      default:
        return "badge-error";
    }
  });

  const disabled = computed(() => {
    return chatStatus.value === ChatStatus.disconnected;
  });

  const onDisconnect = useCallback(() => {
    if (!disabled.value) {
      chatContext.disconnect();
    }
    const elem = document.activeElement;
    if (elem instanceof HTMLElement) {
      elem?.blur();
    }
  }, [disabled.value, chatContext]);

  return (
    <div className="sticky top-0 grid grid-cols-3 gap-3 w-full z-10 bg-base-200 p-3">
      <div className="basis-1/3">
        <label className="btn btn-sm btn-circle" htmlFor="about-modal">
          ?
        </label>
      </div>
      {chatReady.value ? (
        partnerUsername.value ? (
          <div className="dropdown justify-self-center max-w-full flex-nowrap">
            <label
              tabIndex={0}
              className="btn btn-sm normal-case max-w-full flex-nowrap inline-flex"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
                width="16"
                height="16"
                className="mr-1"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                />
              </svg>

              <span className="truncate">{partnerUsername}</span>
            </label>
            <ul
              tabIndex={0}
              className="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-52"
            >
              <li>
                <a
                  onClick={onDisconnect}
                  disabled={disabled.value}
                  className="disabled:opacity-50"
                >
                  Disconnect
                </a>
              </li>
            </ul>
          </div>
        ) : (
          <Spinner asBtn={true} />
        )
      ) : (
        <div />
      )}
      <div className="indicator justify-self-end max-w-full">
        <span
          className={`indicator-item indicator-end badge badge-xs ${badgeState.value}`}
        />
        <label
          className="inline-flex items-center btn btn-sm normal-case max-w-full truncate flex-nowrap"
          htmlFor="username-modal"
        >
          <span className="truncate mr-1">{username}</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            className="w-5 h-5"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M4.5 12a7.5 7.5 0 0015 0m-15 0a7.5 7.5 0 1115 0m-15 0H3m16.5 0H21m-1.5 0H12m-8.457 3.077l1.41-.513m14.095-5.13l1.41-.513M5.106 17.785l1.15-.964m11.49-9.642l1.149-.964M7.501 19.795l.75-1.3m7.5-12.99l.75-1.3m-6.063 16.658l.26-1.477m2.605-14.772l.26-1.477m0 17.726l-.26-1.477M10.698 4.614l-.26-1.477M16.5 19.794l-.75-1.299M7.5 4.205L12 12m6.894 5.785l-1.149-.964M6.256 7.178l-1.15-.964m15.352 8.864l-1.41-.513M4.954 9.435l-1.41-.514M12.002 12l-3.75 6.495"
            />
          </svg>
        </label>
      </div>
    </div>
  );
}
