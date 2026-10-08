import { timingSafeEqual } from 'node:crypto'
export function validWebhookToken(received: string | null, expected: string | undefined) {
  if (!expected || expected.length < 32 || !received || received.length > 255) return false
  const left = Buffer.from(received), right = Buffer.from(expected)
  return left.length === right.length && timingSafeEqual(left,right)
}
