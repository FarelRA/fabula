import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker/self-host: `docker/Dockerfile` runs the standalone server.
  output: "standalone",
  reactStrictMode: true,
  // Lint runs as its own CI step (`bun run lint`), not inside `next build`.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
