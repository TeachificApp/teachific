export type Course360ChatConfiguration = { backend: "openai" | "forge"; key: string; url: string };

export function course360ChatUrl(raw: string): string {
  const root = raw.trim().replace(/\/+$/, "");
  if (/\/v1\/chat\/completions$/.test(root)) return root;
  return `${root}${root.endsWith("/v1") ? "" : "/v1"}/chat/completions`;
}

/** Complete same-family server pairs only; frontend aliases cannot become server credentials. */
export function resolveCourse360ChatConfiguration(env: Record<string, string | undefined> = process.env): Course360ChatConfiguration | undefined {
  // Retain this application's existing explicit OpenAI precedence.
  if (env.OPENAI_API_KEY?.trim()) return { backend: "openai", key: env.OPENAI_API_KEY.trim(), url: course360ChatUrl(env.OPENAI_BASE_URL?.trim() || env.OPENAI_API_BASE?.trim() || "https://api.openai.com") };
  for (const [keyName, urlName] of [["BUILT_IN_FORGE_API_KEY", "BUILT_IN_FORGE_API_URL"], ["FORGE_API_KEY", "FORGE_API_URL"]]) {
    const key = env[keyName]?.trim(), url = env[urlName]?.trim();
    if (key && url) return { backend: "forge", key, url: course360ChatUrl(url) };
  }
  // Existing built-in Forge key-only configuration retains the existing default endpoint.
  if (env.BUILT_IN_FORGE_API_KEY?.trim() && !env.BUILT_IN_FORGE_API_URL?.trim() && !env.FORGE_API_URL?.trim()) return { backend: "forge", key: env.BUILT_IN_FORGE_API_KEY.trim(), url: "https://forge.manus.im/v1/chat/completions" };
  return undefined;
}
