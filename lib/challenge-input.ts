export function parseChallengeInput(body: Record<string, unknown>) {
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name || name.length > 100) throw new Error('Dê um nome ao desafio, com até 100 caracteres.')
  const description = typeof body.description === 'string' ? body.description.trim() : ''
  if (description.length > 1500) throw new Error('A descrição deve ter até 1.500 caracteres.')
  if (!['km', 'time', 'pace'].includes(String(body.goalType))) throw new Error('Escolha um objetivo válido.')
  const date = (value: unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
  if (!date(body.startDate) || !date(body.endDate) || String(body.endDate) < String(body.startDate)) throw new Error('Confira as datas: o fim deve ser igual ou posterior ao início.')
  const goal = body.goalValue === '' || body.goalValue == null ? null : Number(String(body.goalValue).replace(',', '.'))
  if (goal !== null && (!Number.isFinite(goal) || goal <= 0)) throw new Error('A meta deve ser maior que zero, ou ficar vazia.')
  return { name, description: description || null, goalType: String(body.goalType), goalValue: goal === null ? null : String(goal), startDate: String(body.startDate), endDate: String(body.endDate) }
}
