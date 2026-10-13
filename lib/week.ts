export function brazilToday() { return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()) }
export function weekStart(day: string) { const date=new Date(`${day}T12:00:00Z`);date.setUTCDate(date.getUTCDate()-(date.getUTCDay()+6)%7);return date.toISOString().slice(0,10) }
export function addDays(day: string, days: number) { const date=new Date(`${day}T12:00:00Z`);date.setUTCDate(date.getUTCDate()+days);return date.toISOString().slice(0,10) }
export function activeWeekStreak(activeWeeks: string[], today: string) {
  const weeks=new Set(activeWeeks), current=weekStart(today);let day=weeks.has(current)?current:addDays(current,-7),count=0
  while(weeks.has(day)){count++;day=addDays(day,-7)}return count
}
