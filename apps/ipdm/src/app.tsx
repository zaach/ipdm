import { Layout } from "./components/Layout";
import { AboutDialog } from "./components/AboutDialog";
import Chat from "./components/Chat";

export function App() {
  return (
    <Layout>
      <Chat />
      <AboutDialog />
    </Layout>
  );
}
