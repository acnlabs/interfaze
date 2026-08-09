/** CN BFF (WeChat OAuth + plan checkout). Global builds leave this unset. */
export function getBffBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_BFF_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  return "https://mp.acnlabs.cn";
}
