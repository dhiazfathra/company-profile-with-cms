import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `output: 'export'` forces every route to static-only rendering, even
  // under `next dev` — which breaks /e2e-seam's dynamic `searchParams` read
  // when E2E=1 bypasses its notFound() guard. Scope it to `next build` only;
  // `next dev` (used by the e2e suite) needs normal dynamic rendering.
  ...(process.env.NODE_ENV === "production"
    ? { output: "export" as const, images: { unoptimized: true } }
    : {}),
  // Lets a second, throwaway `next dev` (e2e/content-seam.spec.ts's E2E-gate
  // test) build into its own directory instead of lock-contending with the
  // main dev server's .next/.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
};

export default nextConfig;
