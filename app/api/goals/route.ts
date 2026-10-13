import { headers } from 'next/headers'
import { getAuth } from '@/lib/auth'
import { getDatabase,withDatabase } from '@/lib/db'
import { brazilToday,weekStart,addDays,activeWeekStreak } from '@/lib/week'
async function data(userId: string) {
 const {pool}=getDatabase(),today=brazilToday(),start=weekStart(today)
 const goals=(await pool.query('SELECT "strengthDays","cardioMinutes","cardioKilometers"::float8 AS "cardioKilometers" FROM personal_goal WHERE "userId"=$1',[userId])).rows[0]??{strengthDays:null,cardioMinutes:null,cardioKilometers:null}
 const rows=(await pool.query(`SELECT date_trunc('week',"recordDate"::timestamp)::date::text AS week,count(DISTINCT "recordDate") FILTER (WHERE modality='strength')::int AS "strengthDays",coalesce(sum(minutes) FILTER (WHERE modality='cardio'),0)::int AS "cardioMinutes",coalesce(sum(kilometers) FILTER (WHERE modality='cardio'),0)::float8 AS "cardioKilometers",count(DISTINCT "recordDate")::int AS "activeDays" FROM cardio_record WHERE "userId"=$1 AND "recordDate"<=$2::date GROUP BY 1 ORDER BY 1 DESC`,[userId,today])).rows
 return {goals,week:{startDate:start,endDate:addDays(start,6),...(rows.find(r=>r.week===start)??{strengthDays:0,cardioMinutes:0,cardioKilometers:0,activeDays:0})},activeWeekStreak:activeWeekStreak(rows.map(r=>r.week),today)}
}
export const GET=withDatabase(async()=>{const me=(await getAuth().api.getSession({headers:await headers()}))?.user;if(!me)return Response.json({error:'Não autenticado'},{status:401});return Response.json(await data(me.id),{headers:{'Cache-Control':'private, no-store'}})})
export const POST=withDatabase(async(request:Request)=>{
 const me=(await getAuth().api.getSession({headers:await headers()}))?.user;if(!me)return Response.json({error:'Não autenticado'},{status:401})
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Origem inválida.'},{status:403})
 let body;try{body=await request.json()}catch{return Response.json({error:'Dados inválidos.'},{status:400})}
 const integer=(value:unknown,max:number)=>value==null||value===''?null:typeof value==='number'&&Number.isInteger(value)&&value>=1&&value<=max?value:NaN
 const strength=integer(body?.strengthDays,7),minutes=integer(body?.cardioMinutes,10080),km=body?.cardioKilometers==null||body.cardioKilometers===''?null:body.cardioKilometers
 if(Number.isNaN(strength)||Number.isNaN(minutes)||(km!==null&&(typeof km!=='number'||!Number.isFinite(km)||km<0.1||km>10000||Math.abs(km*100-Math.round(km*100))>0.000001)))return Response.json({error:'Confira as metas: 1–7 dias, minutos inteiros e quilômetros com até duas casas decimais.'},{status:400})
 await getDatabase().pool.query('INSERT INTO personal_goal VALUES ($1,$2,$3,$4) ON CONFLICT ("userId") DO UPDATE SET "strengthDays"=excluded."strengthDays","cardioMinutes"=excluded."cardioMinutes","cardioKilometers"=excluded."cardioKilometers"',[me.id,strength,minutes,km])
 return Response.json(await data(me.id),{headers:{'Cache-Control':'private, no-store'}})
})
