import 'server-only'
import type { PoolClient } from 'pg'
import { getDatabase } from '@/lib/db'
import { challengeAccess, premiumPlan, type PremiumPlanId, type PaidPeriod } from './plans'
import { invoicePeriod, paymentGrantsAccess } from './periods'
import { readPayment, readSubscription, paymentsForCheckout, paymentsForSubscription, cancelCheckout, cancelSubscription, AsaasError, type AsaasPayment } from './asaas'

export function billingEnabled() { return process.env.BILLING_ENABLED === 'true' }
export class BillingError extends Error { constructor(message: string, public status = 400) { super(message) } }
export type Order = { id: string; challengeId: string; ownerId: string; plan: PremiumPlanId; status: string; checkoutId: string | null; subscriptionId: string | null; checkoutUrl: string | null; createdAt: Date; expiresAt: Date }
export type BillingAccess = ReturnType<typeof challengeAccess> & { enabled: boolean; paidUntil: string | null; renewal: boolean; plan: PremiumPlanId | null; pending: boolean }
export async function billingTransaction<T>(handler: (client: PoolClient) => Promise<T>) {
  const client = await getDatabase().pool.connect()
  try {
    await client.query('BEGIN')
    // Serialize provider lifecycle changes, including canonical reads, to defeat out-of-order deliveries.
    await client.query("SELECT pg_advisory_xact_lock(hashtext('pulso-billing-lifecycle'))")
    const value = await handler(client)
    await client.query('COMMIT'); return value
  } catch (error) { await client.query('ROLLBACK'); throw error }
  finally { client.release() }
}
export async function accessForChallenge(id: string, modality: 'cardio' | 'strength', count: number, client?: PoolClient): Promise<BillingAccess> {
  if (!billingEnabled()) return { enabled: false, premium: false, memberLimit: 200, canTrain: true, canJoin: true, reason: null, paidUntil: null, renewal: false, plan: null, pending: false }
  const connection = client ?? getDatabase().pool
  await connection.query("INSERT INTO billing_setting VALUES ('rollout',now()) ON CONFLICT DO NOTHING")
  const { rows } = await connection.query<PaidPeriod>(`SELECT p."startsAt", p."endsAt" FROM billing_payment p JOIN billing_order o ON o.id=p."orderId" WHERE o."challengeId"=$1 AND p.status='paid'`, [id])
  const access = challengeAccess(modality, count, rows)
  const { rows: orders } = await connection.query<Order>('SELECT * FROM billing_order WHERE "challengeId"=$1 ORDER BY "createdAt" DESC', [id])
  const ongoing = orders.find(o => ['active','pending','creating','unknown','canceling'].includes(o.status))
  // Only continuous paid periods determine the displayed expiry.
  let until = new Date()
  for (const p of rows.sort((a,b) => a.startsAt.getTime()-b.startsAt.getTime())) if (p.startsAt <= until && p.endsAt > until) until = p.endsAt
  return { ...access, enabled: true, paidUntil: access.premium ? until.toISOString() : null, renewal: ongoing?.status === 'active', plan: ongoing?.plan ?? orders[0]?.plan ?? null, pending: !!ongoing && (ongoing.status !== 'active' || !access.premium) }
}
export async function recordDestinations(userId: string, modality: string, date: string) {
  const { rows } = await getDatabase().pool.query<{ id: string; modality: 'cardio' | 'strength'; count: number }>(`SELECT c.id,c.modality,(SELECT count(*)::int FROM challenge_member m WHERE m."challengeId"=c.id) AS count FROM challenge c JOIN challenge_member m ON m."challengeId"=c.id WHERE m."userId"=$1 AND c.modality=$2 AND $3::date BETWEEN c."startDate" AND c."endDate"`, [userId,modality,date])
  const destinations: string[] = []
  for (const row of rows) if ((await accessForChallenge(row.id,row.modality,row.count)).canTrain) destinations.push(row.id)
  return destinations
}
async function orderForPayment(payment: AsaasPayment, client: PoolClient) {
  const { rows } = await client.query<Order>(`SELECT * FROM billing_order WHERE "subscriptionId"=$1 OR ("checkoutId"=$2 AND $2 IS NOT NULL) LIMIT 1`, [payment.subscription,payment.checkoutSession])
  if (rows[0]) return rows[0]
  if (!payment.subscription) return null
  const subscription = await readSubscription(payment.subscription)
  if (!subscription.checkoutSession) return null
  return (await client.query<Order>('SELECT * FROM billing_order WHERE "checkoutId"=$1', [subscription.checkoutSession])).rows[0] ?? null
}
async function applyPayment(paymentId: string, client: PoolClient) {
  // Payload values never grant access; obtain the provider's current canonical resource.
  let payment: AsaasPayment
  try { payment = await readPayment(paymentId) } catch(error) {
    if (error instanceof AsaasError && error.status===404) {
      const result=await client.query("UPDATE billing_payment SET status='DELETED',\"updatedAt\"=now() WHERE id=$1",[paymentId])
      if (result.rowCount) return
    }
    throw error
  }
  const order = await orderForPayment(payment,client)
  if (!order || !payment.subscription) return
  const subscription = await readSubscription(payment.subscription), plan = premiumPlan(order.plan)
  if ((payment.checkoutSession && payment.checkoutSession !== order.checkoutId) || subscription.checkoutSession !== order.checkoutId || subscription.cycle !== plan.cycle || Math.round(subscription.value*100) !== plan.amountCents || payment.customer !== subscription.customer || (order.subscriptionId && payment.subscription !== order.subscriptionId)) throw new BillingError('A assinatura não corresponde à contratação.',422)
  if (order.status === 'canceled' && !subscription.deleted) {
    // A canceled checkout may complete just as cancellation happens. Stop its future renewal.
    await cancelSubscription(subscription.id)
  }
  await client.query('UPDATE billing_order SET "subscriptionId"=$2,status=$3 WHERE id=$1', [order.id,subscription.id,subscription.deleted || order.status === 'canceled' ? 'canceled' : 'active'])
  const period = invoicePeriod(payment.dueDate,order.plan)
  const paid = paymentGrantsAccess(payment,order.plan)
  await client.query(`INSERT INTO billing_payment (id,"orderId","amountCents",status,"startsAt","endsAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,now()) ON CONFLICT(id) DO UPDATE SET status=excluded.status,"amountCents"=excluded."amountCents","updatedAt"=now()`, [payment.id,order.id,Math.round(payment.value*100),paid?'paid':payment.status,period.startsAt,period.endsAt])
}
async function reconcileOrder(order: Order, client: PoolClient) {
  for (let offset=0; ; offset+=100) {
    const page = order.subscriptionId ? await paymentsForSubscription(order.subscriptionId,offset) : order.checkoutId ? await paymentsForCheckout(order.checkoutId,offset) : {data:[],hasMore:false}
    for (const payment of page.data) await applyPayment(payment.id,client)
    if (!page.hasMore) break
    if (offset >= 9900) throw new BillingError('A reconciliação precisa de suporte.',503)
  }
  if (order.subscriptionId) {
    const current = await readSubscription(order.subscriptionId)
    if (current.deleted) await client.query("UPDATE billing_order SET status='canceled' WHERE id=$1",[order.id])
  }
}
export async function reconcileChallenge(challengeId: string) {
  return billingTransaction(async client => {
    const {rows} = await client.query<Order>('SELECT * FROM billing_order WHERE "challengeId"=$1',[challengeId])
    for (const order of rows) await reconcileOrder(order,client)
  })
}
export async function processBillingEvent(event: { id: string; event: string; payment?: {id?: string}; subscription?: {id?: string}; checkout?: {id?: string} }) {
  return billingTransaction(async client => {
    if ((await client.query('SELECT 1 FROM billing_event WHERE id=$1',[event.id])).rowCount) return
    if (event.event.startsWith('PAYMENT_') && event.payment?.id) await applyPayment(event.payment.id,client)
    else if (event.event.startsWith('SUBSCRIPTION_') && event.subscription?.id) {
      const subscription = await readSubscription(event.subscription.id)
      const order = (await client.query<Order>('SELECT * FROM billing_order WHERE "subscriptionId"=$1 OR "checkoutId"=$2 LIMIT 1',[subscription.id,subscription.checkoutSession])).rows[0]
      if (order) {
        const plan = premiumPlan(order.plan)
        if (subscription.cycle !== plan.cycle || Math.round(subscription.value*100) !== plan.amountCents || subscription.checkoutSession !== order.checkoutId) throw new BillingError('Assinatura divergente.',422)
        if (order.status === 'canceled' && !subscription.deleted) await cancelSubscription(subscription.id)
        await client.query('UPDATE billing_order SET "subscriptionId"=$2,status=$3 WHERE id=$1',[order.id,subscription.id,subscription.deleted || order.status==='canceled'?'canceled':'active'])
        await reconcileOrder({...order,subscriptionId:subscription.id},client)
      }
    } else if (event.event.startsWith('CHECKOUT_') && event.checkout?.id) {
      const order = (await client.query<Order>('SELECT * FROM billing_order WHERE "checkoutId"=$1',[event.checkout.id])).rows[0]
      if (order) {
        await reconcileOrder(order,client)
        // Checkout cancellation/expiry cannot revoke a paid period or override a real subscription.
        if (['CHECKOUT_CANCELED','CHECKOUT_EXPIRED'].includes(event.event)) await client.query(`UPDATE billing_order SET status=$2 WHERE id=$1 AND "subscriptionId" IS NULL AND status IN ('pending','unknown')`,[order.id,event.event==='CHECKOUT_EXPIRED'?'expired':'canceled'])
      }
    }
    await client.query('INSERT INTO billing_event VALUES ($1,$2,now()) ON CONFLICT DO NOTHING',[event.id,event.event])
  })
}
export async function cancelChallengeBilling(challengeId: string, existingClient?: PoolClient) {
  const cancel = async (client: PoolClient) => {
    const {rows} = await client.query<Order>(`SELECT * FROM billing_order WHERE "challengeId"=$1 AND status IN ('creating','pending','active','unknown','canceling')`,[challengeId])
    for (const original of rows) {
      await reconcileOrder(original,client)
      const order = (await client.query<Order>('SELECT * FROM billing_order WHERE id=$1',[original.id])).rows[0]
      if (order.subscriptionId) {
        const sub=await readSubscription(order.subscriptionId)
        if (!sub.deleted) await cancelSubscription(order.subscriptionId)
      } else if (order.checkoutId) {
        try { await cancelCheckout(order.checkoutId) } catch (e) { if (!(e instanceof AsaasError && e.status===404)) throw e }
      } else throw new BillingError(order.status === 'unknown' ? 'A criação do checkout ficou sem confirmação. Contate o suporte antes de tentar outra contratação.' : 'A contratação ainda está sendo criada. Aguarde e tente novamente.',409)
      await client.query("UPDATE billing_order SET status='canceled' WHERE id=$1",[order.id])
    }
  }
  return existingClient ? cancel(existingClient) : billingTransaction(cancel)
}
