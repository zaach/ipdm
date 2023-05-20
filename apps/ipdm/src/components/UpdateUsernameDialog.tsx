import { useState, useCallback, useContext } from "preact/hooks";
import { computed } from "@preact/signals";
import { AppState } from "../lib/state";

export function UpdateUsernameDialog(props: {
  user: string;
  setUser: (str: string) => void;
}) {
  const { username, chatReady } = useContext(AppState);
  const [local, setLocal] = useState(props.user);
  const ref = useCallback(
    (node: HTMLInputElement | null) => {
      if (node && !username.value) {
        node.checked = true;
      }
    },
    [username.value]
  );
  const title = computed(() =>
    chatReady.value ? "Update your username" : "Pick a username"
  );
  return (
    <>
      <input
        ref={ref}
        type="checkbox"
        id="username-modal"
        className="modal-toggle"
      />
      <div className="modal modal-middle">
        <div className="modal-box">
          <h3 className="font-bold text-lg">{title}</h3>
          <p className="py-4">
            <input
              title="Username"
              autoComplete="off"
              type="text"
              className="input placeholder:text-gray-600 focus:placeholder:text-gray-500 w-full input-bordered focus:outline-none focus:ring focus:border-gray-500"
              value={local}
              onInput={(e) => setLocal(e.currentTarget.value)}
            />
          </p>
          <div className="modal-action">
            <label
              htmlFor="username-modal"
              className="btn btn-secondary disabled:opacity-50"
              disabled={local.length === 0}
              onClick={(e) => {
                if (local) {
                  props.setUser(local);
                } else {
                  e.preventDefault();
                  e.stopPropagation();
                }
              }}
            >
              Done
            </label>
          </div>
        </div>
      </div>
    </>
  );
}
