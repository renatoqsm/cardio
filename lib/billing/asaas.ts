import 'server-only'
import { premiumPlan, type PremiumPlanId } from './plans'
export class AsaasError extends Error {
  constructor(public status: number, message = 'Não foi possível concluir a operação no Asaas. Tente novamente.') { super(message) }
}
function configuration() {
  const key = process.env.ASAAS_API_KEY
  if (!key) throw new AsaasError(503, 'A integração de pagamentos ainda não está disponível.')
  const environment = process.env.ASAAS_ENVIRONMENT
  if (environment !== 'production' && environment !== 'sandbox') throw new AsaasError(503, 'O ambiente de pagamentos ainda não foi configurado.')
  return { key, api: environment === 'production' ? 'https://api.asaas.com/v3' : 'https://api-sandbox.asaas.com/v3', checkoutOrigin: environment === 'production' ? 'https://asaas.com' : 'https://sandbox.asaas.com' }
}
function resourceId(value: unknown) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(value)) throw new AsaasError(400, 'Identificador de pagamento inválido.')
  return encodeURIComponent(value)
}
export async function asaasRequest<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const config = configuration()
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('://')) throw new AsaasError(400)
  let response: Response
  try {
    response = await fetch(`${config.api}${path}`, {
      method, headers: { access_token: config.key, 'Content-Type': 'application/json', 'User-Agent': 'Pulso/1.0' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(20000), cache: 'no-store', redirect: 'error',
    })
  } catch { throw new AsaasError(503) }
  // Do not expose provider responses containing customer or card data to clients/logs.
  if (!response.ok) throw new AsaasError(response.status)
  try { return await response.json() as T } catch { throw new AsaasError(502) }
}
export type AsaasPayment = { id: string; customer: string; subscription: string | null; checkoutSession: string | null; value: number; billingType: string; status: string; dueDate: string; deleted: boolean }
export type AsaasSubscription = { id: string; customer: string; checkoutSession: string | null; cycle: string; value: number; status: string; deleted: boolean; nextDueDate: string }
export function readPayment(id: string) { return asaasRequest<AsaasPayment>(`/payments/${resourceId(id)}`) }
export function readSubscription(id: string) { return asaasRequest<AsaasSubscription>(`/subscriptions/${resourceId(id)}`) }
export function paymentsForCheckout(id: string) { return asaasRequest<{ data: AsaasPayment[]; hasMore: boolean }>(`/payments?checkoutSession=${resourceId(id)}&limit=100`) }
export function cancelSubscription(id: string) { return asaasRequest<{ deleted: boolean; id: string }>(`/subscriptions/${resourceId(id)}`, 'DELETE') }
export function cancelCheckout(id: string) { return asaasRequest<unknown>(`/checkouts/${resourceId(id)}/cancel`, 'POST') }
export async function createRecurringCheckout(input: { reference: string; challengeId: string; plan: PremiumPlanId; imageBase64: string }) {
  const plan = premiumPlan(input.plan), config = configuration(), base = new URL(process.env.BETTER_AUTH_URL || '')
  if (base.protocol !== 'https:' && !(config.checkoutOrigin.includes('sandbox') && ['localhost', '127.0.0.1'].includes(base.hostname))) throw new AsaasError(503, 'O endereço seguro do aplicativo ainda não foi configurado.')
  resourceId(input.reference); resourceId(input.challengeId)
  if (!input.imageBase64 || input.imageBase64.length > 100000) throw new AsaasError(400)
  const callback = (result: string) => { const url = new URL('/', base); url.searchParams.set('challengeId', input.challengeId); url.searchParams.set('checkout', result); return url.toString() }
  const nextDueDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  const result = await asaasRequest<{ id: string }>('/checkouts', 'POST', {
    billingTypes: ['CREDIT_CARD'], chargeTypes: ['RECURRENT'], minutesToExpire: 60, externalReference: input.reference,
    callback: { successUrl: callback('returned'), cancelUrl: callback('canceled'), expiredUrl: callback('expired') },
    items: [{ name: `Pulso Premium ${plan.label}`, description: `Premium por desafio. Renovação ${plan.id === 'monthly' ? 'mensal' : 'anual'} automática; até 200 membros.`, quantity: 1, value: plan.amountCents / 100, imageBase64: input.imageBase64 }],
    subscription: { cycle: plan.cycle, nextDueDate },
  })
  resourceId(result.id)
  // Build the hosted URL ourselves; never redirect to an arbitrary URL from a payload.
  const url = new URL('/checkoutSession/show', config.checkoutOrigin); url.searchParams.set('id', result.id)
  return { id: result.id, url: url.toString() }
}
