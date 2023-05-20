import { Head } from "./Head";
import { ComponentChildren } from "preact";

const Layout = ({ children }: { children: ComponentChildren }) => {
  return (
    <>
      <Head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" type="image/png" href="/favicon.png" />
        {/* Tailwind Stylesheet */}
        {/* <link rel="stylesheet" href="/styles.css" /> */}
      </Head>
      <main className="h-full">{children}</main>
    </>
  );
};

export { Layout };
