/** An http(s) address the desktop browser can open. Anything else stays closed. */
export function browserAddress(raw: string): string | null {
  const url = raw.trim();
  if (url.length < 8 || url.length > 200) return null;
  if (/[\s'"\\]/.test(url)) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  if (!parsed.hostname) return null;
  return url;
}
