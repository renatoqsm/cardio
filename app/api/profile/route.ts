import { headers } from 'next/headers'
import { getAuth } from '@/lib/auth'
import { getDatabase, withDatabase } from '@/lib/db'
import { readProof, validFilename } from '@/lib/storage'
async function current() { return (await getAuth().api.getSession({ headers: await headers() }))?.user }
async function profile(id: string) {
  const { rows } = await getDatabase().pool.query('SELECT u.id,u.name,u.image,p.age,p.weight::float8 AS weight FROM "user" u LEFT JOIN user_profile p ON p."userId"=u.id WHERE u.id=$1',[id])
  return rows[0]
}
export const GET = withDatabase(async () => {
  const me = await current()
  if (!me) return Response.json({error:'Não autenticado'},{status:401})
  return Response.json({profile:await profile(me.id)},{headers:{'Cache-Control':'private, no-store'}})
})
export const POST = withDatabase(async (request: Request) => {
  const me = await current()
  if (!me) return Response.json({error:'Não autenticado'},{status:401})
  if (request.headers.get('origin') !== new URL(request.url).origin) return Response.json({error:'Origem inválida.'},{status:403})
  let body
  try { body=await request.json() } catch { return Response.json({error:'Dados inválidos.'},{status:400}) }
  const invalid = (error: string) => Response.json({error},{status:400})
  if (!body || typeof body !== 'object' || typeof body.name !== 'string') return invalid('Informe seu nome.')
  const name=body.name.trim().replace(/\s+/g,' ')
  if (!name || name.length>100) return invalid('O nome deve ter entre 1 e 100 caracteres.')
  const age=body.age == null || body.age === '' ? null : Number(body.age)
  if (age !== null && (!(typeof body.age === 'number' || typeof body.age === 'string') || !Number.isInteger(age) || age<1 || age>130)) return invalid('Informe uma idade inteira entre 1 e 130 anos.')
  const text=body.weight == null || body.weight === '' ? null : String(body.weight).trim().replace(',','.')
  if (text !== null && (!/^[0-9]+(\.[0-9]{1,2})?$/.test(text) || Number(text)<1 || Number(text)>500)) return invalid('Informe um peso entre 1 e 500 kg, com até duas casas decimais.')
  const image=body.image == null || body.image === '' ? null : body.image
  if (image !== null) {
    const parts=typeof image === 'string' ? image.split('/') : []
    if (parts.length!==5 || parts[1]!=='api' || parts[2]!=='proofs' || parts[3]!==me.id || !validFilename(parts[4]) || !await readProof(me.id,parts[4])) return invalid('Envie uma foto válida da sua conta.')
  }
  const client=await getDatabase().pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('UPDATE "user" SET name=$2,image=$3,"updatedAt"=now() WHERE id=$1',[me.id,name,image])
    await client.query('INSERT INTO user_profile ("userId",age,weight) VALUES ($1,$2,$3) ON CONFLICT ("userId") DO UPDATE SET age=excluded.age,weight=excluded.weight',[me.id,age,text])
    await client.query('COMMIT')
  } catch (error) { await client.query('ROLLBACK'); throw error }
  finally { client.release() }
  return Response.json({profile:await profile(me.id)},{headers:{'Cache-Control':'private, no-store'}})
})
