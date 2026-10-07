import { defineCloudflareConfig } from '@opennextjs/cloudflare'

// This app has no ISR or optimized images; no paid R2 cache is required.
export default defineCloudflareConfig()
