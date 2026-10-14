import { authenticationAddresses } from './site-address'
import { betterAuth } from 'better-auth'
import { getDatabase } from '@/lib/db'

export const getAuth = () => betterAuth({
  database: getDatabase().pool,
  emailAndPassword: { enabled: true },
  ...authenticationAddresses(),
})
