/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingIncludes: {
    '/api/*': ['./node_modules/.pnpm/pg-cloudflare@*/node_modules/pg-cloudflare/dist/**/*'],
  },
  outputFileTracingExcludes: {
    '/*': ['./.local/**/*', './.data/**/*', './.env*'],
  },
  async headers() {
    return [{ source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }, { key: 'Service-Worker-Allowed', value: '/' }] }]
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
