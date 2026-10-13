import { timingSafeEqual } from 'node:crypto'
import { drainNotifications } from '@/lib/push-dispatch'

export async function POST(request: Request) {
  const actual = request.headers.get('x-pulso-job-key'), expected = process.env.PUSH_JOB_SECRET
  if (!actual || !expected || Buffer.byteLength(actual) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(actual), Buffer.from(expected))) return Response.json({ error: 'Não autorizado' }, { status: 401 })
  return drainNotifications()
}
