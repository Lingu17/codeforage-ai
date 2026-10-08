import { createClient } from "@/utils/supabase/client";
import { getApiUrl } from "@/utils/api";

export async function openRepositorySource(repoId: string, filePath: string, line?: number) {
  const { data } = await createClient().auth.getSession();
  if (!data.session) throw new Error("Sign in to open source files.");
  const params = new URLSearchParams({ file_path: filePath });
  if (line != null) params.set("line", String(line));
  const response = await fetch(getApiUrl(`/api/repos/${repoId}/source?${params}`), {
    headers: { Authorization: `Bearer ${data.session.access_token}` },
  });
  if (!response.ok) throw new Error("Source unavailable. Rescan the repository.");
  const { url } = await response.json();
  window.open(url, "_blank", "noopener,noreferrer");
}
