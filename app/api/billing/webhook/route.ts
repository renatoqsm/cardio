import { withDatabase } from '@/lib/db'
import { processBillingEvent } from '@/lib/billing/store'
import { validWebhookToken } from '@/lib/billing/webhook-auth'
export const POST = withDatabase(async (request: Request) => {
  if (!validWebhookToken(request.headers.get('asaas-access-token'),process.env.ASAAS_WEBHOOK_TOKEN)) return Response.json({error:'Não autorizado'},{status:401})
  try {
    const raw=await request.text()
    if (raw.length>100000) return Response.json({error:'Evento muito grande'},{status:413})
    const event=JSON.parse(raw)
    if (typeof event.id!=='string' || !/^[A-Za-z0-9_-]{1,200}$/.test(event.id) || typeof event.event!=='string' || !/^[A-Z_]{1,100}$/.test(event.event)) return Response.json({error:'Evento inválido'},{status:400})
    await processBillingEvent(event)
    return Response.json({ok:true})
  } catch {
    // Never log provider payloads, card/customer data or webhook credentials.
    console.error('Billing webhook processing failed')
    return Response.json({error:'Não foi possível processar o evento'},{status:503})
  }
})
