import { betterAuth } from 'better-auth'
import { getDatabase } from '@/lib/db'

export const getAuth = () => betterAuth({
  database: getDatabase().pool,
  emailAndPassword: { enabled: true },
  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins: process.env.BETTER_AUTH_URL ? [process.env.BETTER_AUTH_URL] : [],
})
