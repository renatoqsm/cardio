'use client'

import { useEffect, useState } from 'react'
import { authClient } from '@/lib/auth-client'
import { parseRecordInput } from '@/lib/record-input'
import { Activity, CalendarDays, Copy, Flame, KeyRound, Plus, Ruler, Timer, Trophy, Upload, Users, X, Trash2 } from 'lucide-react'

type Challenge = { id: string; name: string; goalType: string; goalValue: string | null; startDate: string; endDate: string; joinCode: string; ownerId: string }
type FeedItem = { id: string; name: string; recordDate: string; minutes: number; kilometers: string; pace: string | null; activityType: string; proofPathname: string; description: string | null }
type Leader = { id: string; name: string; minutes: number; kilometers: number; pace: number }
const today = new Date().toISOString().slice(0, 10)

export default function Page() {
  const [session, setSession] = useState<any>(null)
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [selected, setSelected] = useState<Challenge | null>(null)
  const [leaderboard, setLeaderboard] = useState<Leader[]>([])
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')
  const [modal, setModal] = useState<'create' | 'join' | 'record' | null>(null)
  const [notice, setNotice] = useState('')

  const refresh = async (challengeId?: string) => {
    const response = await fetch(`/api/challenges${challengeId ? `?challengeId=${challengeId}` : ''}`)
    if (!response.ok) return
    const data = await response.json()
    setSession(data.user)
    setChallenges(data.challenges)
    const active = data.challenges.find((item: Challenge) => item.id === data.selectedChallengeId) ?? data.challenges[0] ?? null
    setSelected(active)
    setLeaderboard(data.leaderboard ?? [])
    setFeed(data.feed ?? [])
  }

  useEffect(() => { refresh() }, [])
  if (!session) return <AuthScreen mode={authMode} setMode={setAuthMode} onDone={() => refresh()} />

  const challenge = selected
  const afterAction = (message: string) => {
    setModal(null)
    setNotice(message)
    refresh(challenge?.id)
    window.setTimeout(() => setNotice(''), 3500)
  }
  const deleteChallenge = async () => {
    if (!challenge || !window.confirm(`Excluir “${challenge.name}”? Essa ação não pode ser desfeita.`)) return
    const response = await fetch(`/api/challenges?challengeId=${challenge.id}`, { method: 'DELETE' })
    if (response.ok) { setSelected(null); setNotice('Desafio excluído.'); refresh(); window.setTimeout(() => setNotice(''), 3500) }
  }

  return <main className="min-h-screen bg-[#f7f8f6] text-[#18231e]">
    <header className="border-b border-[#e3e8e3] bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5"><div className="flex items-center gap-2 font-bold tracking-tight"><span className="flex size-9 items-center justify-center rounded-xl bg-[#d9f96d]"><Flame className="size-5" /></span>pulso<span className="text-[#7ea615]">.</span></div><div className="flex items-center gap-3"><span className="hidden text-sm text-[#718077] sm:block">Olá, {session.name}</span><button className="rounded-lg border border-[#dfe6dc] px-3 py-2 text-xs font-bold" onClick={async () => { await authClient.signOut(); setSession(null) }}>Sair</button></div></div></header>
    <section className="mx-auto max-w-6xl px-5 py-10">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#91a097]">SEU ESPAÇO DE CARDIO</p><h1 className="mt-2 text-4xl font-bold tracking-[-.06em]">Desafie sua turma<span className="text-[#86a91a]">.</span></h1><p className="mt-2 text-sm text-[#7b877e]">Um registro diário. Todos os seus desafios atualizados.</p></div><div className="flex flex-wrap gap-2"><button onClick={() => setModal('join')} className="flex items-center gap-2 rounded-lg border border-[#dfe6dc] bg-white px-4 py-3 text-xs font-bold"><KeyRound className="size-4" />Entrar com chave</button><button onClick={() => setModal('create')} className="flex items-center gap-2 rounded-lg bg-[#24311e] px-4 py-3 text-xs font-bold text-white"><Plus className="size-4" />Criar desafio</button></div></div>
      {notice && <div className="mt-5 rounded-xl bg-[#e8f5c9] px-4 py-3 text-sm font-semibold text-[#526a17]">{notice}</div>}
      {challenges.length === 0 ? <EmptyState onCreate={() => setModal('create')} /> : <>
        <div className="mt-8 flex gap-2 overflow-x-auto pb-1">{challenges.map(item => <button key={item.id} onClick={() => refresh(item.id)} className={`shrink-0 rounded-xl border px-4 py-3 text-left ${challenge?.id === item.id ? 'border-[#b9d65d] bg-[#eff8d8]' : 'border-[#e3e8e3] bg-white'}`}><p className="text-sm font-bold">{item.name}</p><p className="mt-1 text-[11px] text-[#829087]">{goalLabel(item.goalType)} · {item.startDate} — {item.endDate}</p></button>)}</div>
        {challenge && <ChallengeView challenge={challenge} leaderboard={leaderboard} feed={feed} session={session} onRecord={() => setModal('record')} onDelete={deleteChallenge} />}
      </>}
    </section>
    {modal === 'create' && <ChallengeModal onClose={() => setModal(null)} onCreated={() => afterAction('Desafio criado. Compartilhe a chave com sua turma.')} />}
    {modal === 'join' && <JoinModal onClose={() => setModal(null)} onJoined={() => afterAction('Você entrou no desafio.')} />}
    {modal === 'record' && <RecordModal onClose={() => setModal(null)} onSaved={() => afterAction('Cardio registrado e contabilizado nos seus desafios.')} />}
  </main>
}

function ChallengeView({ challenge, leaderboard, feed, session, onRecord, onDelete }: { challenge: Challenge; leaderboard: Leader[]; feed: FeedItem[]; session: any; onRecord: () => void; onDelete: () => void }) {
  return <div className="mt-6 grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
    <section className="overflow-hidden rounded-2xl border border-[#dfe7dc] bg-white shadow-sm"><div className="flex items-start justify-between bg-[#24311e] p-6 text-white"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#d9f96d]">DESAFIO ATIVO</p><h2 className="mt-2 text-2xl font-bold">{challenge.name}</h2><p className="mt-2 text-xs text-[#c4d0bd]">{challenge.startDate} até {challenge.endDate} · objetivo por {goalLabel(challenge.goalType)}</p></div><div className="flex gap-2"><button onClick={() => navigator.clipboard?.writeText(challenge.joinCode)} aria-label="Copiar chave" className="rounded-lg bg-white/10 p-2"><Copy className="size-4" /></button>{challenge.ownerId === session.id && <button onClick={onDelete} aria-label="Excluir desafio" className="rounded-lg bg-white/10 p-2 text-[#ffb4a9]"><Trash2 className="size-4" /></button>}</div></div><div className="border-b border-[#edf0ec] p-5"><div className="flex items-center justify-between"><div><p className="text-xs text-[#91a097]">CHAVE PARA CONVIDAR</p><p className="mt-1 text-xl font-black tracking-[.2em]">{challenge.joinCode}</p></div><button onClick={onRecord} className="flex items-center gap-2 rounded-lg bg-[#d9f96d] px-4 py-3 text-xs font-bold text-[#24311e]"><Plus className="size-4" />Registrar cardio</button></div></div><div className="p-5"><div className="mb-4 flex items-center gap-2"><Trophy className="size-5 text-[#90b326]" /><h3 className="font-bold">Placar</h3></div><div className="flex flex-col gap-2">{leaderboard.map((person, index) => <div key={person.id} className={`flex items-center gap-3 rounded-xl px-3 py-3 ${index === 0 ? 'bg-[#f1f8df]' : 'bg-[#f8faf7]'}`}><span className="flex size-8 items-center justify-center rounded-full bg-[#dfe9d8] text-xs font-black">{index + 1}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{person.name}</p><p className="text-[11px] text-[#829087]">{person.minutes} min · {person.kilometers.toFixed(2)} km</p></div><strong className="text-sm">{challenge.goalType === 'time' ? `${person.minutes} min` : challenge.goalType === 'pace' ? (person.pace ? `${person.pace.toFixed(2)} pace` : '—') : `${person.kilometers.toFixed(2)} km`}</strong></div>)}{leaderboard.length === 0 && <p className="py-6 text-center text-sm text-[#91a097]">O placar aparece assim que a turma registrar um cardio.</p>}</div></div></section>
    <section className="rounded-2xl border border-[#dfe7dc] bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><div className="flex items-center gap-2"><Activity className="size-5 text-[#90b326]" /><h3 className="font-bold">Feed da turma</h3></div><p className="mt-1 text-xs text-[#829087]">As últimas publicações do desafio</p></div><Users className="size-5 text-[#b1beb3]" /></div><div className="mt-5 flex flex-col gap-3">{feed.map(item => <FeedCard key={item.id} item={item} />)}{feed.length === 0 && <div className="rounded-xl bg-[#f8faf7] p-8 text-center"><p className="text-sm font-bold">Seu feed está esperando o primeiro cardio.</p><p className="mt-1 text-xs text-[#829087]">Registre sua atividade e inspire a turma.</p></div>}</div></section>
  </div>
}

function goalLabel(type?: string) { return type === 'time' ? 'Tempo' : type === 'pace' ? 'Pace' : 'KM' }
function EmptyState({ onCreate }: any) { return <div className="mt-10 rounded-2xl border border-dashed border-[#cbd7c5] bg-white p-12 text-center"><Trophy className="mx-auto size-10 text-[#a8c85d]" /><h2 className="mt-4 text-lg font-bold">Nenhum desafio ainda</h2><p className="mt-2 text-sm text-[#7b877e]">Crie um desafio ou entre usando a chave de um amigo.</p><button onClick={onCreate} className="mt-5 rounded-lg bg-[#24311e] px-4 py-3 text-xs font-bold text-white">Criar meu desafio</button></div> }
function FeedCard({ item }: { item: FeedItem }) { return <article className="overflow-hidden rounded-xl border border-[#edf0ec] bg-[#fbfcfa]"><img src={item.proofPathname} alt={`Comprovante do cardio de ${item.name}`} className="aspect-[4/3] w-full object-cover" /><div className="p-3"><div className="flex items-center justify-between gap-2"><p className="text-sm font-bold">{item.name}</p><time className="text-[11px] text-[#91a097]">{item.recordDate}</time></div><p className="mt-2 text-xs font-semibold text-[#526158]">{item.minutes} min · {Number(item.kilometers).toFixed(2)} km{item.pace ? ` · pace ${item.pace}` : ''}</p>{item.description && <p className="mt-2 text-sm text-[#718077]">{item.description}</p>}</div></article> }
function AuthScreen({ mode, setMode, onDone }: any) { const [name, setName] = useState(''), [email, setEmail] = useState(''), [password, setPassword] = useState(''), [error, setError] = useState(''), [submitting, setSubmitting] = useState(false); const submit = async () => { if (submitting) return; setSubmitting(true); setError(''); try { const result = mode === 'login' ? await authClient.signIn.email({ email, password }) : await authClient.signUp.email({ email, password, name }); if (result.error) { const code = result.error.code; const message = result.error.status >= 500 ? 'O serviço está temporariamente indisponível. Tente novamente em instantes.' : code === 'USER_ALREADY_EXISTS' || code === 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL' ? 'Este email já está cadastrado. Entre na sua conta.' : code === 'PASSWORD_TOO_SHORT' ? 'A senha deve ter pelo menos 8 caracteres.' : code === 'INVALID_EMAIL' ? 'Informe um email válido.' : mode === 'signup' ? 'Não foi possível criar a conta. Confira o nome, o email e a senha.' : 'Email ou senha incorretos.'; setError(message); } else onDone() } catch { setError('Não foi possível conectar. Tente novamente em instantes.') } finally { setSubmitting(false) } }; return <main className="flex min-h-screen items-center justify-center bg-[#f7f8f6] px-5"><div className="w-full max-w-md rounded-2xl border border-[#e3e8e3] bg-white p-8 shadow-sm"><div className="flex items-center gap-2 font-bold"><span className="flex size-9 items-center justify-center rounded-xl bg-[#d9f96d]"><Flame className="size-5" /></span>pulso.</div><h1 className="mt-10 text-3xl font-bold tracking-[-.05em]">{mode === 'login' ? 'Entre no seu ritmo.' : 'Crie sua conta.'}</h1><p className="mt-2 text-sm text-[#7b877e]">Seu espaço para desafios de cardio com amigos.</p><div className="mt-7 flex flex-col gap-3">{mode === 'signup' && <input className="h-12 rounded-lg border border-[#dfe6dc] px-3 text-sm" placeholder="Seu nome" value={name} onChange={e => setName(e.target.value)} />}<input className="h-12 rounded-lg border border-[#dfe6dc] px-3 text-sm" placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} /><input className="h-12 rounded-lg border border-[#dfe6dc] px-3 text-sm" placeholder="Senha" type="password" value={password} onChange={e => setPassword(e.target.value)} /><button disabled={submitting} onClick={submit} className="mt-2 h-12 rounded-lg bg-[#24311e] text-sm font-bold text-white">{submitting ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar conta'}</button>{error && <p className="text-sm text-red-600">{error}</p>}</div><button onClick={() => { setError(''); setMode(mode === 'login' ? 'signup' : 'login') }} className="mt-6 text-sm font-semibold text-[#6f8d19]">{mode === 'login' ? 'Ainda não tenho conta' : 'Já tenho uma conta'}</button></div></main> }
function Shell({ title, children, onClose }: any) { return <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#152016]/30 p-4 backdrop-blur-sm"><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><div className="mb-5 flex items-center justify-between"><h2 className="text-lg font-bold">{title}</h2><button onClick={onClose} className="text-xl text-[#89938c]" aria-label="Fechar"><X className="size-5" /></button></div>{children}</div></div> }
function ChallengeModal({ onClose, onCreated }: any) { const [form, setForm] = useState({ name: '', goalType: 'km', goalValue: '', startDate: today, endDate: today }); const submit = async () => { const r = await fetch('/api/challenges', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create', ...form }) }); if (r.ok) onCreated() }; return <Shell title="Criar desafio" onClose={onClose}><div className="flex flex-col gap-3"><input className="h-11 rounded-lg border px-3 text-sm" placeholder="Nome do desafio" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /><div className="grid grid-cols-2 gap-3"><select className="h-11 rounded-lg border px-3 text-sm" value={form.goalType} onChange={e => setForm({ ...form, goalType: e.target.value })}><option value="km">Por KM</option><option value="time">Por tempo</option><option value="pace">Por pace</option></select><input className="h-11 rounded-lg border px-3 text-sm" placeholder="Meta (opcional)" value={form.goalValue} onChange={e => setForm({ ...form, goalValue: e.target.value })} /></div><div className="grid grid-cols-2 gap-3"><input type="date" className="h-11 rounded-lg border px-3 text-sm" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} /><input type="date" className="h-11 rounded-lg border px-3 text-sm" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} /></div><button onClick={submit} className="mt-2 h-11 rounded-lg bg-[#24311e] text-sm font-bold text-white">Criar e gerar chave</button></div></Shell> }
function JoinModal({ onClose, onJoined }: any) { const [code, setCode] = useState(''); const submit = async () => { const r = await fetch('/api/challenges', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'join', joinCode: code }) }); if (r.ok) onJoined() }; return <Shell title="Entrar com chave" onClose={onClose}><p className="mb-4 text-sm text-[#7b877e]">Cole a chave compartilhada pelo criador do desafio.</p><input autoFocus className="h-12 w-full rounded-lg border px-3 text-center text-lg font-bold uppercase tracking-[.2em]" placeholder="ABC123" value={code} onChange={e => setCode(e.target.value)} /><button onClick={submit} className="mt-4 h-11 w-full rounded-lg bg-[#24311e] text-sm font-bold text-white">Entrar no desafio</button></Shell> }
function RecordModal({ onClose, onSaved }: any) {
  const [file, setFile] = useState<File | null>(null)
  const [minutes, setMinutes] = useState(''), [km, setKm] = useState('')
  const [pace, setPace] = useState(''), [description, setDescription] = useState('')
  const [preview, setPreview] = useState(''), [stage, setStage] = useState(''), [error, setError] = useState('')
  const [proof, setProof] = useState<{ file: File; pathname: string } | null>(null)
  const submitting = stage !== ''
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
        body: JSON.stringify({ action: 'record', recordDate: today, ...values, description, proofPathname: pathname }),
      })
      if (!response.ok) {
        const result = await response.json().catch(() => null)
        throw new Error(responseError(response.status, result?.error || 'Não foi possível publicar o treino. Tente novamente.'))
      }
      onSaved()
    } catch (submissionError) {
      setError(controller.signal.aborted ? 'O envio demorou demais. Confira sua conexão e tente novamente.'
        : submissionError instanceof TypeError ? 'Não foi possível conectar. Confira sua conexão e tente novamente.'
        : submissionError instanceof Error ? submissionError.message : 'Não foi possível publicar o treino.')
    } finally { window.clearTimeout(timeout); setStage('') }
  }
  return <Shell title="Registrar cardio de hoje" onClose={onClose}>
    <p className="mb-4 text-sm text-[#7b877e]">Este registro será contabilizado automaticamente em todos os seus desafios ativos.</p>
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
      <input aria-label="Pace" disabled={submitting} className="h-11 rounded-lg border px-3 text-sm" placeholder="Pace (opcional): 6:30 ou 6,5" value={pace} onChange={event => setPace(event.target.value)} />
      <textarea aria-label="Descrição" disabled={submitting} className="min-h-20 rounded-lg border px-3 py-2 text-sm" placeholder="Descrição (opcional)" value={description} onChange={event => setDescription(event.target.value)} />
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button disabled={submitting} type="submit" className="h-11 rounded-lg bg-[#24311e] text-sm font-bold text-white disabled:cursor-wait disabled:opacity-60">{stage || 'Publicar no feed'}</button>
    </form>
  </Shell>
}

void CalendarDays; void Ruler; void Timer
