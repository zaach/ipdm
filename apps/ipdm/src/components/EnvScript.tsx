export function EnvScript({ keys }: { keys?: string[] }) {
  const IS_BROWSER = typeof window !== "undefined";
  if (IS_BROWSER || !keys) return null;
  const vars: Record<string, string | undefined> = {};
  for (const k of keys) {
    vars[k] = process.env[k];
  }
  return (
    <script
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{
        __html: `ENV = ${JSON.stringify(vars)}`,
      }}
    />
  );
}
