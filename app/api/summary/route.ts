import { headers } from 'next/headers'
import { getAuth } from '@/lib/auth'
import { getDatabase, withDatabase } from '@/lib/db'
export const GET = withDatabase(async (request: Request) => {
  const session = await getAuth().api.getSession({ headers: await headers() })
  if (!session?.user) return Response.json({ error: 'Não autenticado' }, { status: 401 })
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  const month = new URL(request.url).searchParams.get('month') ?? today.slice(0, 7)
  if (!/^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/.test(month)) return Response.json({ error: 'Mês inválido.' }, { status: 400 })
  const { pool } = getDatabase()
  // Aggregate personal records directly: joining challenges would multiply the same workout.
  const totals = await pool.query(`SELECT count(DISTINCT "recordDate") FILTER (WHERE modality='strength')::int AS "strengthCheckIns", coalesce(sum(minutes) FILTER (WHERE modality='cardio'),0)::int AS "cardioMinutes", coalesce(sum(kilometers) FILTER (WHERE modality='cardio'),0)::float8 AS "cardioKilometers", count(DISTINCT "recordDate")::int AS "activeDays" FROM cardio_record WHERE "userId"=$1`, [session.user.id])
  const days = await pool.query(`SELECT "recordDate"::text AS date, count(*) FILTER (WHERE modality='strength')::int AS strength, count(*) FILTER (WHERE modality='cardio')::int AS cardio FROM cardio_record WHERE "userId"=$1 AND "recordDate">=$2::date AND "recordDate"<($2::date+interval '1 month') GROUP BY "recordDate" ORDER BY "recordDate"`, [session.user.id, `${month}-01`])
  return Response.json({ today, month, totals: totals.rows[0], days: days.rows }, { headers: { 'Cache-Control': 'private, no-store' } })
})
