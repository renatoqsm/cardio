'use client'
import { useEffect, useState } from 'react'
import { ArrowUpRight, ChevronLeft, ChevronRight, Dumbbell, Flame, Timer, Trophy } from 'lucide-react'
import { GoalOverview, type GoalData } from './personal-goals'
import { Avatar } from './ui'
import type { Challenge } from '@/lib/hub-types'
import { message } from '@/lib/client'
type Summary = { today: string; month: string; totals: { strengthCheckIns: number; cardioMinutes: number; cardioKilometers: number; activeDays: number }; days: { date: string; strength: number; cardio: number }[] }
const format = (value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
export function todayInBrazil() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()) }
export function ChallengeCards({ challenges, onSelect, onCreate, completed = false }: { challenges: Challenge[]; onSelect: (id: string) => void; onCreate: () => void; completed?: boolean }) {
  return <div className="app-challenge-cards">{challenges.map(c => <button className="app-challenge-card" key={c.id} onClick={() => onSelect(c.id)}>{c.coverPathname && <img className="app-card-cover" src={c.coverPathname} alt="" />}<span className="app-card-content"><span className="app-card-top">{c.profilePathname ? <img className="app-card-profile" src={c.profilePathname} alt="" /> : c.modality === 'strength' ? <Dumbbell size={24} /> : <Flame size={24} />}<span>{c.modality === 'strength' ? 'Musculação' : 'Cardio'}</span><ArrowUpRight size={18} /></span><strong>{c.name}</strong><span className="app-card-meta">{c.memberCount} {c.memberCount === 1 ? 'pessoa' : 'pessoas'} · {c.startDate > todayInBrazil() ? 'Começa' : completed ? 'Terminou' : 'Até'} {new Date(`${c.startDate > todayInBrazil() ? c.startDate : c.endDate}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span></span></button>)}{challenges.length === 0 && <div className="app-empty"><Trophy size={28} /><strong>{completed ? 'Sua história está começando.' : 'Sua próxima turma está aqui.'}</strong><p>{completed ? 'Os desafios encerrados ficam guardados nesta área.' : 'Crie um desafio ou entre com a chave de um amigo.'}</p>{!completed && <button className="button secondary" onClick={onCreate}>Criar desafio</button>}</div>}</div>
}
export function HomeDashboard({ user, challenges, revision, onSelect, onCreate, onGoals }: { user: { name: string; image?: string | null }; challenges: Challenge[]; revision: number; onSelect: (id: string) => void; onCreate: () => void; onGoals: () => void }) {
  const [goals,setGoals] = useState<GoalData|null>(null)
  useEffect(()=>{const controller=new AbortController();void fetch('/api/goals',{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(20000)])}).then(r=>r.ok?r.json():null).then(data=>{if(!controller.signal.aborted)setGoals(data)}).catch(()=>{});return()=>controller.abort()},[revision])
  const [month, setMonth] = useState(() => todayInBrazil().slice(0, 7)), [summary, setSummary] = useState<Summary | null>(null), [error, setError] = useState(''), [retry, setRetry] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setError(''); setSummary(null)
    void (async () => { try { const r = await fetch(`/api/summary?month=${month}`, { cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]) }); if (!r.ok) throw new Error('Não foi possível carregar seu resumo.'); const data = await r.json(); if (!controller.signal.aborted) setSummary(data) } catch (e) { if (!controller.signal.aborted) setError(message(e)) } })()
    return () => controller.abort()
  }, [month, revision, retry])
  const today = summary?.today ?? todayInBrazil(), active = challenges.filter(c => c.startDate <= today && c.endDate >= today)
  const first = new Date(`${month}-01T12:00:00`), count = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  const move = (amount: number) => { const d = new Date(first); d.setMonth(d.getMonth() + amount); setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`) }
  const totals = summary?.totals, minutes = totals?.cardioMinutes ?? 0
  const time = minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60 ? `${minutes % 60}min` : ''}` : `${minutes} min`
  return <div className="app-home">
    <section className="app-greeting"><div><p className="eyebrow">SEU RITMO, SUA EVOLUÇÃO</p><h1>Vamos nessa,<br /><span>{user.name.trim().split(/\s+/)[0]}.</span></h1><p>Cada dia em movimento deixa uma marca.</p></div><Avatar name={user.name} image={user.image} size="large" /></section>
    {error && <div className="error-banner" role="alert">{error}<button onClick={() => setRetry(v => v + 1)}>Tentar novamente</button></div>}
    <section className="app-stats" aria-label="Resumo geral de treinos" aria-busy={!summary && !error}>
      <div className="app-stat app-stat-featured"><Dumbbell size={22} /><strong>{totals ? format(totals.strengthCheckIns) : '—'}</strong><span>Check-ins de musculação</span><small>Seu histórico completo</small></div>
      <div className="app-stat"><Timer size={21} /><strong>{totals ? time : '—'}</strong><span>Tempo de cardio</span></div>
      <div className="app-stat"><Flame size={21} /><strong>{totals ? format(totals.cardioKilometers) : '—'}<small> km</small></strong><span>Distância de cardio</span></div>
      <div className="app-stat"><Trophy size={21} /><strong>{active.length}</strong><span>Desafios em andamento</span></div>
    </section>
    <GoalOverview data={goals} onOpen={onGoals} />
    <section className="app-calendar" aria-label="Calendário de assiduidade"><div className="app-section-heading"><div><p className="eyebrow">CONSISTÊNCIA CONTA</p><h2>Seu mês em movimento</h2></div><span>{summary ? summary.days.length : '—'} dias ativos</span></div><div className="app-calendar-heading"><button className="icon-button" aria-label="Mês anterior" onClick={() => move(-1)}><ChevronLeft size={22} /></button><h3>{first.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</h3><button className="icon-button" aria-label="Próximo mês" onClick={() => move(1)}><ChevronRight size={22} /></button></div><div className="app-calendar-grid">{['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => <span className="app-weekday" key={d}>{d}</span>)}{Array.from({ length: first.getDay() }, (_, i) => <span key={`empty-${i}`} />)}{Array.from({ length: count }, (_, i) => { const day = `${month}-${String(i + 1).padStart(2, '0')}`, activity = summary?.days.find(d => d.date === day); return <div key={day} className={`app-calendar-day ${activity ? 'has-activity' : ''} ${day === today ? 'is-today' : ''}`} aria-label={`${i + 1}: ${activity ? `${activity.strength} check-ins de musculação, ${activity.cardio} treinos de cardio` : 'sem treino registrado'}`} aria-current={day === today ? 'date' : undefined}><span>{i + 1}</span><span className="app-day-dots">{!!activity?.strength && <i className="strength" />}{!!activity?.cardio && <i className="cardio" />}</span></div> })}</div><div className="app-calendar-legend"><span><i className="strength" />Musculação</span><span><i className="cardio" />Cardio</span><button onClick={() => setMonth(today.slice(0, 7))}>Mês atual</button></div></section>
    <section><div className="app-section-heading"><div><p className="eyebrow">SUA TURMA TE MOVE</p><h2>Desafios em andamento</h2></div><span>{active.length}</span></div><ChallengeCards challenges={active} onSelect={onSelect} onCreate={onCreate} /></section>
  </div>
}
