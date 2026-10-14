export const legacySiteOrigin = 'https://cardio.renatoqsousam.workers.dev'
export const customSiteOrigins = ['https://www.desafiopulso.online', 'https://desafiopulso.online']

export function authenticationAddresses(baseURL = process.env.BETTER_AUTH_URL) {
  const fallback = baseURL || legacySiteOrigin
  const origins = [...new Set([new URL(fallback).origin, legacySiteOrigin, ...customSiteOrigins])]
  return {
    baseURL: { allowedHosts: origins.map(origin => new URL(origin).host), fallback, protocol: new URL(fallback).protocol === 'https:' ? 'https' as const : 'auto' as const },
    trustedOrigins: origins,
  }
}
// Keep sharing/search links on the live address until DNS and HTTPS are activated.
export function publicSiteOrigin() { return process.env.SITE_URL || legacySiteOrigin }
