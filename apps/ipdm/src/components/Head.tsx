import type { ComponentChildren } from "preact";
// @ts-ignore
import { createPortal } from "preact/compat";

const Head = ({ children }: { children: ComponentChildren }) => {
  const head = document.head;
  return createPortal(<>{children}</>, head);
};

export { Head };
