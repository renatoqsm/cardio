import { headers } from 'next/headers'
import { getAuth } from '@/lib/auth'
import { getDatabase, withDatabase } from '@/lib/db'
import { validPushEndpoint, validPushKeys } from '@/lib/push-validation'

export const GET = withDatabase(async () => {
  const me = (await getAuth().api.getSession({ headers: await headers() }))?.user
  if (!me) return Response.json({ error: 'Não autenticado' }, { status: 401 })
  const preferences = (await getDatabase().pool.query('SELECT cardio,strength FROM notification_preference WHERE "userId"=$1', [me.id])).rows[0] ?? { cardio: true, strength: true }
  return Response.json({ preferences, publicKey: process.env.VAPID_PUBLIC_KEY ?? null, configured: !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) }, { headers: { 'Cache-Control': 'private, no-store' } })
})
export const POST = withDatabase(async (request: Request) => {
  const me = (await getAuth().api.getSession({ headers: await headers() }))?.user
  if (!me) return Response.json({ error: 'Não autenticado' }, { status: 401 })
  if (request.headers.get('origin') !== new URL(request.url).origin) return Response.json({ error: 'Origem inválida.' }, { status: 403 })
  let body
  try { body = await request.json() } catch { return Response.json({ error: 'Dados inválidos.' }, { status: 400 }) }
  const { pool } = getDatabase()
  if (body?.action === 'preferences') {
    if (typeof body.cardio !== 'boolean' || typeof body.strength !== 'boolean') return Response.json({ error: 'Escolha as modalidades dos avisos.' }, { status: 400 })
    await pool.query('INSERT INTO notification_preference VALUES ($1,$2,$3) ON CONFLICT ("userId") DO UPDATE SET cardio=excluded.cardio,strength=excluded.strength', [me.id, body.cardio, body.strength])
  } else if (body?.action === 'subscribe') {
    if (!process.env.VAPID_PRIVATE_KEY || !process.env.VAPID_PUBLIC_KEY) return Response.json({ error: 'As notificações estão sendo configuradas. Tente novamente mais tarde.' }, { status: 503 })
    const sub = body.subscription
    if (!validPushEndpoint(sub?.endpoint) || !await validPushKeys(sub?.keys?.p256dh, sub?.keys?.auth)) return Response.json({ error: 'Inscrição de notificações inválida.' }, { status: 400 })
    // A browser endpoint belongs to one current account; switching accounts drops its old jobs.
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const old = (await client.query('SELECT id,"userId" FROM push_subscription WHERE endpoint=$1 FOR UPDATE', [sub.endpoint])).rows[0]
      if (old && old.userId !== me.id) await client.query('DELETE FROM notification_outbox WHERE "subscriptionId"=$1', [old.id])
      await client.query('INSERT INTO push_subscription (id,"userId",endpoint,p256dh,auth) VALUES ($1,$2,$3,$4,$5) ON CONFLICT(endpoint) DO UPDATE SET "userId"=excluded."userId",p256dh=excluded.p256dh,auth=excluded.auth,enabled=true', [crypto.randomUUID(), me.id, sub.endpoint, sub.keys.p256dh, sub.keys.auth])
      await client.query('COMMIT')
    } catch (e) { await client.query('ROLLBACK'); throw e } finally { client.release() }
  } else if (body?.action === 'unsubscribe') {
    if (!validPushEndpoint(body.endpoint)) return Response.json({ error: 'Dispositivo inválido.' }, { status: 400 })
    await pool.query('DELETE FROM push_subscription WHERE endpoint=$1 AND "userId"=$2', [body.endpoint, me.id])
  } else return Response.json({ error: 'Ação inválida.' }, { status: 400 })
  return Response.json({ ok: true }, { headers: { 'Cache-Control': 'private, no-store' } })
})
