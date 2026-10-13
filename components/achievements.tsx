'use client'
import { useState } from 'react'
import { Award, Dumbbell, Flame, LockKeyhole, ShieldCheck } from 'lucide-react'
import { achievementLevels, type Achievement, type AchievementData, type Medal } from '@/lib/achievements'

const roman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII']
export function MedalMark({ medal, small = false }: { medal: Medal; small?: boolean }) {
  const Icon = medal.modality === 'strength' ? Dumbbell : Flame
  const label = `${medal.modality === 'strength' ? 'Musculação' : 'Cardio'}: ${achievementLevels[medal.level - 1]} · ${medal.title} · ${medal.threshold} ${medal.unit}`
  return <span className={`medal-mark medal-level-${medal.level} ${small ? 'medal-small' : ''}`} title={label} aria-label={label}><Icon size={small ? 12 : 27} /><span>{roman[medal.level - 1]}</span></span>
}
export function NameMedals({ medals }: { medals?: Medal[] }) {
  return medals?.length ? <span className="name-medals" aria-label="Maiores conquistas">{medals.slice(0, 2).map(medal => <MedalMark key={medal.id} medal={medal} small />)}</span> : null
}

export function AchievementGallery({ data }: { data: AchievementData }) {
  const [mode, setMode] = useState<'strength' | 'cardio'>('strength'), [expanded, setExpanded] = useState(false)
  const all = data.achievements.filter(a => a.modality === mode)
  const tracks = [...new Set(all.map(a => a.track))]
  const highlights = tracks.flatMap(track => {
    const entries = all.filter(a => a.track === track), earned = entries.filter(a => a.earned)
    const highest = earned.at(-1), next = entries.find(a => !a.earned)
    return highest ? next ? [highest, next] : [highest] : next ? [next] : []
  })
  const card = (a: Achievement) => <article key={a.id} className={`achievement-card ${a.earned ? 'is-earned' : 'is-locked'}`}>
    <MedalMark medal={a} /><div><small>{achievementLevels[a.level - 1]} · {a.modality === 'strength' ? 'Musculação' : 'Cardio'}</small><h4>{a.title}</h4><p>{a.threshold.toLocaleString('pt-BR')} {a.unit}</p></div>
    {a.earned ? <span className="certification-stamp"><ShieldCheck size={14} />Certificado Pulso</span> : <><progress aria-label={`Progresso em ${a.title}, nível ${a.level}`} max={a.threshold} value={Math.min(a.current, a.threshold)} /><small className="achievement-progress"><LockKeyhole size={12} />{a.current.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}/{a.threshold} {a.unit}</small></>}
  </article>
  return <section className="achievement-gallery" aria-label="Suas conquistas"><div className="profile-section-title"><Award size={22} /><div><h3>Suas certificações</h3><p>{data.earnedCount} de {data.totalCount} conquistas desbloqueadas</p></div></div>
    <p className="hint">A maior medalha de cada modalidade acompanha seu nome. Seus registros até hoje certificam sua evolução; exclusões atualizam as conquistas.</p>
    <div className="achievement-filters">{(['strength', 'cardio'] as const).map(m => <button key={m} type="button" aria-pressed={mode === m} onClick={() => { setMode(m); setExpanded(false) }}>{m === 'strength' ? <Dumbbell size={16} /> : <Flame size={16} />}{m === 'strength' ? 'Musculação' : 'Cardio'}</button>)}</div>
    <div className="achievement-grid">{(expanded ? all : highlights).map(card)}</div>
    <button type="button" className="text-button" onClick={() => setExpanded(v => !v)}>{expanded ? 'Mostrar destaques e próximos passos' : `Explorar todos os ${all.length} níveis de ${mode === 'strength' ? 'musculação' : 'cardio'}`}</button>
  </section>
}
