export const gestures = [
  { id: 'victory', emoji: '✌️', title: 'Dois dedos em V', instruction: 'Faça um V com os dedos indicador e médio e mostre a mão na foto.' },
  { id: 'thumbs-up', emoji: '👍', title: 'Polegar para cima', instruction: 'Faça um sinal de positivo com a mão e mostre o polegar na foto.' },
  { id: 'three-fingers', emoji: '3️⃣', title: 'Três dedos', instruction: 'Levante três dedos da mão e deixe os três bem visíveis na foto.' },
] as const
export type DailyGesture = { captureDay: string } & (typeof gestures)[number]
export function currentGesture(now = new Date()): DailyGesture {
  const captureDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
  const day = Math.floor(Date.parse(`${captureDay}T00:00:00Z`) / 86400000)
  return { captureDay, ...gestures[day % gestures.length] }
}
