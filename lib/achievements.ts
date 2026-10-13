import type { Modality } from './hub-types'

export const achievementLevels = ['Primeiro passo', 'Bronze', 'Prata', 'Ouro', 'Platina', 'Diamante', 'Elite', 'Lenda'] as const
export type AchievementMetric = 'strengthCheckIns' | 'strengthWeeks' | 'cardioSessions' | 'cardioKilometers' | 'cardioMinutes'
export type AchievementTotals = Record<AchievementMetric, number>
export type Achievement = { id: string; modality: Modality; track: AchievementMetric; title: string; level: number; threshold: number; unit: string; current: number; earned: boolean }
export type Medal = Pick<Achievement, 'id' | 'modality' | 'title' | 'level' | 'threshold' | 'unit'>
export type AchievementData = { achievements: Achievement[]; medals: Medal[]; earnedCount: number; totalCount: number }

const tracks: { key: AchievementMetric; modality: Modality; title: string; unit: string; thresholds: number[] }[] = [
  { key: 'strengthCheckIns', modality: 'strength', title: 'Força em movimento', unit: 'check-ins', thresholds: [1, 10, 30, 60, 100, 200, 365, 500] },
  { key: 'strengthWeeks', modality: 'strength', title: 'Constância de ferro', unit: 'semanas ativas', thresholds: [1, 4, 8, 12, 24, 36, 52, 104] },
  { key: 'cardioKilometers', modality: 'cardio', title: 'Horizontes', unit: 'km', thresholds: [1, 10, 25, 50, 100, 250, 500, 1000] },
  { key: 'cardioMinutes', modality: 'cardio', title: 'Fôlego de sobra', unit: 'min', thresholds: [30, 120, 300, 600, 1500, 3000, 6000, 12000] },
  { key: 'cardioSessions', modality: 'cardio', title: 'Sempre em movimento', unit: 'treinos', thresholds: [1, 10, 25, 50, 100, 200, 365, 500] },
]

// Certifications follow valid personal records, including those outside challenges.
// Track order is a stable tie-breaker. Only the highest level per modality is worn.
export function evaluateAchievements(totals: AchievementTotals): AchievementData {
  const achievements = tracks.flatMap(track => track.thresholds.map((threshold, index) => ({
    id: `${track.key}-${threshold}`, modality: track.modality, track: track.key,
    title: track.title, level: index + 1, threshold, unit: track.unit,
    current: Math.max(0, Number(totals[track.key]) || 0), earned: totals[track.key] + 1e-8 >= threshold,
  })))
  const medals = (['strength', 'cardio'] as const).flatMap(modality => {
    const best = achievements.filter(a => a.earned && a.modality === modality).sort((a, b) => b.level - a.level)[0]
    if (!best) return []
    const { id, title, level, threshold, unit } = best
    return [{ id, modality, title, level, threshold, unit }]
  })
  return { achievements, medals, earnedCount: achievements.filter(a => a.earned).length, totalCount: achievements.length }
}
