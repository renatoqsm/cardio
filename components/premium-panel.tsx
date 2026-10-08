'use client'
import { useState } from 'react'
import { Crown } from 'lucide-react'
import { Dialog } from './ui'
import { message, postJSON } from '@/lib/client'
import type { Challenge } from '@/lib/hub-types'
export function PremiumPanel({challenge,isOwner,onRefresh}:{challenge:Challenge;isOwner:boolean;onRefresh:()=>void}) {
  const [busy,setBusy]=useState(''),[error,setError]=useState(''),[cancel,setCancel]=useState(false)
  const billing=challenge.billing
  if (!billing?.enabled) return null
  const action=async(action:string,plan?:string)=>{
    if(busy)return
    setBusy(action);setError('')
    try {
      const result=await postJSON('/api/billing',{action,challengeId:challenge.id,plan})
      if(result.url) window.location.assign(result.url)
      else {setCancel(false);onRefresh()}
    } catch(e){setError(message(e))} finally{setBusy('')}
  }
  return <section className="premium-panel" aria-label="Plano do desafio">
    <div className="premium-heading"><Crown size={21}/><strong>{billing.premium?'Premium ativo':billing.pending?'Aguardando pagamento':'Plano gratuito'}</strong><span>{challenge.memberCount}/{billing.memberLimit} pessoas</span></div>
    {billing.premium ? <p>Cardio e musculação para até 200 pessoas neste desafio. Pago até {new Date(billing.paidUntil!).toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'})}. {billing.renewal?'Renovação automática.':'Renovação cancelada; acesso mantido até essa data.'}</p> : <p>{billing.canTrain?'Musculação gratuita para até 5 pessoas, incluindo o administrador.':'Este desafio está disponível para consulta. Ative o Premium para liberar novos treinos e participantes.'}</p>}
    {isOwner ? <>
      {!billing.premium && !billing.pending && <div className="premium-options"><button className="button primary" disabled={!!busy} onClick={()=>void action('checkout','monthly')}>Mensal · R$ 9,90/mês</button><button className="button secondary" disabled={!!busy} onClick={()=>void action('checkout','annual')}>Anual · R$ 49,90/ano</button><small>Renovação automática no cartão. O administrador paga por este desafio; convidados não pagam. Cancele a renovação quando quiser.</small></div>}
      {(billing.pending||billing.renewal) && <div className="premium-actions"><button className="button secondary" disabled={!!busy} onClick={()=>void action('reconcile')}>{busy==='reconcile'?'Conferindo…':'Conferir pagamento'}</button>{billing.pending && !billing.renewal && <button className="button primary" disabled={!!busy} onClick={()=>void action('checkout',billing.plan??'monthly')}>Continuar pagamento</button>}<button className="text-button" disabled={!!busy} onClick={()=>setCancel(true)}>{billing.renewal?'Cancelar renovação':'Cancelar contratação pendente'}</button></div>}
    </> : !billing.premium && <p>Somente o administrador pode contratar o Premium deste desafio.</p>}
    {error&&<p className="error" role="alert">{error}</p>}{busy==='checkout'&&<p role="status">Abrindo checkout seguro…</p>}
    {cancel&&<Dialog title="Cancelar renovação?" onClose={()=>{if(!busy)setCancel(false)}}><p>Não haverá novas renovações. O período já pago continua disponível; seus treinos, fotos e membros serão preservados.</p><p>Depois do período pago, cardio e musculação com mais de 5 membros ficam disponíveis para consulta. Musculação com até 5 pessoas continua gratuita.</p><button className="button primary full" disabled={!!busy} onClick={()=>void action('cancel')}>{busy?'Cancelando…':'Confirmar cancelamento'}</button>{error&&<p className="error" role="alert">{error}</p>}</Dialog>}
  </section>
}
