import { PreactDOMAttributes } from "preact";

export function Link({
  href,
  children,
}: { href: string } & PreactDOMAttributes) {
  return (
    <a href={href} className="font-semibold inline-flex items-center gap-1">
      {children}
    </a>
  );
}
