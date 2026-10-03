import { getGatewayBaseUrl } from "@/lib/gateway";

/** Ask the directory to store this person's login name. Chat send only reads it. */
class DirectoryNameError extends Error {
  constructor(public status: number) {
    super("Could not store directory name");
  }
}

export async function rememberDirectoryName(token: string, signal?: AbortSignal): Promise<void> {
  const base = getGatewayBaseUrl().replace(/\/+$/, "");
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(abort, 10_000);
  try {
    const response = await fetch(`${base}/api/users/me/directory`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    if (!response.ok) throw new DirectoryNameError(response.status);
    const result: unknown = await response.json();
    if (!result || typeof result !== "object" || !("ok" in result) || result.ok !== true) {
      throw new DirectoryNameError(response.status);
    }
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}

function retryDelay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      reject(new Error("Directory name request cancelled"));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, ms);
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
  });
}

/** Best-effort background write, at most three attempts per login identity. */
export async function rememberDirectoryNameWithRetry(
  getToken: () => Promise<string | null>,
  signal: AbortSignal,
): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    if (signal.aborted) throw new Error("Directory name request cancelled");
    try {
      const token = await getToken();
      if (signal.aborted) throw new Error("Directory name request cancelled");
      if (!token) throw new Error("No directory access token");
      await rememberDirectoryName(token, signal);
      return;
    } catch (error) {
      if (signal.aborted || attempt === 2 ||
        (error instanceof DirectoryNameError && (error.status === 401 || error.status === 403))) {
        throw error;
      }
      await retryDelay(1_000 * (attempt + 1), signal);
    }
  }
}
