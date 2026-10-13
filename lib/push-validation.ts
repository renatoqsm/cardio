// Only known browser push providers may receive requests from our server.
export function validPushEndpoint(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && !url.hash &&
      ['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com'].includes(url.hostname) && url.pathname.length > 1
  } catch { return false }
}
export async function validPushKeys(p256dh: unknown, auth: unknown) {
  if (typeof p256dh !== 'string' || typeof auth !== 'string' || p256dh.length !== 87 || auth.length !== 22 || !/^[A-Za-z0-9_-]+$/.test(p256dh) || !/^[A-Za-z0-9_-]+$/.test(auth)) return false
  const point = Buffer.from(p256dh, 'base64url'), secret = Buffer.from(auth, 'base64url')
  if (point.length !== 65 || point[0] !== 4 || secret.length !== 16) return false
  try { await crypto.subtle.importKey('raw', point, { name: 'ECDH', namedCurve: 'P-256' }, false, []); return true } catch { return false }
}
