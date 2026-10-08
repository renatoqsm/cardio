import { premiumPlan, type PremiumPlanId } from './plans'
// Invoice dates use the merchant's Brasília calendar, independent of browser time.
export function invoicePeriod(dueDate: string, plan: PremiumPlanId) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) throw new Error('Invalid invoice date')
  const start = new Date(`${dueDate}T03:00:00.000Z`)
  if (!Number.isFinite(start.getTime()) || start.toISOString().slice(0, 10) !== dueDate) throw new Error('Invalid invoice date')
  const end = new Date(start), day = end.getUTCDate()
  end.setUTCDate(1); end.setUTCMonth(end.getUTCMonth() + premiumPlan(plan).months)
  const lastDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate()
  end.setUTCDate(Math.min(day, lastDay))
  return { startsAt: start, endsAt: end }
}
export function paymentGrantsAccess(payment: { status: string; deleted: boolean; value: number; billingType: string; refunds?: unknown[]; chargeback?: unknown }, plan: PremiumPlanId) {
  return !payment.deleted && ['CONFIRMED', 'RECEIVED'].includes(payment.status)
    && payment.billingType === 'CREDIT_CARD' && Math.round(payment.value * 100) === premiumPlan(plan).amountCents
    && !payment.refunds?.length && !payment.chargeback
}
