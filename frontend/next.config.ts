import type { NextConfig } from 'next';

// A single browser origin proxies the minimal Express preview API.
const config: NextConfig = {
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
