export function getModuleUrl(module: string, repoId: string | null): string {
  if (!repoId) return "/dashboard";
  
  switch (module) {
    case "architecture":
      return `/dashboard/architecture?repo_id=${repoId}`;
    case "chat":
      return `/dashboard/chat?repo_id=${repoId}`;
    case "pr-reviews":
      return `/dashboard/pr-reviews?repo_id=${repoId}`;
    case "security":
      return `/dashboard/security?repo_id=${repoId}`;
    case "health":
      return `/dashboard/health?repo_id=${repoId}`;
    case "dashboard":
    default:
      return `/dashboard?repo_id=${repoId}`;
  }
}

export function navigateToModule(router: any, module: string, repoId: string | null): void {
  const url = getModuleUrl(module, repoId);
  router.push(url);
}
