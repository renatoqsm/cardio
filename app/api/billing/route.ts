import { headers } from 'next/headers'
import { getAuth } from '@/lib/auth'
import { getDatabase, withDatabase } from '@/lib/db'
import { billingEnabled, billingTransaction, accessForChallenge, reconcileChallenge, cancelChallengeBilling, BillingError, type Order } from '@/lib/billing/store'
import { premiumPlan } from '@/lib/billing/plans'
import { AsaasError, createRecurringCheckout, assertAsaasReady } from '@/lib/billing/asaas'
import { checkoutImage } from '@/lib/billing/checkout-image'
async function ownedChallenge(challengeId: unknown) {
  const session=await getAuth().api.getSession({headers:await headers()})
  if (!session?.user) throw new BillingError('Sua sessão expirou. Entre novamente.',401)
  if (typeof challengeId!=='string' || challengeId.length>100) throw new BillingError('Desafio inválido.')
  const challenge=(await getDatabase().pool.query<{id:string;ownerId:string;modality:'cardio'|'strength';count:number}>(`SELECT c.*, (SELECT count(*)::int FROM challenge_member m WHERE m."challengeId"=c.id) AS count FROM challenge c WHERE c.id=$1`,[challengeId])).rows[0]
  if (!challenge || challenge.ownerId!==session.user.id) throw new BillingError('Somente o administrador pode gerenciar a assinatura.',403)
  return challenge
}
export const POST=withDatabase(async(request:Request)=>{
  try {
    if (!billingEnabled()) throw new BillingError('O Premium está em preparação. Os desafios continuam disponíveis.',503)
    if (request.headers.get('origin') !== new URL(request.url).origin) throw new BillingError('Origem inválida.',403)
    const body=await request.json(), challenge=await ownedChallenge(body.challengeId)
    if (body.action==='reconcile') {
      await reconcileChallenge(challenge.id)
      return Response.json({billing:await accessForChallenge(challenge.id,challenge.modality,challenge.count)},{headers:{'Cache-Control':'no-store'}})
    }
    if (body.action==='cancel') {
      await cancelChallengeBilling(challenge.id)
      return Response.json({billing:await accessForChallenge(challenge.id,challenge.modality,challenge.count)})
    }
    if (body.action!=='checkout') throw new BillingError('Ação inválida.')
    assertAsaasReady()
    const plan=premiumPlan(body.plan)
    const reservation=await billingTransaction(async client=>{
      const locked=(await client.query('SELECT id FROM challenge WHERE id=$1 AND "ownerId"=$2 FOR UPDATE',[challenge.id,challenge.ownerId])).rows[0]
      if (!locked) throw new BillingError('Desafio não disponível.',404)
      const open=(await client.query<Order>(`SELECT * FROM billing_order WHERE "challengeId"=$1 AND status IN ('creating','pending','active','unknown','canceling') LIMIT 1`,[challenge.id])).rows[0]
      if (open) {
        if (open.status==='pending' && open.expiresAt>new Date() && open.checkoutUrl && open.plan===plan.id) return {url:open.checkoutUrl,id:open.id}
        throw new BillingError('Este desafio já possui uma contratação. Confira o pagamento ou cancele a contratação antes de trocar o plano.',409)
      }
      if ((await accessForChallenge(challenge.id,challenge.modality,challenge.count,client)).premium) throw new BillingError('Aguarde o fim do período pago para contratar outro plano.',409)
      const id=crypto.randomUUID(), now=new Date(), expires=new Date(now.getTime()+3600000)
      await client.query(`INSERT INTO billing_order (id,"challengeId","ownerId",plan,status,"createdAt","expiresAt") VALUES ($1,$2,$3,$4,'creating',$5,$6)`,[id,challenge.id,challenge.ownerId,plan.id,now,expires])
      return {id,url:null}
    })
    let result: {url:string}
    if (reservation.url) result={url:reservation.url}
    else {
      try {
        const checkout=await createRecurringCheckout({reference:reservation.id,challengeId:challenge.id,plan:plan.id,imageBase64:checkoutImage})
        await getDatabase().pool.query(`UPDATE billing_order SET status='pending',"checkoutId"=$2,"checkoutUrl"=$3 WHERE id=$1`,[reservation.id,checkout.id,checkout.url])
        result={url:checkout.url}
      } catch(error) {
        // A timeout can occur after provider creation. Retain a durable reservation;
        // never silently create a second recurring contract on a retry.
        const rejected=error instanceof AsaasError && [400,401,403,422].includes(error.status)
        await getDatabase().pool.query('UPDATE billing_order SET status=$2 WHERE id=$1',[reservation.id,rejected?'failed':'unknown'])
        throw error
      }
    }
    return Response.json(result,{headers:{'Cache-Control':'no-store'}})
  } catch(error) {
    if (error instanceof BillingError || error instanceof AsaasError) return Response.json({error:error.message},{status:error instanceof AsaasError ? 503 : error.status})
    console.error('Billing operation failed')
    return Response.json({error:'Não foi possível concluir a contratação. Tente novamente.'},{status:503})
  }
})
