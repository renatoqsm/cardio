import { buildPushPayload } from '@block65/webcrypto-web-push'
import { getDatabase, withDatabase } from './db'
import { validPushEndpoint } from './push-validation'
import { billingEnabled } from './billing/store'

type Delivery = { recordId: string; subscriptionId: string; challengeId: string; attempts: number }

// Runs in its own database context, since the publishing request may already be closed.
export const drainNotifications = withDatabase(async () => {
  if (process.env.PUSH_DELIVERY_ENABLED === 'false' || !process.env.VAPID_PRIVATE_KEY || !process.env.VAPID_PUBLIC_KEY) return Response.json({ delivered: 0, configured: false })
  const { pool } = getDatabase()
  await pool.query(`DELETE FROM notification_outbox WHERE attempts>=4 OR "createdAt"<now()-interval '24 hours'`)
  const claimed = (await pool.query<Delivery>(`
    WITH due AS (
      SELECT "recordId","subscriptionId" FROM notification_outbox
      WHERE "availableAt"<=now() AND ("lockedUntil" IS NULL OR "lockedUntil"<now())
      ORDER BY "createdAt" LIMIT 50 FOR UPDATE SKIP LOCKED
    ) UPDATE notification_outbox j SET "lockedUntil"=now()+interval '90 seconds'
      FROM due WHERE j."recordId"=due."recordId" AND j."subscriptionId"=due."subscriptionId" RETURNING j.*
  `)).rows
  let delivered = 0
  const send = async (job: Delivery) => {
    // Recheck current membership, preferences and date eligibility immediately before sending.
    const sub = (await pool.query(`
      SELECT s.endpoint,s.p256dh,s.auth,s."userId",u.name,r.modality,c.name AS "challengeName"
      FROM push_subscription s JOIN cardio_record r ON r.id=$1 JOIN "user" u ON u.id=r."userId"
      JOIN challenge c ON c.id=$3 AND c.modality=r.modality AND r."recordDate" BETWEEN c."startDate" AND c."endDate"
      JOIN challenge_member viewer ON viewer."userId"=s."userId" AND viewer."challengeId"=c.id
      JOIN challenge_member author ON author."userId"=r."userId" AND author."challengeId"=c.id
      LEFT JOIN notification_preference p ON p."userId"=s."userId"
      WHERE s.id=$2 AND s.enabled AND s."userId"<>r."userId"
      AND CASE WHEN r.modality='cardio' THEN coalesce(p.cardio,true) ELSE coalesce(p.strength,true) END
      AND ($4::boolean=false OR EXISTS(SELECT 1 FROM record_challenge d WHERE d."recordId"=r.id AND d."challengeId"=c.id))
    `, [job.recordId, job.subscriptionId, job.challengeId, billingEnabled()])).rows[0]
    const remove = () => pool.query('DELETE FROM notification_outbox WHERE "recordId"=$1 AND "subscriptionId"=$2', [job.recordId, job.subscriptionId])
    if (!sub || !validPushEndpoint(sub.endpoint)) { await remove(); return }
    try {
      const payload = await buildPushPayload({ data: {
        title: 'Sua turma está em movimento',
        body: `${sub.name} registrou ${sub.modality === 'strength' ? 'musculação' : 'cardio'} em ${sub.challengeName}.`,
        url: `/?challengeId=${encodeURIComponent(job.challengeId)}&recordId=${encodeURIComponent(job.recordId)}`,
        tag: `pulso-record-${job.recordId}`, recipient: sub.userId,
      }, options: { ttl: 3600, urgency: 'normal' } }, {
        endpoint: sub.endpoint, expirationTime: null, keys: { p256dh: sub.p256dh, auth: sub.auth },
      }, { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY, subject: process.env.VAPID_SUBJECT || 'https://cardio.renatoqsousam.workers.dev' })
      const result = await fetch(sub.endpoint, { ...payload, redirect: 'error', signal: AbortSignal.timeout(5000) })
      if (result.ok) { await remove(); delivered++; return }
      if (result.status === 404 || result.status === 410) {
        // Invalid endpoints no longer consume retries or receive future publications.
        await pool.query('DELETE FROM push_subscription WHERE id=$1 AND endpoint=$2', [job.subscriptionId, sub.endpoint]); return
      }
      if (result.status === 400 || result.status === 413) { await remove(); console.error('Push rejected:', result.status); return }
      console.error('Push delivery deferred:', result.status)
    } catch { console.error('Push delivery deferred: CONNECTION_OR_ENCRYPTION') }
    await pool.query(`UPDATE notification_outbox SET attempts=attempts+1,"lockedUntil"=NULL,"availableAt"=now()+((CASE attempts WHEN 0 THEN 60 WHEN 1 THEN 300 ELSE 900 END)*interval '1 second') WHERE "recordId"=$1 AND "subscriptionId"=$2`, [job.recordId, job.subscriptionId])
  }
  for (let offset = 0; offset < claimed.length; offset += 10) await Promise.all(claimed.slice(offset, offset + 10).map(send))
  return Response.json({ delivered, processed: claimed.length })
})
