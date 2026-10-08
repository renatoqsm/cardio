// Amounts are fixed server-side in integer centavos; callers select only a plan ID.
export const premiumPlans = {
  monthly: { id: 'monthly', label: 'Mensal', amountCents: 990, currency: 'BRL', cycle: 'MONTHLY', months: 1 },
  annual: { id: 'annual', label: 'Anual', amountCents: 4990, currency: 'BRL', cycle: 'YEARLY', months: 12 },
} as const
export type PremiumPlanId = keyof typeof premiumPlans
export const freeMemberLimit = 5
export const premiumMemberLimit = 200
export function premiumPlan(value: unknown) {
  if (value !== 'monthly' && value !== 'annual') throw new Error('Escolha o plano mensal ou anual.')
  return premiumPlans[value]
}
export type PaidPeriod = { startsAt: Date; endsAt: Date }
export function hasPaidAccess(periods: readonly PaidPeriod[], now = new Date()) {
  return periods.some(period => Number.isFinite(period.startsAt.getTime()) && Number.isFinite(period.endsAt.getTime()) && period.startsAt <= now && now < period.endsAt)
}
export function challengeAccess(modality: 'cardio' | 'strength', memberCount: number, periods: readonly PaidPeriod[], now = new Date()) {
  const premium = hasPaidAccess(periods, now)
  const memberLimit = premium ? premiumMemberLimit : freeMemberLimit
  const canTrain = (modality === 'strength' || premium) && memberCount <= memberLimit
  return { premium, memberLimit, canTrain, canJoin: canTrain && memberCount < memberLimit,
    reason: canTrain ? null : modality === 'cardio' && !premium ? 'CARDIO_REQUIRES_PREMIUM' as const : 'GROUP_REQUIRES_PREMIUM' as const }
}
