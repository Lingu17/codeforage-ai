type GitHubUser = {
  user_metadata?: Record<string, unknown>;
  identities?: { provider: string; identity_data?: Record<string, unknown> }[];
  app_metadata?: { provider?: string };
};

export function githubUsername(user?: GitHubUser): string | null {
  const identity = user?.identities?.find(item => item.provider === "github");
  const metadata = identity || user?.app_metadata?.provider === "github" ? user?.user_metadata : undefined;
  const name = identity?.identity_data?.user_name ?? identity?.identity_data?.preferred_username
    ?? metadata?.user_name ?? metadata?.preferred_username;
  return typeof name === "string" && /^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/.test(name) ? name : null;
}

export function shouldReconnectGitHub(signedIn: boolean, reconnect: string | null): boolean {
  return !signedIn || reconnect === "1";
}

export function githubOAuthScopes(reconnect: string | null): string | undefined {
  return reconnect === "1" ? "repo" : undefined;
}

export class GitHubImportError extends Error {
  reconnect: boolean;
  constructor(message: string, reconnect = false) {
    super(message);
    this.reconnect = reconnect;
  }
}

export async function githubResponseError(response: Response, backend = false): Promise<GitHubImportError> {
  // Never display arbitrary upstream bodies or exception text.
  let githubAuth = !backend;
  if (backend && response.status === 401) {
    const body = await response.json().catch(() => null);
    githubAuth = typeof body?.detail === "string" && body.detail.startsWith("GitHub authorization");
  }
  if (response.status === 401) return new GitHubImportError(githubAuth
    ? "GitHub authorization expired or was revoked. Reconnect GitHub."
    : "Your CodeForge session expired. Sign in again.", githubAuth);
  let rateLimited = response.status === 429;
  if (response.status === 403) {
    const body = await response.json().catch(() => null);
    rateLimited = response.headers.get("x-ratelimit-remaining") === "0" || Boolean(response.headers.get("retry-after"))
      || (typeof body?.message === "string" && body.message.toLowerCase().includes("rate limit"));
    if (!rateLimited) return new GitHubImportError("GitHub denied access. Check the OAuth repo permission and organization SSO approval.", true);
  }
  if (rateLimited) {
    const wait = response.headers.get("retry-after");
    return new GitHubImportError(wait && /^\d{1,5}$/.test(wait)
      ? `GitHub rate limit reached. Retry after ${wait} seconds.`
      : "GitHub rate limit reached. Wait before retrying.");
  }
  if (response.status === 400) return new GitHubImportError("GitHub username is unavailable. Reconnect GitHub, or import a public repository by URL.", true);
  if (response.status === 422) return new GitHubImportError("The repository request was rejected. Check the repository URL or account details.");
  if (response.status === 404) return new GitHubImportError("GitHub repository or username was not found. Check the URL; private repositories require GitHub authorization.", true);
  return new GitHubImportError("GitHub is temporarily unavailable. Try again later.");
}

export async function loadGithubRepositories(apiUrl: string, session: { access_token: string; provider_token?: string | null; user?: GitHubUser } | null, request: typeof fetch = fetch) {
  if (!session?.access_token) throw new GitHubImportError("Your CodeForge session expired. Sign in again.");
  const name = githubUsername(session.user);
  const headers: Record<string, string> = { Authorization: `Bearer ${session.access_token}` };
  if (session.provider_token) headers["X-GitHub-Token"] = session.provider_token;
  if (!name && !session.provider_token) throw new GitHubImportError("GitHub username is unavailable. Reconnect GitHub, or import a public repository by URL.", true);
  const url = name ? `${apiUrl}?username=${encodeURIComponent(name)}` : apiUrl;
  const response = await request(url, { headers });
  if (!response.ok) throw await githubResponseError(response, true);
  const repositories = await response.json().catch(() => null);
  if (!Array.isArray(repositories) || repositories.some(repo => !repo
    || !Number.isSafeInteger(repo.id) || repo.id <= 0
    || typeof repo.name !== "string" || !repo.name
    || typeof repo.full_name !== "string" || !repo.full_name
    || typeof repo.private !== "boolean")) {
    throw new GitHubImportError("GitHub returned an invalid repository list. Try again later.");
  }
  return repositories;
}

export async function publicOrAuthorizedRepository(input: string, providerToken?: string | null, request: typeof fetch = fetch) {
  const url = new URL(input);
  const match = url.pathname.match(/^\/([A-Za-z0-9-]+)\/([A-Za-z0-9_.-]+)\/?$/);
  if (url.protocol !== "https:" || url.hostname !== "github.com" || url.port || url.username || url.password || !match || url.search || url.hash) {
    throw new GitHubImportError("Enter a GitHub repository URL such as https://github.com/owner/repo.");
  }
  const api = `https://api.github.com/repos/${match[1]}/${match[2].replace(/\.git$/, "")}`;
  const headers = { Accept: "application/vnd.github+json" };
  let response = await request(api, { headers });
  if (response.status === 404 && providerToken) {
    response = await request(api, { headers: { ...headers, Authorization: `Bearer ${providerToken}` } });
  }
  if (!response.ok) throw await githubResponseError(response);
  return response.json();
}
