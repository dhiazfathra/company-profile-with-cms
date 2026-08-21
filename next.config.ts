import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets a second, throwaway `next dev` (e2e/content-seam.spec.ts's E2E-gate
  // test) build into its own directory instead of lock-contending with the
  // main dev server's .next/.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
};

export default nextConfig;
