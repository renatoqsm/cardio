import { headers } from 'next/headers'
import { getAuth } from '@/lib/auth'
import { getDatabase,withDatabase } from '@/lib/db'
import { billingEnabled } from '@/lib/billing/store'
async function access(recordId: unknown, challengeId: unknown, userId: string) {
 if(typeof recordId!=='string'||typeof challengeId!=='string'||recordId.length>100||challengeId.length>100)return null
 const rows=(await getDatabase().pool.query(`SELECT c."ownerId" FROM cardio_record r JOIN challenge c ON c.id=$2 JOIN challenge_member author ON author."challengeId"=c.id AND author."userId"=r."userId" JOIN challenge_member viewer ON viewer."challengeId"=c.id AND viewer."userId"=$3 WHERE r.id=$1 AND r.modality=c.modality AND r."recordDate" BETWEEN c."startDate" AND c."endDate" AND ($4::boolean=false OR EXISTS (SELECT 1 FROM record_challenge d WHERE d."recordId"=r.id AND d."challengeId"=c.id))`,[recordId,challengeId,userId,billingEnabled()])).rows
 return rows[0]??null
}
export const GET=withDatabase(async(request:Request)=>{
 const me=(await getAuth().api.getSession({headers:await headers()}))?.user;if(!me)return Response.json({error:'Não autenticado'},{status:401})
 const query=new URL(request.url).searchParams,recordId=query.get('recordId'),challengeId=query.get('challengeId')
 const permission=await access(recordId,challengeId,me.id);if(!permission)return Response.json({error:'Treino não disponível neste desafio.'},{status:404})
 const {pool}=getDatabase()
 const reactions=(await pool.query(`SELECT emoji,count(*)::int AS count,bool_or("userId"=$3) AS mine FROM record_reaction WHERE "recordId"=$1 AND "challengeId"=$2 GROUP BY emoji`,[recordId,challengeId,me.id])).rows
 const before=query.get('before');if(before&&!/^[A-Za-z0-9_-]{1,100}$/.test(before))return Response.json({error:'Comentário inválido.'},{status:400})
 const anchor=before?(await pool.query('SELECT "createdAt"::text AS "createdAt",id FROM record_comment WHERE id=$1 AND "recordId"=$2 AND "challengeId"=$3',[before,recordId,challengeId])).rows[0]:null
 if(before&&!anchor)return Response.json({error:'Este comentário foi removido. Atualize a conversa.'},{status:409})
 const rows=(await pool.query(`SELECT m.id,m.body,m."createdAt",u.name,u.image,m."userId" FROM record_comment m JOIN "user" u ON u.id=m."userId" WHERE m."recordId"=$1 AND m."challengeId"=$2 AND ($3::timestamptz IS NULL OR (m."createdAt",m.id)<($3::timestamptz,$4::text)) ORDER BY m."createdAt" DESC,m.id DESC LIMIT 21`,[recordId,challengeId,anchor?.createdAt??null,anchor?.id??null])).rows
 const count=(await pool.query('SELECT count(*)::int AS count FROM record_comment WHERE "recordId"=$1 AND "challengeId"=$2',[recordId,challengeId])).rows[0].count
 return Response.json({reactions,comments:rows.slice(0,20).map(c=>({...c,canDelete:c.userId===me.id||permission.ownerId===me.id})),next:rows.length>20?rows[19].id:null,commentCount:count},{headers:{'Cache-Control':'private, no-store'}})
})
export const POST=withDatabase(async(request:Request)=>{
 const me=(await getAuth().api.getSession({headers:await headers()}))?.user;if(!me)return Response.json({error:'Não autenticado'},{status:401})
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Origem inválida.'},{status:403})
 let body;try{body=await request.json()}catch{return Response.json({error:'Dados inválidos.'},{status:400})}
 const permission=await access(body?.recordId,body?.challengeId,me.id);if(!permission)return Response.json({error:'Treino não disponível neste desafio.'},{status:404})
 const {pool}=getDatabase()
 if(body.action==='react'){
  if(body.emoji!==null&&!['💪','🔥','👏'].includes(body.emoji))return Response.json({error:'Reação inválida.'},{status:400})
  if(body.emoji===null)await pool.query('DELETE FROM record_reaction WHERE "recordId"=$1 AND "challengeId"=$2 AND "userId"=$3',[body.recordId,body.challengeId,me.id])
  else await pool.query('INSERT INTO record_reaction VALUES ($1,$2,$3,$4) ON CONFLICT ("recordId","challengeId","userId") DO UPDATE SET emoji=excluded.emoji',[body.recordId,body.challengeId,me.id,body.emoji])
 } else if(body.action==='comment'){
  const text=typeof body.body==='string'?body.body.trim():''
  if(!text||text.length>500||text.includes('\0')||typeof body.commentId!=='string'||!/^[0-9a-f-]{36}$/i.test(body.commentId))return Response.json({error:'Escreva até 500 caracteres.'},{status:400})
  const result=await pool.query(`INSERT INTO record_comment (id,"recordId","challengeId","userId",body) VALUES ($1,$2,$3,$4,$5) ON CONFLICT(id) DO NOTHING RETURNING id`,[body.commentId,body.recordId,body.challengeId,me.id,text])
  if(!result.rowCount){const previous=(await pool.query('SELECT 1 FROM record_comment WHERE id=$1 AND "userId"=$2 AND "recordId"=$3 AND "challengeId"=$4',[body.commentId,me.id,body.recordId,body.challengeId])).rowCount;if(!previous)return Response.json({error:'Comentário inválido.'},{status:409})}
 } else if(body.action==='deleteComment'){
  await pool.query('DELETE FROM record_comment WHERE id=$1 AND "recordId"=$2 AND "challengeId"=$3 AND ("userId"=$4 OR $5::boolean)',[body.commentId,body.recordId,body.challengeId,me.id,permission.ownerId===me.id])
 } else return Response.json({error:'Ação inválida.'},{status:400})
 return Response.json({ok:true})
})
