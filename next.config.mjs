/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingExcludes: {
    '/*': ['./.local/**/*', './.data/**/*', './.env*'],
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
