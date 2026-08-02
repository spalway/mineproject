import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // `ws` holds a long-lived handle and must not be bundled. `node:sqlite` is
  // a builtin, so it needs no entry here.
  serverExternalPackages: ['ws'],
}

export default nextConfig
