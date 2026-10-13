import type {Challenge,Member} from './hub-types'
export function challengeResult(challenge:Challenge,members:Member[]){
 const competing=members.filter(m=>m.workouts>0&&(challenge.goalType!=='pace'||m.pace!==null))
 const value=(m:Member)=>challenge.modality==='strength'?m.checkIns:challenge.goalType==='time'?m.minutes:challenge.goalType==='pace'?m.pace!:m.kilometers
 const sorted=[...competing].sort((a,b)=>challenge.goalType==='pace'?value(a)-value(b):value(b)-value(a))
 const best=sorted[0]?value(sorted[0]):null
 return {winners:best===null?[]:sorted.filter(m=>Math.abs(value(m)-best)<1e-9),leaderboard:sorted,totalWorkouts:members.reduce((s,m)=>s+m.workouts,0),totalMinutes:members.reduce((s,m)=>s+m.minutes,0),totalKilometers:members.reduce((s,m)=>s+m.kilometers,0),activeMembers:members.filter(m=>m.workouts>0).length,value}
}
