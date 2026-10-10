// Used by Next configuration before public variables can be bundled.
export function validatePublicEnvironment(environment: Record<string, string | undefined>) {
  for (const [name, value] of Object.entries(environment)) {
    if (!name.startsWith("NEXT_PUBLIC_") || !value) continue;
    let privileged = value.startsWith("sb_secret_");
    try {
      const claims = JSON.parse(Buffer.from(value.split(".")[1] ?? "", "base64url").toString("utf8"));
      privileged ||= claims?.role === "service_role";
    } catch { /* A public publishable key is not a JWT. */ }
    if (privileged) throw new Error(`${name} must not contain a privileged Supabase key`);
  }
}
