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
    ? "The CodeForge server address isn't configured for this site yet. Please try again later."
    : "The CodeForge server isn't responding. It may be starting up, so try again in a moment.";
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// fetch with a timeout and retries for network failures. Hosted free-tier
// backends sleep when idle, so the first request after a pause can fail or
// stall while the server wakes up. HTTP error responses are returned as-is.
export async function apiFetch(input: string, init: RequestInit = {}, options: { retries?: number; timeoutMs?: number } = {}): Promise<Response> {
  if (isApiMisconfigured()) throw new ApiUnreachableError(apiUnreachableMessage());
  const method = (init.method || "GET").toUpperCase();
  const retries = options.retries ?? (method === "GET" ? 3 : 1);
  const timeoutMs = options.timeoutMs ?? 30000;
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
