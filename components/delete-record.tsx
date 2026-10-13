'use client'
import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Dialog } from './ui'
import { message } from '@/lib/client'
export function DeleteRecord({ recordId, onDeleted }: { recordId: string; onDeleted: () => void }) {
  const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('')
  const remove=async()=>{if(busy)return;setBusy(true);setError('');try{const r=await fetch(`/api/records?recordId=${encodeURIComponent(recordId)}`,{method:'DELETE',signal:AbortSignal.timeout(20000)});if(!r.ok&&r.status!==404){const body=await r.json().catch(()=>null);throw new Error(body?.error||'Não foi possível excluir. Tente novamente.')}setOpen(false);onDeleted()}catch(e){setError(message(e))}finally{setBusy(false)}}
  return <><button className="delete-record-button" onClick={()=>{setError('');setOpen(true)}}><Trash2 size={16}/>Excluir registro</button>{open&&<Dialog title="Excluir registro?" onClose={()=>{if(!busy)setOpen(false)}}><p className="editor-intro">Este treino será removido do feed e deixará de contar em todos os desafios, no resumo geral e no calendário. Esta ação não pode ser desfeita.</p>{error&&<p className="error" role="alert">{error}</p>}<div className="replacement-actions"><button className="button secondary" disabled={busy} onClick={()=>setOpen(false)}>Cancelar</button><button className="button danger" disabled={busy} onClick={()=>void remove()}>{busy?'Excluindo…':'Confirmar exclusão'}</button></div></Dialog>}</>
}
