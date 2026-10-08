export function parseChallengeInput(body: Record<string, unknown>) {
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name || name.length > 100) throw new Error('Dê um nome ao desafio, com até 100 caracteres.')
  const description = typeof body.description === 'string' ? body.description.trim() : ''
  if (description.length > 1500) throw new Error('A descrição deve ter até 1.500 caracteres.')
  const modality = body.modality ?? 'cardio'
  if (modality !== 'cardio' && modality !== 'strength') throw new Error('Escolha Cardio ou Musculação.')
  const goalType = modality === 'strength' ? 'checkins' : String(body.goalType)
  if (modality === 'strength' && body.goalType != null && body.goalType !== 'checkins') throw new Error('Musculação usa somente quantidade de check-ins.')
  if (modality === 'cardio' && !['km', 'time', 'pace'].includes(goalType)) throw new Error('Escolha um objetivo válido.')
  const date = (value: unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
  if (!date(body.startDate) || !date(body.endDate) || String(body.endDate) < String(body.startDate)) throw new Error('Confira as datas: o fim deve ser igual ou posterior ao início.')
  const goal = body.goalValue === '' || body.goalValue == null ? null : Number(String(body.goalValue).replace(',', '.'))
  if (goal !== null && (!Number.isFinite(goal) || goal <= 0)) throw new Error('A meta deve ser maior que zero, ou ficar vazia.')
  if (modality === 'strength' && goal !== null && !Number.isInteger(goal)) throw new Error('A meta de check-ins deve ser um número inteiro.')
  return { modality, name, description: description || null, goalType, goalValue: goal === null ? null : String(goal), startDate: String(body.startDate), endDate: String(body.endDate) }
}
