import type { RecordPublication } from './hub-types'
export class PublicationError extends Error {
 constructor(message: string, public status: number, public result: any = null) { super(message) }
}
/** The same submission key is retained for every attempt and confirmation. */
export async function publishRecord(payload: Record<string, unknown>, onStage: (stage: string) => void, request: typeof fetch = fetch): Promise<RecordPublication> {
 for (let attempt=0;attempt<2;attempt++) {
  try {
   onStage(attempt?'Tentando novamente…':'Publicando treino…')
   const response=await request('/api/challenges',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(20000)})
   const result=await response.json()
   if(response.ok)return result
   if(response.status<500)throw new PublicationError(response.status===401?'Sua sessão expirou. Entre novamente para publicar.':result.error||'Não foi possível publicar.',response.status,result)
  } catch(error) { if(error instanceof PublicationError)throw error }
  onStage('Conferindo se foi salvo…')
  try {
   const confirmation=await request(`/api/records?submissionKey=${encodeURIComponent(String(payload.submissionKey))}`,{cache:'no-store',signal:AbortSignal.timeout(15000)})
   if(!confirmation.ok)throw new Error()
   const result=await confirmation.json()
   if(result.deleted)throw new PublicationError('Este registro foi excluído. Abra um novo registro para publicar novamente.',409)
   if(result.publication)return result.publication
  } catch(error) {
   if(error instanceof PublicationError)throw error
   throw new Error('Não consegui confirmar se o treino foi salvo. Sua foto e seus dados continuam aqui. Confira a conexão e tente novamente; o registro não será duplicado.')
  }
 }
 throw new Error('O treino ainda não foi salvo. Sua foto e seus dados continuam aqui. Confira a conexão e tente novamente.')
}
