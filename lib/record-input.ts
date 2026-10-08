export function parseRecordInput(input: { minutes: unknown; kilometers: unknown; pace?: unknown }) {
  const decimal = (value: unknown) => {
    if (typeof value !== 'string' && typeof value !== 'number') return NaN
    const text = String(value).trim().replace(',', '.')
    return /^\d+(?:\.\d+)?$/.test(text) ? Number(text) : NaN
  }
  const minutes = decimal(input.minutes)
  if (!Number.isSafeInteger(minutes) || minutes <= 0 || minutes > 2147483647) {
    throw new Error('Informe o tempo em minutos inteiros, maior que zero.')
  }
  const kilometers = decimal(input.kilometers)
  if (!Number.isFinite(kilometers) || kilometers < 0) {
    throw new Error('Informe uma distância em KM válida (zero ou maior).')
  }
  let pace: number | null = null
  if (input.pace !== undefined && input.pace !== null && String(input.pace).trim() !== '') {
    const text = String(input.pace).trim()
    const clock = /^(\d+):([0-5]\d)$/.exec(text)
    pace = clock ? Number(clock[1]) + Number(clock[2]) / 60 : decimal(input.pace)
    if (!Number.isFinite(pace) || pace <= 0) {
      throw new Error('Informe o pace como 6:30 ou 6,5 min/km, ou deixe vazio.')
    }
  }
  return { minutes, kilometers: String(kilometers), pace: pace === null ? null : String(pace) }
}
