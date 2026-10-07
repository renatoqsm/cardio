/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingIncludes: {
    '/api/*': ['./node_modules/.pnpm/pg-cloudflare@*/node_modules/pg-cloudflare/dist/**/*'],
  },
  outputFileTracingExcludes: {
    '/*': ['./.local/**/*', './.data/**/*', './.env*'],
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
