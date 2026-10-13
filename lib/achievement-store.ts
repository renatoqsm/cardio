import { getDatabase } from './db'
import { evaluateAchievements, type AchievementTotals } from './achievements'
import { brazilToday } from './week'

export async function achievementsForUsers(ids: string[]) {
  if (!ids.length) return new Map<string, ReturnType<typeof evaluateAchievements>>()
  const { rows } = await getDatabase().pool.query<AchievementTotals & { userId: string }>(`
    SELECT "userId",
      count(DISTINCT "recordDate") FILTER (WHERE modality='strength')::int AS "strengthCheckIns",
      count(DISTINCT date_trunc('week',"recordDate"::timestamp)) FILTER (WHERE modality='strength')::int AS "strengthWeeks",
      count(*) FILTER (WHERE modality='cardio')::int AS "cardioSessions",
      coalesce(sum(kilometers) FILTER (WHERE modality='cardio'),0)::float8 AS "cardioKilometers",
      coalesce(sum(minutes) FILTER (WHERE modality='cardio'),0)::int AS "cardioMinutes"
    FROM cardio_record WHERE "userId"=ANY($1::text[]) AND "recordDate"<=$2::date GROUP BY "userId"
  `, [ids, brazilToday()])
  const zero = { strengthCheckIns: 0, strengthWeeks: 0, cardioSessions: 0, cardioKilometers: 0, cardioMinutes: 0 }
  return new Map(ids.map(id => [id, evaluateAchievements(rows.find(row => row.userId === id) ?? zero)]))
}
