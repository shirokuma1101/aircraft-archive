import type { NextConfig } from 'next';
const config: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  async headers() {
    return [{source: '/:path*', headers: [
      {key: 'X-Content-Type-Options', value: 'nosniff'},
      {key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin'},
      {key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()'},
    ]}, {source:'/:path((?!embed/).*)',headers:[{key:'X-Frame-Options',value:'DENY'}]},
    {source:'/embed/:path*',headers:[{key:'Content-Security-Policy',value:"frame-ancestors *"},{key:'X-Robots-Tag',value:'noindex, nofollow'}]}];
  },
};
export default config;
