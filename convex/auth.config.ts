/**
 * Convex Auth custom-JWT verification.
 *
 * The auth implementation issues RS256 tokens from the deployment's site URL
 * (`CONVEX_SITE_URL`, automatically present on self-hosted and Cloud
 * deployments). Without this config Convex cannot resolve `ctx.auth`
 * identities and every authed mutation fails with "Not authenticated".
 */
const authConfig = {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL,
      applicationID: "convex",
    },
  ],
};

export default authConfig;
