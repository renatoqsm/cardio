'use client'
import { useEffect, useRef, useState } from 'react'
import { Camera, ImagePlus, X } from 'lucide-react'
import { Dialog } from './ui'
import { localDate, message, postJSON, uploadPhoto } from '@/lib/client'
import { parseChallengeInput } from '@/lib/challenge-input'
import type { Challenge } from '@/lib/hub-types'
function PhotoPicker({ label, current, file, cover, onChange }: { label: string; current: string; file: File | null; cover?: boolean; onChange: (file: File | null) => void }) {
  const [preview, setPreview] = useState(current)
  useEffect(() => { if (!file) { setPreview(current); return }; const url = URL.createObjectURL(file); setPreview(url); return () => URL.revokeObjectURL(url) }, [current, file])
  return <div className={`photo-picker ${cover ? 'photo-picker-cover' : ''}`}><label>{preview ? <img src={preview} alt={label} /> : cover ? <ImagePlus size={26} /> : <Camera size={26} />}<span>{label}</span><input aria-label={label} type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={event => onChange(event.target.files?.[0] ?? null)} /></label>{preview && <button type="button" className="photo-remove" aria-label={`Remover ${label.toLowerCase()}`} onClick={() => onChange(null)}><X size={14} /></button>}</div>
}
export function ChallengeEditor({ challenge, onClose, onSaved }: { challenge?: Challenge; onClose: () => void; onSaved: (id: string) => void }) {
  const end = new Date(); end.setDate(end.getDate() + 30)
  const [form, setForm] = useState({ modality: challenge?.modality ?? 'cardio', name: challenge?.name ?? '', description: challenge?.description ?? '', goalType: challenge?.goalType ?? 'km', goalValue: challenge?.goalValue ?? '', startDate: challenge?.startDate ?? localDate(), endDate: challenge?.endDate ?? localDate(end), profilePathname: challenge?.profilePathname ?? '', coverPathname: challenge?.coverPathname ?? '' })
  const [files, setFiles] = useState<{ profile: File | null; cover: File | null }>({ profile: null, cover: null })
  const cached = useRef<Partial<Record<'profile' | 'cover', { file: File; path: string }>>>({})
  const [stage, setStage] = useState(''), [error, setError] = useState('')
  const change = (key: keyof typeof form, value: string) => setForm(current => ({ ...current, [key]: value }))
  const pick = (slot: 'profile' | 'cover', file: File | null) => { setFiles(current => ({ ...current, [slot]: file })); if (!file) change(slot === 'profile' ? 'profilePathname' : 'coverPathname', ''); setError('') }
  const submit = async () => {
    if (stage) return
    setError('')
    try {
      parseChallengeInput(form)
      for (const file of Object.values(files)) if (file && file.size > 8 * 1024 * 1024) throw new Error('Cada foto deve ter até 8 MB.')
      const media = { profilePathname: form.profilePathname, coverPathname: form.coverPathname }
      for (const slot of ['cover', 'profile'] as const) {
        const file = files[slot]; if (!file) continue
        setStage(slot === 'cover' ? 'Enviando capa...' : 'Enviando foto...')
        let path = cached.current[slot]?.file === file ? cached.current[slot]?.path : undefined
        if (!path) { path = await uploadPhoto(file); cached.current[slot] = { file, path } }
        media[slot === 'profile' ? 'profilePathname' : 'coverPathname'] = path
      }
      setStage('Salvando desafio...')
      const result = await postJSON('/api/challenges', { action: challenge ? 'update' : 'create', challengeId: challenge?.id, ...form, ...media })
      onSaved(result.challenge.id)
    } catch (error) { setError(message(error)) } finally { setStage('') }
  }
  return <Dialog title={challenge ? 'Editar desafio' : 'Um novo desafio começa aqui'} onClose={onClose} wide>
    <p className="muted editor-intro">Dê uma identidade à turma e um motivo para se movimentar.</p>
    <form className="editor-form" onSubmit={event => { event.preventDefault(); void submit() }} aria-busy={!!stage}>
      <fieldset disabled={!!stage} className="editor-fields">
        <div className="editor-photos"><PhotoPicker label="Foto do desafio" current={form.profilePathname} file={files.profile} onChange={file => pick('profile', file)} /><PhotoPicker label="Imagem de fundo" cover current={form.coverPathname} file={files.cover} onChange={file => pick('cover', file)} /></div>
        <p className="hint">Fotos opcionais · PNG, JPEG, GIF ou WebP · até 8 MB cada</p>
        <label className="field">Modalidade<select aria-label="Modalidade do desafio" value={form.modality} disabled={!!challenge} onChange={event => setForm(current => ({ ...current, modality: event.target.value as 'cardio' | 'strength', goalType: event.target.value === 'strength' ? 'checkins' : 'km', goalValue: '' }))}><option value="cardio">Cardio</option><option value="strength">Musculação</option></select></label>
        {challenge && <p className="hint">A modalidade é definida na criação do desafio.</p>}
        <label className="field">Nome do desafio<input autoFocus maxLength={100} value={form.name} placeholder="Ex.: Cardio antes do café" onChange={event => change('name', event.target.value)} /></label>
        <label className="field" htmlFor="challenge-description">Descrição<textarea id="challenge-description" aria-label="Descrição" maxLength={1500} rows={3} value={form.description} placeholder="O que move a turma? Conte o objetivo, as regras e incentive seus amigos." onChange={event => change('description', event.target.value)} /></label>
        {form.modality === 'strength' ? <p className="period-warning">Ranking por quantidade de check-ins diários. No máximo um por pessoa por dia; quem somar mais no período vence. Empates mantêm a mesma posição.</p> : <div className="field-pair"><label className="field">Como ordenar o ranking<select value={form.goalType} onChange={event => change('goalType', event.target.value)}><option value="km">Mais quilômetros</option><option value="time">Mais minutos</option><option value="pace">Menor pace médio</option></select></label><label className="field">Meta por pessoa (opcional)<input inputMode="decimal" value={form.goalValue} placeholder={form.goalType === 'km' ? 'Ex.: 100 km' : form.goalType === 'time' ? 'Ex.: 600 min' : 'Ex.: 6,5 min/km'} onChange={event => change('goalValue', event.target.value)} /></label></div>}
        <div className="field-pair"><label className="field">Começa em<input type="date" value={form.startDate} onChange={event => change('startDate', event.target.value)} /></label><label className="field">Termina em<input type="date" min={form.startDate} value={form.endDate} onChange={event => change('endDate', event.target.value)} /></label></div>
      </fieldset>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="button primary full" type="submit" disabled={!!stage}>{stage || (challenge ? 'Salvar alterações' : 'Criar desafio')}</button>
    </form>
  </Dialog>
}
export function JoinDialog({ onClose, onJoined }: { onClose: () => void; onJoined: (id: string) => void }) {
  const [code, setCode] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('')
  return <Dialog title="Sua turma está te esperando" onClose={onClose}><p className="muted editor-intro">Digite a chave que um amigo compartilhou com você.</p><form className="editor-form" onSubmit={async event => { event.preventDefault(); if (busy) return; setBusy(true); setError(''); try { const result = await postJSON('/api/challenges', { action: 'join', joinCode: code }); onJoined(result.challenge.id) } catch (error) { setError(message(error)) } finally { setBusy(false) } }}><label className="field">Chave do desafio<input autoFocus className="invite-input" placeholder="CHAVE" value={code} onChange={event => setCode(event.target.value.toUpperCase())} /></label>{error && <p role="alert" className="error">{error}</p>}<button className="button primary full" disabled={busy || !code.trim()}>{busy ? 'Entrando...' : 'Entrar no desafio'}</button></form></Dialog>
}
