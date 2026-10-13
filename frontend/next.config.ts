import type { NextConfig } from 'next';

// A single browser origin proxies the Express itinerary API.
const config: NextConfig = {
  distDir: process.env.ATLAS_NEXT_DIST_DIR || '.next',
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.ATLAS_API_URL || 'http://127.0.0.1:8000'}/api/:path*`,
      },
    ];
  },
};
export default config;
