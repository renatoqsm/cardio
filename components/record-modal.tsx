'use client'
import { useEffect, useState } from 'react'
import { Upload } from 'lucide-react'
import { parseRecordInput } from '@/lib/record-input'
import { localDate } from '@/lib/client'
import { Dialog } from './ui'
import type { Challenge, RecordPublication } from '@/lib/hub-types'

export function RecordModal({ challenge, onClose, onSaved }: { challenge: Challenge | null; onClose: () => void; onSaved: (result: RecordPublication) => void }) {
  const [submissionKey] = useState(() => crypto.randomUUID())
  const [recordDate, setRecordDate] = useState(() => localDate())
  const [activityType, setActivityType] = useState('Cardio')
  const [file, setFile] = useState<File | null>(null)
  const [minutes, setMinutes] = useState(''), [km, setKm] = useState('')
  const [pace, setPace] = useState(''), [description, setDescription] = useState('')
  const [preview, setPreview] = useState(''), [stage, setStage] = useState(''), [error, setError] = useState('')
  const [proof, setProof] = useState<{ file: File; pathname: string } | null>(null)
  const submitting = stage !== ''
  const outsidePeriod = challenge && recordDate && (recordDate < challenge.startDate || recordDate > challenge.endDate)
  const displayDate = (value: string) => value.split('-').reverse().join('/')
  useEffect(() => {
    if (!file) { setPreview(''); return }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])
  const submit = async () => {
    if (submitting) return
    setError('')
    let values
    try {
      if (!file) throw new Error('Tire uma foto do seu cardio para continuar.')
      if (file.size > 8 * 1024 * 1024) throw new Error('A foto deve ter até 8 MB. Escolha uma imagem menor.')
      values = parseRecordInput({ minutes, kilometers: km, pace })
    } catch (validationError) { setError((validationError as Error).message); return }
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 60000)
    const responseError = (status: number, fallback: string) => status === 401
      ? 'Sua sessão expirou. Entre novamente para publicar.' : fallback
    try {
      let pathname = proof?.file === file ? proof.pathname : undefined
      if (!pathname) {
        setStage('Enviando foto...')
        const form = new FormData(); form.append('file', file!)
        const upload = await fetch('/api/upload', { method: 'POST', body: form, signal: controller.signal })
        const uploaded = await upload.json().catch(() => null)
        if (!upload.ok || typeof uploaded?.pathname !== 'string') {
          throw new Error(responseError(upload.status, uploaded?.error || 'Não foi possível enviar a foto. Tente novamente.'))
        }
        pathname = uploaded.pathname
        setProof({ file: file!, pathname: pathname! })
      }
      setStage('Publicando treino...')
      const response = await fetch('/api/challenges', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ action: 'record', recordDate, ...values, description, activityType, submissionKey, proofPathname: pathname }),
      })
      if (!response.ok) {
        const result = await response.json().catch(() => null)
        throw new Error(responseError(response.status, result?.error || 'Não foi possível publicar o treino. Tente novamente.'))
      }
      const result: RecordPublication = await response.json()
      onSaved(result)
    } catch (submissionError) {
      setError(controller.signal.aborted ? 'O envio demorou demais. Confira sua conexão e tente novamente.'
        : submissionError instanceof TypeError ? 'Não foi possível conectar. Confira sua conexão e tente novamente.'
        : submissionError instanceof Error ? submissionError.message : 'Não foi possível publicar o treino.')
    } finally { window.clearTimeout(timeout); setStage('') }
  }
  return <Dialog title="Registrar cardio" onClose={onClose}>
    <p className="mb-4 text-sm text-[#7b877e]">{challenge ? <>Para o ranking de <strong>{challenge.name}</strong>, a data do treino deve estar entre {displayDate(challenge.startDate)} e {displayDate(challenge.endDate)}, inclusive.</> : <>Mais um treino, mais um passo. Todos os registros no período somam nos seus desafios.</>}</p>
    <form onSubmit={event => { event.preventDefault(); void submit() }} className="flex flex-col gap-3" aria-busy={submitting}>
      <label className="block cursor-pointer overflow-hidden rounded-xl border border-dashed border-[#b9d65d] bg-[#f8fbeF] text-center text-sm font-bold text-[#6f8d19]">
        {preview ? <img src={preview} alt="Prévia do comprovante" className="aspect-[4/3] w-full object-cover" /> : <div className="p-6"><Upload className="mx-auto mb-2 size-6" /><span>Tirar foto do comprovante</span><span className="mt-1 block text-[11px] font-normal text-[#829087]">A câmera do celular será aberta</span></div>}
        <div className="border-t border-[#dfe8d6] px-3 py-2 text-xs">{file ? 'Toque para tirar outra foto' : 'Abrir câmera'}</div>
        <input aria-label="Foto do comprovante" disabled={submitting} type="file" accept="image/png,image/jpeg,image/gif,image/webp" capture="environment" className="hidden" onChange={event => { setFile(event.target.files?.[0] ?? null); setProof(null); setError('') }} />
      </label>
      <p className="text-xs text-[#7b877e]">Foto em PNG, JPEG, GIF ou WebP, até 8 MB.</p>
      <div className="grid grid-cols-2 gap-3">
        <input aria-label="Minutos" disabled={submitting} className="h-11 rounded-lg border px-3 text-sm" inputMode="numeric" placeholder="Minutos" value={minutes} onChange={event => setMinutes(event.target.value)} />
        <input aria-label="Quilômetros" disabled={submitting} className="h-11 rounded-lg border px-3 text-sm" inputMode="decimal" placeholder="KM" value={km} onChange={event => setKm(event.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="field">Data do treino<input aria-label="Data do treino" type="date" value={recordDate} disabled={submitting} onChange={event => setRecordDate(event.target.value)} /></label>
        <label className="field">Atividade<select aria-label="Atividade" value={activityType} disabled={submitting} onChange={event => setActivityType(event.target.value)}><option>Cardio</option><option>Corrida</option><option>Caminhada</option><option>Bicicleta</option><option>Elíptico</option><option>Natação</option></select></label>
      </div>
      {outsidePeriod && <p role="status" className="period-warning">A data escolhida fica fora do período de {challenge!.name}. O treino será salvo, mas não aparecerá no feed nem somará no ranking deste desafio. Confira a data antes de publicar.</p>}
      <input aria-label="Pace" disabled={submitting} className="h-11 rounded-lg border px-3 text-sm" placeholder="Pace (opcional): 6:30 ou 6,5" value={pace} onChange={event => setPace(event.target.value)} />
      <textarea aria-label="Descrição" disabled={submitting} className="min-h-20 rounded-lg border px-3 py-2 text-sm" placeholder="Descrição (opcional)" value={description} onChange={event => setDescription(event.target.value)} />
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button disabled={submitting} type="submit" className="button primary full">{stage || 'Publicar no feed'}</button>
    </form>
  </Dialog>
}

