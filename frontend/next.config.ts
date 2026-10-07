import type { NextConfig } from 'next';

// The browser uses one origin. Next forwards API requests (and session cookies)
// to Django, avoiding cross-origin storage and authentication surprises.
const config: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.DJANGO_API_URL || 'http://127.0.0.1:8000'}/api/:path*`,
      },
    ];
  },
};
export default config;
