'use client'
import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Dumbbell, Flame } from 'lucide-react'
import { parseRecordInput } from '@/lib/record-input'
import { localDate } from '@/lib/client'
import { Dialog } from './ui'
import { CameraProof, type CapturedPhoto } from './camera-proof'
import type { Challenge, ExistingStrengthRecord, Modality, RecordPublication } from '@/lib/hub-types'

export function RecordModal({ challenges, onClose, onSaved }: { challenges: Challenge[]; onClose: () => void; onSaved: (result: RecordPublication) => void }) {
  const [modality, setModality] = useState<Modality | null>(null)
  const [existing, setExisting] = useState<ExistingStrengthRecord | null>(null)
  const [replacement, setReplacement] = useState<ExistingStrengthRecord | null>(null)
  const [checking, setChecking] = useState(false)
  const [submissionKey] = useState(() => crypto.randomUUID())
  const [recordDate, setRecordDate] = useState(() => localDate())
  const [activityType, setActivityType] = useState('Cardio')
  const [photo, setPhoto] = useState<CapturedPhoto | null>(null), [cameraBusy, setCameraBusy] = useState(false)
  const file = photo?.file ?? null
  const [minutes, setMinutes] = useState(''), [km, setKm] = useState('')
  const [pace, setPace] = useState(''), [description, setDescription] = useState('')
  const [stage, setStage] = useState(''), [error, setError] = useState('')
  const [proof, setProof] = useState<{ file: File; pathname: string; captureToken: string } | null>(null)
  const submitting = stage !== ''
  const eligible = challenges.filter(challenge => challenge.modality === modality && recordDate >= challenge.startDate && recordDate <= challenge.endDate)
  const sameModality = challenges.filter(challenge => challenge.modality === modality)
  const displayDate = (value: string) => value.split('-').reverse().join('/')
  const acceptPhoto = useCallback((captured: CapturedPhoto | null) => { setPhoto(captured); setProof(null); setError('') }, [])
  useEffect(() => {
    setExisting(null); setReplacement(null)
    if (modality !== 'strength' || !recordDate) { setChecking(false); return }
    const controller = new AbortController()
    setChecking(true)
    void (async () => {
      try {
        const response = await fetch(`/api/records?recordDate=${encodeURIComponent(recordDate)}`, { cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) })
        if (!response.ok) throw new Error('Não foi possível verificar o check-in. A publicação fará uma nova verificação.')
        const result = await response.json()
        if (!controller.signal.aborted) setExisting(result.existingRecord)
      } catch (error) { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Não foi possível verificar o check-in.') }
      finally { if (!controller.signal.aborted) setChecking(false) }
    })()
    return () => controller.abort()
  }, [modality, recordDate])
  const submit = async () => {
    if (submitting || checking || cameraBusy) return
    setError('')
    let values
    try {
      if (!photo || !file) throw new Error('Tire uma foto do seu treino para continuar.')
      if (file.size > 8 * 1024 * 1024) throw new Error('A foto deve ter até 8 MB. Escolha uma imagem menor.')
      values = modality === 'strength' ? {} : parseRecordInput({ minutes, kilometers: km, pace })
    } catch (validationError) { setError((validationError as Error).message); return }
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 60000)
    const responseError = (status: number, fallback: string) => status === 401
      ? 'Sua sessão expirou. Entre novamente para publicar.' : fallback
    try {
      let pathname = proof?.file === file ? proof.pathname : undefined
      let captureToken = proof?.file === file ? proof.captureToken : undefined
      if (!pathname) {
        setStage('Enviando foto...')
        const form = new FormData(); form.append('file', file!); form.append('purpose', 'training'); form.append('captureDay', photo!.captureDay); form.append('gestureId', photo!.gestureId)
        const upload = await fetch('/api/upload', { method: 'POST', body: form, signal: controller.signal })
        const uploaded = await upload.json().catch(() => null)
        if (!upload.ok || typeof uploaded?.pathname !== 'string') {
          throw new Error(responseError(upload.status, uploaded?.error || 'Não foi possível enviar a foto. Tente novamente.'))
        }
        if (typeof uploaded.captureToken !== 'string') throw new Error('Atualize a página e tire uma nova foto pela câmera do site.')
        pathname = uploaded.pathname; captureToken = uploaded.captureToken
        setProof({ file: file!, pathname: pathname!, captureToken: captureToken! })
      }
      setStage('Publicando treino...')
      const response = await fetch('/api/challenges', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ action: 'record', modality, recordDate, ...values, description, activityType, submissionKey, captureToken, proofPathname: pathname, ...(replacement ? { replaceExisting: true, replaceRecordId: replacement.id, expectedSubmissionKey: replacement.submissionKey } : {}) }),
      })
      if (!response.ok) {
        const result = await response.json().catch(() => null)
        if (response.status === 409 && result?.code === 'STRENGTH_CHECKIN_EXISTS' && result.existingRecord) { setExisting(result.existingRecord); setReplacement(null); return }
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
  if (!modality) return <Dialog title="Adicionar registro" onClose={onClose}><p className="muted editor-intro">O que você treinou? Um registro conta em todos os seus desafios da mesma modalidade, dentro do período de cada um.</p><div className="modality-options"><button className="modality-option" onClick={() => setModality('cardio')}><Flame size={30} /><strong>Cardio</strong><span>Corrida, caminhada, bike e mais.<br />Vários registros por dia.</span></button><button className="modality-option" onClick={() => setModality('strength')}><Dumbbell size={30} /><strong>Musculação</strong><span>Um check-in por dia.<br />A constância soma no ranking.</span></button></div></Dialog>
  if (existing) return <Dialog title="Substituir treino de musculação?" onClose={onClose}><p className="editor-intro">Você já registrou um treino de musculação {recordDate === localDate() ? 'hoje' : `em ${displayDate(recordDate)}`}, deseja substituí-lo?</p><p className="muted editor-intro">A nova foto e descrição substituirão o treino anterior. O ranking continuará contando apenas um check-in nesse dia.</p><div className="replacement-actions"><button className="button secondary" onClick={onClose}>Manter treino anterior</button><button className="button primary" onClick={() => { setReplacement(existing); setExisting(null); setError('') }}>Sim, substituir</button></div></Dialog>
  return <Dialog title={modality === 'strength'  ? 'Check-in de musculação' : 'Registrar cardio'} onClose={onClose}>
    <button type="button" className="text-button" disabled={submitting} onClick={() => { setModality(null); setError('') }}><ArrowLeft size={15} />Trocar modalidade</button>
    <p className="mb-4 text-sm text-[#7b877e]">{modality === 'strength' ? 'Foto, data e uma descrição opcional. Você pode fazer um check-in de musculação por dia.' : 'Registre tempo, distância e sua foto. Você pode adicionar vários cardios por dia.'}</p>
    {replacement && <p className="period-warning" role="status">Você está substituindo o treino de musculação de {displayDate(recordDate)}. O anterior será mantido até salvar a nova foto e descrição.</p>}
    <form onSubmit={event => { event.preventDefault(); void submit() }} className="flex flex-col gap-3" aria-busy={submitting}>
      <CameraProof photo={photo} onCapture={acceptPhoto} disabled={submitting} onBusy={setCameraBusy} />
      <label className="field">Data do treino<input aria-label="Data do treino" type="date" value={recordDate} disabled={submitting} onChange={event => setRecordDate(event.target.value)} /></label>
      {modality === 'cardio' && <><div className="grid grid-cols-2 gap-3"><input aria-label="Minutos" disabled={submitting} className="h-11 rounded-lg border px-3 text-sm" inputMode="numeric" placeholder="Minutos" value={minutes} onChange={event => setMinutes(event.target.value)} /><input aria-label="Quilômetros" disabled={submitting} className="h-11 rounded-lg border px-3 text-sm" inputMode="decimal" placeholder="KM" value={km} onChange={event => setKm(event.target.value)} /></div><label className="field">Atividade<select aria-label="Atividade" value={activityType} disabled={submitting} onChange={event => setActivityType(event.target.value)}><option>Cardio</option><option>Corrida</option><option>Caminhada</option><option>Bicicleta</option><option>Elíptico</option><option>Natação</option></select></label><input aria-label="Pace" disabled={submitting} className="h-11 rounded-lg border px-3 text-sm" placeholder="Pace (opcional): 6:30 ou 6,5" value={pace} onChange={event => setPace(event.target.value)} /></>}
      <div className={eligible.length ? 'record-destinations' : 'period-warning'} role="status">{eligible.length ? <><strong>Conta em {eligible.length} {eligible.length === 1 ? 'desafio' : 'desafios'} de {modality === 'strength' ? 'musculação' : 'cardio'}</strong><span>{eligible.map(challenge => challenge.name).join(' · ')}</span></> : <><strong>Sem desafios elegíveis nesta data.</strong><span>O treino será salvo. {sameModality.length ? 'Confira os períodos abaixo; esta data fica fora deles.' : 'Você ainda não participa de desafios desta modalidade.'}</span></>}{sameModality.length > 0 && <details><summary>Ver períodos dos desafios</summary>{sameModality.map(challenge => <p key={challenge.id}>{challenge.name}: {displayDate(challenge.startDate)} a {displayDate(challenge.endDate)}</p>)}</details>}</div>
      <textarea aria-label="Descrição" disabled={submitting} className="min-h-20 rounded-lg border px-3 py-2 text-sm" placeholder="Descrição (opcional)" value={description} onChange={event => setDescription(event.target.value)} />
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button disabled={submitting || checking || cameraBusy} type="submit" className="button primary full">{stage || (checking ? 'Verificando check-in...' : replacement ? 'Substituir treino' : modality === 'strength' ? 'Fazer check-in' : 'Publicar no feed')}</button>
    </form>
  </Dialog>
}

