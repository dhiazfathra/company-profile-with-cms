import type { NextConfig } from 'next'
import { withPayload } from '@payloadcms/next/withPayload'

const nextConfig: NextConfig = {
  // Phase 2: the admin panel and its API routes are server-rendered, so the
  // site can no longer be a static export (Phase 1's `output: 'export'`).
  // Lets a second, throwaway `next dev` build into its own directory instead
  // of lock-contending with the main dev server's .next/.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
}

export default withPayload(nextConfig)
