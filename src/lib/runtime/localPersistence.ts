export const localPersistenceUnavailableMessage =
  "Local SQLite storage is only available in local Node.js development. Use source=remote in Cloudflare production.";

export function isCloudflareDeployTarget() {
  return process.env.NEXT_PUBLIC_DEPLOY_TARGET === "cloudflare";
}

export function isLocalPersistenceDisabled() {
  return (
    process.env.DISABLE_LOCAL_SQLITE === "true" ||
    isCloudflareDeployTarget()
  );
}
