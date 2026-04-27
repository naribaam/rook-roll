import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Lovable's platform expects build output in `dist/`. Next.js' static
  // export mode produces a self-contained, host-anywhere bundle that we
  // direct to ./dist.
  trailingSlash: false,
  images: { unoptimized: true },
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
};

export default nextConfig;
