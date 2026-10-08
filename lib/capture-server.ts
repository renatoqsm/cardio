import { currentGesture, type DailyGesture } from './gestures'
type Claims = { owner: string; pathname: string; captureDay: string; gestureId: string }
async function signingKey() {
  const secret = process.env.BETTER_AUTH_SECRET
  if (!secret) throw new Error('Capture signing secret is missing')
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}
export async function signCapture(owner: string, pathname: string, day: DailyGesture = currentGesture()) {
  const payload = Buffer.from(JSON.stringify({ owner, pathname, captureDay: day.captureDay, gestureId: day.id } satisfies Claims)).toString('base64url')
  const signature = await crypto.subtle.sign('HMAC', await signingKey(), new TextEncoder().encode(payload))
  return `${payload}.${Buffer.from(signature).toString('base64url')}`
}
export async function verifyCapture(token: unknown, owner: string, pathname: string): Promise<Claims | null> {
  if (typeof token !== 'string' || token.length > 2000) return null
  const [payload, signature, extra] = token.split('.')
  if (!payload || !signature || extra) return null
  try {
    if (!await crypto.subtle.verify('HMAC', await signingKey(), Buffer.from(signature, 'base64url'), new TextEncoder().encode(payload))) return null
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString()) as Claims, day = currentGesture()
    return claims.owner === owner && claims.pathname === pathname && claims.captureDay === day.captureDay && claims.gestureId === day.id ? claims : null
  } catch { return null }
}
