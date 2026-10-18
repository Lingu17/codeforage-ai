const DEFAULT_API_URL = "http://127.0.0.1:8000";

export function getApiUrl(path: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL;
  const sanitizedBase = baseUrl.replace(/\/+$/, "");
  const sanitizedPath = path.replace(/^\/+/, "");
  return `${sanitizedBase}/${sanitizedPath}`;
}

// True when a hosted page would call a loopback backend, which can never work.
export function isApiMisconfigured(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  const pageIsLocal = host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  const api = (process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL).toLowerCase();
  const apiIsLocal = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(api);
  const mixedContent = window.location.protocol === "https:" && api.startsWith("http:");
  return !pageIsLocal && (apiIsLocal || mixedContent);
}

export class ApiUnreachableError extends Error {}

export function apiUnreachableMessage(): string {
  return isApiMisconfigured()
    ? "Scanning is unavailable: the CodeForge server address isn't configured for this site yet."
    : "The CodeForge server isn't responding. It may be starting up, so try again in a moment.";
}

export type ApiStatus = "checking" | "online" | "offline";

let warmUp: Promise<ApiStatus> | null = null;

// Pings the backend once per page load. Free-tier hosts sleep when idle and
// take up to a minute to wake, so starting early hides most of that delay
// from the first real request. Reuses the in-flight ping on repeat calls.
export function warmUpApi(force = false): Promise<ApiStatus> {
  if (warmUp && !force) return warmUp;
  warmUp = (async () => {
    if (isApiMisconfigured()) {
      console.error("NEXT_PUBLIC_API_URL must be the backend's public https URL on a hosted site.");
      return "offline";
    }
    try {
      const response = await apiFetch(getApiUrl("/health"), {}, { retries: 1, timeoutMs: 75000 });
      return response.ok ? "online" : "offline";
    } catch {
      // Distinguish a down server from a CORS rejection for the developer.
      const reachable = await fetch(getApiUrl("/health"), { mode: "no-cors" }).then(() => true, () => false);
      console.error(reachable
        ? `The backend is up but rejects ${window.location.origin}. Add it to the backend's ALLOWED_ORIGINS.`
        : "The backend did not respond. Check that it is deployed and NEXT_PUBLIC_API_URL points to it.");
      return "offline";
    }
  })();
  return warmUp;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// fetch with a timeout and retries for network failures. Hosted free-tier
// backends sleep when idle, so the first request after a pause can fail or
// stall while the server wakes up. HTTP error responses are returned as-is.
export async function apiFetch(input: string, init: RequestInit = {}, options: { retries?: number; timeoutMs?: number } = {}): Promise<Response> {
  if (isApiMisconfigured()) throw new ApiUnreachableError(apiUnreachableMessage());
  const method = (init.method || "GET").toUpperCase();
  const retries = options.retries ?? (method === "GET" ? 3 : 1);
  // Long enough for a sleeping free-tier server to finish waking up.
  const timeoutMs = options.timeoutMs ?? 75000;
  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    init.signal?.addEventListener("abort", () => controller.abort(), { once: true });
    try {
      const response = await fetch(input, { ...init, signal: controller.signal });
      if ((response.status === 502 || response.status === 503 || response.status === 504) && attempt < retries) {
        await sleep(1500 * 2 ** attempt);
        continue;
      }
      return response;
    } catch (error) {
      if (init.signal?.aborted) throw error;
      if (attempt >= retries) throw new ApiUnreachableError(apiUnreachableMessage());
      await sleep(1500 * 2 ** attempt);
    } finally {
      clearTimeout(timer);
    }
  }
}
