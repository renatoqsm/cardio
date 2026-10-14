'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { UserRound, Download, Menu, Home, History, ArrowDown, ArrowRight, CalendarDays, Check, ChevronRight, Copy, Crown, Dumbbell, Flame, Image as ImageIcon, LogOut, Plus, Search, Settings2, Timer, Trash2, Trophy, Users, Zap } from 'lucide-react'
import { HomeDashboard, ChallengeCards, todayInBrazil } from '@/components/home-dashboard'
import { bindNotificationAccount, detachNotificationDevice } from '@/lib/push-client'
import { NameMedals } from '@/components/achievements'
import type { Medal } from '@/lib/achievements'
import { PersonalHistory } from '@/components/personal-history'
import { PersonalGoals } from '@/components/personal-goals'
import { RecordSocial } from '@/components/record-social'
import { ChallengeInvite } from '@/components/challenge-invite'
import { ChallengeResults } from '@/components/challenge-results'
import { challengeResult } from '@/lib/challenge-result'
import { DeleteRecord } from '@/components/delete-record'
import { ShareCheckIn } from '@/components/share-checkin'
import { ProfileEditor } from '@/components/profile-editor'
import { PremiumPanel } from '@/components/premium-panel'
import { ThemeToggle } from '@/components/theme-toggle'
import { authClient } from '@/lib/auth-client'
import { gestures } from '@/lib/gestures'
import { localDate, message } from '@/lib/client'
import type { Challenge, FeedItem, Member } from '@/lib/hub-types'
import { Avatar, Brand, Dialog } from '@/components/ui'
import { AuthScreen } from '@/components/auth-screen'
import { RecordModal } from '@/components/record-modal'
import { ChallengeEditor, JoinDialog } from '@/components/challenge-editor'

type Tab = 'feed' | 'ranking' | 'members'
const number = (value: number, digits = 1) => value.toLocaleString('pt-BR', { maximumFractionDigits: digits })
const date = (value: string, full = false) => new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: full ? 'long' : 'short' })
const pace = (value: number | null) => { if (!value) return '—'; const seconds = Math.round(value * 60); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` }
const metricLabel = (goal: string) => goal === 'checkins' ? 'check-ins' : goal === 'time' ? 'min' : goal === 'pace' ? 'min/km' : 'km'
const score = (person: Member, goal: string) => goal === 'checkins' ? number(person.checkIns ?? person.activeDays, 0) : goal === 'time' ? number(person.minutes, 0) : goal === 'pace' ? pace(person.pace) : number(person.kilometers, 2)
function status(challenge: Challenge) { const today = localDate(); return today < challenge.startDate ? 'Em breve' : today > challenge.endDate ? 'Encerrado' : 'Em andamento' }
function ChallengePicture({ challenge, small = false }: { challenge: Challenge; small?: boolean }) { return <span className={`challenge-picture ${small ? 'challenge-picture-small' : ''}`}>{challenge.profilePathname ? <img src={challenge.profilePathname} alt={`Foto de ${challenge.name}`} /> : challenge.modality === 'strength' ? <Dumbbell size={small ? 23 : 34} strokeWidth={1.8} /> : <Flame size={small ? 23 : 34} strokeWidth={1.8} />}</span> }

export default function Page() {
  const [view, setView] = useState<'home' | 'current' | 'completed' | 'challenge' | 'history' | 'goals'>('home'), [menuOpen, setMenuOpen] = useState(false)
  const [joinCode,setJoinCode] = useState('')
  const [premiumEnabled,setPremiumEnabled] = useState(false)
  const [session, setSession] = useState<{ id: string; name: string; image?: string | null; medals?: Medal[] } | null>(null)
  const [challenges, setChallenges] = useState<Challenge[]>([]), [selected, setSelected] = useState<Challenge | null>(null)
  const [members, setMembers] = useState<Member[]>([]), [feed, setFeed] = useState<FeedItem[]>([])
  const [tab, setTab] = useState<Tab>('feed'), [modal, setModal] = useState<'create' | 'edit' | 'join' | 'record' | 'profile' | null>(null)
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')
  const [loading, setLoading] = useState(true), [refreshing, setRefreshing] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('')
  const [challengeAction, setChallengeAction] = useState<{ challenge: Challenge; kind: 'delete' | 'leave' } | null>(null)
  const [actionBusy, setActionBusy] = useState(false), [actionError, setActionError] = useState('')
  const [targetRecord,setTargetRecord] = useState<string|null>(null)
  const [photo, setPhoto] = useState<FeedItem | null>(null)
  const selectedId = useRef<string | undefined>(undefined), requestNumber = useRef(0)
  const refresh = useCallback(async (challengeId?: string) => {
    const current = ++requestNumber.current
    const target = challengeId ?? selectedId.current
    setRefreshing(true)
    try {
      const response = await fetch(`/api/challenges${target ? `?challengeId=${encodeURIComponent(target)}` : ''}`, { cache: 'no-store', signal: AbortSignal.timeout(20000) })
      if (current !== requestNumber.current) return
      if (response.status === 401) { setSession(null); return }
      if (!response.ok) throw new Error('Não foi possível atualizar o desafio. Tente novamente.')
      const data = await response.json()
      if (current !== requestNumber.current) return
      const active = data.challenges.find((item: Challenge) => item.id === data.selectedChallengeId) ?? null
      setPremiumEnabled(data.billingEnabled === true); setSession(data.user); setChallenges(data.challenges); setSelected(active); selectedId.current = active?.id
      setMembers(data.members ?? data.leaderboard ?? []); setFeed(data.feed); setError('')
    } catch (error) { if (current === requestNumber.current) setError(message(error)) }
    finally { if (current === requestNumber.current) { setLoading(false); setRefreshing(false) } }
  }, [])
  useEffect(() => {
    const query=new URLSearchParams(window.location.search)
    setTargetRecord(query.get('recordId'))
    setJoinCode(query.get('join')?.toUpperCase() ?? '')
    if(query.get('signup')==='1')setAuthMode('signup')
    const target=query.get('challengeId')||undefined
    if(query.get('checkout')) setNotice('Retorno do checkout recebido. Confira o pagamento no desafio; a liberação depende da confirmação do Asaas.')
    if (target) setView('challenge')
    void refresh(target)
  }, [refresh])
  useEffect(() => { if(!session||!('serviceWorker' in navigator))return;const sync=()=>void bindNotificationAccount(session.id).catch(()=>{});sync();void navigator.serviceWorker.ready.then(sync);navigator.serviceWorker.addEventListener('controllerchange',sync);return()=>navigator.serviceWorker.removeEventListener('controllerchange',sync) },[session?.id])
  useEffect(() => { if (session && joinCode) setModal('join') }, [session?.id, joinCode])
  const clearInvite = () => { setJoinCode(''); const url=new URL(window.location.href);url.searchParams.delete('join');window.history.replaceState(null,'',url) }
  useEffect(()=>{if(!targetRecord||refreshing||tab!=='feed'||view!=='challenge')return;const el=document.getElementById(`record-${targetRecord}`);if(el){el.scrollIntoView({block:'center',behavior:'smooth'});el.classList.add('notification-highlight');setTargetRecord(null)}},[targetRecord,refreshing,feed,tab,view])
  useEffect(() => { if (!notice) return; const timeout = window.setTimeout(() => setNotice(''), 5000); return () => window.clearTimeout(timeout) }, [notice])
  const afterAction = (text: string, id?: string) => { if (id) setView('challenge'); setModal(null); setNotice(text); void refresh(id) }
  const manageChallenge = async () => {
    if (!challengeAction || actionBusy) return
    const { challenge: target, kind } = challengeAction
    setActionBusy(true); setActionError('')
    try {
      const response = await fetch(kind === 'delete' ? `/api/challenges?challengeId=${encodeURIComponent(target.id)}` : '/api/challenges', {
        method: kind === 'delete' ? 'DELETE' : 'POST', signal: AbortSignal.timeout(20000),
        ...(kind === 'leave' ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'leave', challengeId: target.id }) } : {}),
      })
      if (!response.ok) { const result = await response.json().catch(() => null); throw new Error(result?.error || 'Não foi possível concluir. Tente novamente.') }
      selectedId.current = undefined; setView('current'); setTab('feed'); setChallengeAction(null)
      afterAction(kind === 'delete' ? 'Desafio excluído. Seus treinos pessoais foram preservados.' : 'Você saiu do desafio. Seus treinos continuam salvos nos outros desafios elegíveis.')
    } catch (error) { setActionError(message(error)) }
    finally { setActionBusy(false) }
  }
  if (loading) return <main className="loading-screen"><Brand /><span className="loading-dot" /><p>Preparando seu espaço…</p></main>
  if (!session) return <>{error && <div className="connection-banner" role="alert">{error} <button onClick={() => void refresh()}>Tentar novamente</button></div>}<AuthScreen mode={authMode} setMode={setAuthMode} onDone={() => refresh()} /></>
  return <div className="hub app-shell">
    <aside className="sidebar app-sidebar">
      <Brand />
      <nav aria-label="Navegação principal" className="app-nav">
        <button aria-current={view === 'home' ? 'page' : undefined} onClick={() => setView('home')}><Home size={21} />Início</button>
        <button aria-current={view === 'current' ? 'page' : undefined} onClick={() => setView('current')}><Trophy size={21} />Desafios atuais</button>
        <button onClick={() => setModal('create')}><Plus size={21} />Criar desafio</button>
        <button aria-current={view === 'completed' ? 'page' : undefined} onClick={() => setView('completed')}><History size={21} />Desafios concluídos</button>
        <button onClick={() => setModal('join')}><Users size={21} />Entrar com chave</button>
        <button aria-current={view === 'history' ? 'page' : undefined} onClick={() => setView('history')}><History size={21} />Meus registros</button><button aria-current={view === 'goals' ? 'page' : undefined} onClick={() => setView('goals')}><Check size={21} />Minhas metas</button><button onClick={() => setModal('profile')}><UserRound size={21} />Meu perfil</button>
      </nav>
      <div className="sidebar-heading"><span>SUA TURMA</span></div>
      <nav className="challenge-nav" aria-label="Seus desafios">{challenges.filter(c => c.endDate >= todayInBrazil()).map(item => <button key={item.id} aria-current={view === 'challenge' && selected?.id === item.id ? 'page' : undefined} className={`challenge-nav-item ${view === 'challenge' && selected?.id === item.id ? 'selected' : ''}`} onClick={() => { setView('challenge'); setTab('feed'); void refresh(item.id) }}><ChallengePicture challenge={item} small /><span><strong>{item.name}</strong><small>{item.modality === 'strength' ? 'Musculação' : 'Cardio'}</small></span><ChevronRight size={15} /></button>)}</nav>
      <div className="app-sidebar-bottom"><button className="button secondary app-install-action" onClick={() => window.dispatchEvent(new Event('pulso-install-request'))}><Download size={18} />Instalar aplicativo</button><ThemeToggle /><div className="sidebar-user"><Avatar name={session.name} image={session.image} /><span><strong>{session.name}<NameMedals medals={session.medals}/></strong><small>Seu ritmo. Sua turma.</small></span><button className="icon-button" aria-label="Sair" onClick={async () => { await detachNotificationDevice(); await authClient.signOut(); setSession(null); setView('home') }}><LogOut size={17} /></button></div></div>
    </aside>
    <main className="hub-main">
      <header className="hub-topbar app-topbar"><div className="app-topbar-title"><button className="icon-button app-menu-button" aria-label="Abrir menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}><Menu size={24} /></button><Brand /></div><span className="app-header-label">{view === 'home' ? 'Seu movimento' : view === 'completed' ? 'Sua história' : 'Sua turma'}</span><button className="app-home-button icon-button" aria-label="Voltar ao início" onClick={() => setView('home')}><Avatar name={session.name} image={session.image} size="small" /></button></header>
      <div className="hub-content">
        {notice && <div className="notice" role="status"><Check size={18} />{notice}</div>}
        {error && <div className="error-banner" role="alert">{error}<button onClick={() => void refresh()}>Tentar novamente</button></div>}
        {view === 'home' ? <HomeDashboard user={session} challenges={challenges} revision={requestNumber.current} onSelect={id => { setView('challenge'); setTab('feed'); void refresh(id) }} onCreate={() => setModal('create')} onGoals={() => setView('goals')} /> : view === 'history' ? <PersonalHistory revision={requestNumber.current} onDeleted={() => afterAction('Registro excluído dos desafios e do resumo geral.')} onRecord={() => setModal('record')} /> : view === 'goals' ? <PersonalGoals revision={requestNumber.current} onSaved={() => void refresh()} /> : view === 'current' || view === 'completed' ? <section className="app-challenge-directory"><p className="eyebrow">{view === 'completed' ? 'CADA DESAFIO DEIXA UMA HISTÓRIA' : 'UM OBJETIVO. UMA TURMA.'}</p><h1>{view === 'completed' ? 'Desafios concluídos' : 'Desafios atuais'}</h1><p>{view === 'completed' ? 'Reviva os treinos, as conquistas e o ranking da turma.' : 'Escolha sua turma e continue de onde parou.'}</p><ChallengeCards completed={view === 'completed'} challenges={challenges.filter(c => view === 'completed' ? c.endDate < todayInBrazil() : c.endDate >= todayInBrazil())} onSelect={id => { setView('challenge'); setTab('feed'); void refresh(id) }} onCreate={() => setModal('create')} /></section> : selected ? <>
          <ChallengeHero challenge={selected} members={members} sessionId={session.id} onEdit={() => setModal('edit')} onMembers={() => setTab('members')} onCopy={() => setNotice('Chave copiada. Compartilhe com sua turma!')} onError={setError} />
          {selected.endDate < todayInBrazil() && <ChallengeResults challenge={selected} members={members} onRanking={() => setTab('ranking')} />}
          <PremiumPanel key={selected.id} challenge={selected} isOwner={selected.ownerId === session.id} onRefresh={() => void refresh(selected.id)} />
          <div className="challenge-management"><span>{selected.ownerId === session.id ? 'Você administra este desafio.' : 'Você participa deste desafio.'}</span><button onClick={() => { setActionError(''); setChallengeAction({ challenge: selected, kind: selected.ownerId === session.id ? 'delete' : 'leave' }) }}>{selected.ownerId === session.id ? <Trash2 size={16} /> : <LogOut size={16} />}{selected.ownerId === session.id ? 'Excluir desafio' : 'Sair do desafio'}</button></div>
          <div className="challenge-tabs" role="tablist" aria-label="Conteúdo do desafio">{([['feed', 'Feed', Flame], ['ranking', 'Ranking', Trophy], ['members', 'Membros', Users]] as const).map(([key, label, Icon]) => <button key={key} id={`tab-${key}`} role="tab" aria-controls={`panel-${key}`} aria-selected={tab === key} onClick={() => setTab(key)}><Icon size={17} />{label}{key === 'members' && <span className="tab-count">{members.length}</span>}</button>)}<span className="tab-status" aria-live="polite">{refreshing ? 'Atualizando…' : `${feed.length} ${selected.modality === 'strength' ? 'check-ins' : feed.length === 1 ? 'treino registrado' : 'treinos registrados'}`}</span></div>
          <section id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`}>
            {tab === 'feed' && <Feed challenge={selected} members={members} feed={feed} session={session} onRecord={() => setModal('record')} onPhoto={setPhoto} onRanking={() => setTab('ranking')} onDeleted={() => afterAction('Registro excluído dos desafios e do resumo geral.')} />}
            {tab === 'ranking' && <Ranking challenge={selected} members={members} sessionId={session.id} />}
            {tab === 'members' && <Members members={members} sessionId={session.id} challenge={selected} />}
          </section>

        </> : <div className="welcome"><span className="welcome-icon"><Flame size={42} /></span><p className="eyebrow">COMECE UM MOVIMENTO</p><h1>Seu próximo desafio<br />é melhor em turma.</h1><p>Crie um objetivo, convide seus amigos e transforme cada treino em uma conquista compartilhada.</p><div><button className="button primary" onClick={() => setModal('create')}><Plus size={18} />Criar meu desafio</button><button className="button secondary" onClick={() => setModal('join')}>Tenho uma chave<ArrowRight size={17} /></button></div></div>}
      </div>
    </main>
    <button className="app-add-record" aria-label="Adicionar registro" onClick={() => setModal('record')}><Plus size={30} /><span>Registrar treino</span></button>
    {menuOpen && <Dialog title="Seu espaço" onClose={() => setMenuOpen(false)}><nav className="app-nav app-drawer-nav" aria-label="Menu lateral">{([['home','Início',Home],['current','Desafios atuais',Trophy],['completed','Desafios concluídos',History],['history','Meus registros',History],['goals','Minhas metas',Check]] as const).map(([target,label,Icon]) => <button key={target} aria-current={view === target ? 'page' : undefined} onClick={() => { setView(target); setMenuOpen(false) }}><Icon size={22} />{label}</button>)}<button onClick={() => { setMenuOpen(false); setModal('create') }}><Plus size={22} />Criar desafio</button><button onClick={() => { setMenuOpen(false); setModal('join') }}><Users size={22} />Entrar com chave</button><button onClick={() => { setMenuOpen(false); setModal('profile') }}><UserRound size={22} />Meu perfil</button><button className="app-install-action" onClick={() => { setMenuOpen(false); window.dispatchEvent(new Event('pulso-install-request')) }}><Download size={22} />Instalar aplicativo</button><ThemeToggle /><button onClick={async () => { await detachNotificationDevice(); await authClient.signOut(); setMenuOpen(false); setSession(null); setView('home') }}><LogOut size={22} />Sair da conta</button></nav></Dialog>}
    {modal === 'profile' && <ProfileEditor onClose={() => setModal(null)} onSaved={profile => { setSession({ id: profile.id, name: profile.name, image: profile.image }); afterAction('Perfil atualizado.'); }} />}
    {(modal === 'create' || (modal === 'edit' && selected)) && <ChallengeEditor premiumEnabled={premiumEnabled} challenge={modal === 'edit' ? selected! : undefined} onClose={() => setModal(null)} onSaved={id => afterAction(modal === 'edit' ? 'Desafio atualizado. A cara da turma ficou ainda melhor.' : 'Desafio criado. Agora é só convidar a turma!', id)} />}
    {modal === 'join' && <JoinDialog initialCode={joinCode} onClose={() => { setModal(null);clearInvite() }} onJoined={id => { clearInvite();afterAction('Você está na turma. Vamos nessa!', id) }} />}
    {modal === 'record' && <RecordModal challenges={challenges} onClose={() => setModal(null)} onSaved={result => afterAction(result.replaced ? 'Treino de musculação substituído. Continua contando um único check-in nesse dia nos desafios elegíveis.' : result.alreadyPublished ? result.record.modality === 'strength' ? 'Seu check-in de musculação nessa data já estava salvo. Ele conta uma única vez em cada desafio elegível.' : 'Esse cardio já estava salvo. Ele não foi contado duas vezes.' : result.countedChallengeIds.length > 0 ? `Registro salvo e contabilizado em ${result.countedChallengeIds.length} ${result.countedChallengeIds.length === 1 ? 'desafio' : 'desafios'} de ${result.record.modality === 'strength' ? 'musculação' : 'cardio'}.` : 'Registro salvo. Você não tem desafios desta modalidade no período da data informada.')} />}

    {challengeAction && <Dialog title={challengeAction.kind === 'delete' ? 'Excluir desafio?' : 'Sair do desafio?'} onClose={() => { if (!actionBusy) setChallengeAction(null) }}><p className="editor-intro">{challengeAction.kind === 'delete' ? <>O desafio <strong>{challengeAction.challenge.name}</strong> será excluído para todos os membros. Esta ação não pode ser desfeita.</> : <>Você deixará de participar de <strong>{challengeAction.challenge.name}</strong> e sairá do ranking deste desafio. Poderá entrar novamente com a chave.</>}</p><p className="muted editor-intro">Seus treinos e fotos pessoais continuam salvos e contando nos outros desafios elegíveis.</p>{premiumEnabled && challengeAction.kind === 'delete' && <p>A renovação do Premium deste desafio será cancelada antes da exclusão.</p>}{actionError && <p className="error" role="alert">{actionError}</p>}<div className="replacement-actions"><button className="button secondary" disabled={actionBusy} onClick={() => setChallengeAction(null)}>Cancelar</button><button className="button danger" disabled={actionBusy} onClick={() => void manageChallenge()}>{actionBusy ? 'Aguarde…' : challengeAction.kind === 'delete' ? 'Sim, excluir desafio' : 'Sim, sair do desafio'}</button></div></Dialog>}
    {photo && <Dialog title={`Treino de ${photo.name}`} onClose={() => setPhoto(null)} wide><img className="full-proof" src={photo.proofPathname} alt={`Comprovante do treino de ${photo.name}`} /><p className="photo-caption">{date(photo.recordDate, true)} · {photo.modality === 'strength' ? 'Check-in de musculação' : `${photo.minutes} min · ${number(Number(photo.kilometers), 2)} km`}</p></Dialog>}
  </div>
}

function ChallengeHero({ challenge, members, sessionId, onEdit, onMembers, onCopy, onError }: { challenge: Challenge; members: Member[]; sessionId: string; onEdit: () => void; onMembers: () => void; onCopy: () => void; onError: (text: string) => void }) {
  const workouts = members.reduce((sum, member) => sum + member.workouts, 0)
  const active = members.filter(member => member.workouts > 0).length
  return <section className="challenge-hero"><div className={`challenge-cover ${challenge.coverPathname ? 'has-image' : ''}`}>{challenge.coverPathname && <img src={challenge.coverPathname} alt={`Capa de ${challenge.name}`} />}<div className="cover-shade" /><span className="challenge-status"><span />{status(challenge)}</span>{challenge.ownerId === sessionId && <button className="cover-edit" onClick={onEdit}><Settings2 size={16} />Personalizar</button>}<div className="cover-wordmark" aria-hidden="true">MOVE<br />TOGETHER.</div></div>
    <div className="hero-details"><div className="hero-title-row"><ChallengePicture challenge={challenge} /><div className="hero-title"><p className="eyebrow">UM OBJETIVO. UMA TURMA.</p><h1>{challenge.name}</h1></div></div><p className="hero-description">{challenge.description || 'Cada treino conta. Junte-se à turma e encontre seu próximo ritmo.'}</p><div className="hero-meta"><span><CalendarDays size={15} />{date(challenge.startDate)} — {date(challenge.endDate)}</span><span><Trophy size={15} />{challenge.modality === 'strength' ? 'Musculação · Mais check-ins' : challenge.goalType === 'time' ? 'Cardio · Mais minutos' : challenge.goalType === 'pace' ? 'Cardio · Menor pace médio' : 'Cardio · Mais quilômetros'}</span><button className="hero-members" onClick={onMembers}><span className="avatar-stack">{members.slice(0, 3).map(member => <Avatar key={member.id} name={member.name} image={member.image} size="small" />)}</span>{members.length} {members.length === 1 ? 'membro' : 'membros'}</button><ChallengeInvite code={challenge.joinCode} name={challenge.name} /><button className="invite-copy" onClick={async () => { try { await navigator.clipboard.writeText(challenge.joinCode); onCopy() } catch { onError(`Não foi possível copiar. Sua chave é ${challenge.joinCode}.`) } }}><Copy size={14} /><span>{challenge.joinCode}</span></button></div></div>
    <div className="hero-stats"><div><strong>{number(workouts, 0)}</strong><span>{challenge.modality === 'strength' ? 'check-ins da turma' : 'treinos da turma'}</span></div><div><strong>{challenge.modality === 'strength' ? Math.round((Date.parse(challenge.endDate) - Date.parse(challenge.startDate)) / 86400000) + 1 : number(members.reduce((sum, member) => sum + member.kilometers, 0), 2)}<small> {challenge.modality === 'strength' ? 'dias' : 'km'}</small></strong><span>{challenge.modality === 'strength' ? 'duração do desafio' : 'percorridos juntos'}</span></div><div><strong>{active}<small> / {members.length}</small></strong><span>membros em movimento</span></div></div>
  </section>
}

function Feed({ challenge, members, feed, session, onRecord, onPhoto, onRanking, onDeleted }: { challenge: Challenge; members: Member[]; feed: FeedItem[]; session: { id: string; name: string; image?: string | null; medals?: Medal[] }; onRecord: () => void; onPhoto: (item: FeedItem) => void; onRanking: () => void; onDeleted: () => void }) {
  const [filter, setFilter] = useState<'all' | 'mine'>('all')
  const visible = filter === 'mine' ? feed.filter(item => item.userId === session.id) : feed
  const me = members.find(member => member.id === session.id)
  const goal = Number(challenge.goalValue)
  const myValue = me ? challenge.modality === 'strength' ? me.checkIns : challenge.goalType === 'time' ? me.minutes : challenge.goalType === 'pace' ? me.pace ?? 0 : me.kilometers : 0
  const progress = goal > 0 ? Math.min(100, Math.max(0, challenge.goalType === 'pace' ? myValue > 0 ? goal / myValue * 100 : 0 : myValue / goal * 100)) : 0
  return <div className="feed-layout"><div className="feed-main"><button className="feed-composer" onClick={onRecord}><Avatar name={session.name} image={session.image} /><span><strong>Adicionar registro</strong><small>Cardio ou musculação. Um registro, todos os desafios elegíveis.</small></span><span className="composer-plus"><Plus size={22} /></span></button><div className="feed-heading"><h2>O movimento da turma</h2><div className="feed-filters"><button aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>Todos</button><button aria-pressed={filter === 'mine'} onClick={() => setFilter('mine')}>Meus treinos</button></div></div>
    {visible.map(item => <article className="feed-card" id={`record-${item.id}`} key={item.id}><header><Avatar name={item.name} image={item.image} /><div><strong>{item.name}<NameMedals medals={item.medals}/>{item.userId === session.id && <small className="you-label">você</small>}</strong><span>{date(item.recordDate, true)} · {item.activityType}</span></div><span className="workout-tag">{item.modality === 'strength' ? <Dumbbell size={12} /> : <Flame size={12} />}{item.modality === 'strength' ? 'Check-in feito' : 'Cardio feito'}</span></header>{item.gestureId && <p className="feed-gesture"><span>{gestures.find(gesture => gesture.id === item.gestureId)?.emoji}</span>Gesto da foto: {gestures.find(gesture => gesture.id === item.gestureId)?.title} · {item.captureDay ? date(item.captureDay) : ''}</p>}{item.description && <p className="feed-description">{item.description}</p>}<button className="feed-photo" onClick={() => onPhoto(item)} aria-label={`Ver foto do treino de ${item.name}`}><img src={item.proofPathname} alt={`Comprovante do cardio de ${item.name}`} loading="lazy" /><span><ImageIcon size={15} />Ver foto</span></button><div className="feed-metrics">{item.modality === 'strength' ? <><div><span>CHECK-IN</span><strong>+1<small> dia</small></strong></div><div><span>MODALIDADE</span><strong className="strength-metric">Musculação</strong></div></> : <><div><span>DISTÂNCIA</span><strong>{number(Number(item.kilometers), 2)}<small> km</small></strong></div><div><span>TEMPO</span><strong>{item.minutes}<small> min</small></strong></div><div><span>PACE</span><strong>{pace(item.pace ? Number(item.pace) : Number(item.kilometers) > 0 ? item.minutes / Number(item.kilometers) : null)}<small> min/km</small></strong></div></>}</div>{item.userId === session.id && <div className="record-card-actions"><ShareCheckIn item={item} /><DeleteRecord recordId={item.id} onDeleted={onDeleted} /></div>}<RecordSocial recordId={item.id} challengeId={challenge.id} /></article>)}
    {visible.length === 0 && <div className="panel-empty"><Flame size={32} /><h3>{filter === 'mine' ? 'Seu próximo treino vai aparecer aqui.' : 'O primeiro passo é seu.'}</h3><p>Adicione um registro e dê o primeiro incentivo à turma.</p><button className="button primary" onClick={onRecord}><Plus size={16} />Adicionar registro</button></div>}
  </div><aside className="feed-aside"><section className="summary-card"><p className="eyebrow">SEU RITMO NO DESAFIO</p><div className="your-workouts"><strong>{me?.workouts ?? 0}</strong><span>{challenge.modality === 'strength' ? 'check-ins registrados' : me?.workouts === 1 ? 'treino registrado' : 'treinos registrados'}</span><Flame size={27} /></div><div className="personal-stats"><div><strong>{challenge.modality === 'strength' ? `${me?.checkIns ?? 0} check-ins` : `${number(me?.kilometers ?? 0, 2)} km`}</strong><span>{challenge.modality === 'strength' ? 'participação no período' : 'distância total'}</span></div><div><strong>{challenge.modality === 'strength' ? `${me?.activeDays ?? 0} dias` : `${me?.minutes ?? 0} min`}</strong><span>{challenge.modality === 'strength' ? 'dias em movimento' : 'tempo total'}</span></div></div>{goal > 0 && <div className="goal-progress"><div><span>Meta: {number(goal)} {metricLabel(challenge.goalType)}</span><strong>{Math.round(progress)}%</strong></div><progress max="100" value={progress} aria-label="Progresso na meta" /></div>}<p className="summary-footnote">{challenge.modality === 'strength' ? 'Um check-in por dia conta em todos os desafios de musculação no período.' : 'Todos os cardios no período contam nos desafios de cardio. Inclusive mais de um no mesmo dia.'}</p></section><section className="summary-card"><div className="section-heading"><h3>Quem está no ritmo</h3><Trophy size={19} /></div>{members.filter(member => member.workouts > 0 && (challenge.goalType !== 'pace' || member.pace != null)).slice(0, 3).map((member, index) => <div className="mini-rank" key={member.id}><span className="rank-number">{index + 1}</span><Avatar name={member.name} image={member.image} size="small" /><strong>{member.name}<NameMedals medals={member.medals}/></strong><span>{score(member, challenge.goalType)}<small> {metricLabel(challenge.goalType)}</small></span></div>)}{members.every(member => member.workouts === 0) && <p className="muted">A primeira conquista está logo ali.</p>}<button className="text-button" onClick={onRanking}>Ver ranking completo<ArrowRight size={15} /></button></section><section className="movement-note"><Zap size={24} /><h3>A constância<br />é contagiante.</h3><p>Seu treino pode ser o incentivo que alguém precisava hoje.</p></section></aside></div>
}

function Ranking({ challenge, members, sessionId }: { challenge: Challenge; members: Member[]; sessionId: string }) {
  const result = challengeResult(challenge,members), competing = result.leaderboard
  const podium = [competing[1], competing[0], competing[2]]
  const position = (member: Member) => 1 + competing.filter(other => challenge.goalType === 'pace' ? result.value(other) < result.value(member)-1e-9 : result.value(other) > result.value(member)+1e-9).length
  const winners = status(challenge) === 'Encerrado' ? result.winners : []
  return <div className="ranking-panel"><div className="panel-title"><div><p className="eyebrow">CADA TREINO SOMA</p><h2>O ritmo de quem se move.</h2><p>Ranking por {challenge.modality === 'strength' ? 'quantidade de check-ins diários' : challenge.goalType === 'time' ? 'tempo acumulado' : challenge.goalType === 'pace' ? 'pace médio ponderado pela distância' : 'distância acumulada'} no período do desafio.</p></div><span className="ranking-icon"><Trophy size={30} /></span></div>{winners.length > 0 && <div className="challenge-result" role="status"><Trophy size={20} /><span><strong>{winners.length === 1 ? 'Vencedor' : 'Empate na liderança'}: {winners.map(member => member.name).join(', ')}</strong><small>{score(winners[0],challenge.goalType)} {metricLabel(challenge.goalType)} no período encerrado</small></span></div>}{competing.length > 0 && <div className="podium">{podium.map((member, index) => member && <div key={member.id} className={`podium-person ${index === 1 ? 'podium-first' : ''}`}>{index === 1 && <Crown className="podium-crown" size={25} />}<Avatar name={member.name} image={member.image} size="large" /><span className="podium-place">{position(member)}</span><strong>{member.name}<NameMedals medals={member.medals}/></strong><span>{score(member, challenge.goalType)} <small>{metricLabel(challenge.goalType)}</small></span><small>{member.workouts} {member.workouts === 1 ? 'treino' : 'treinos'}</small></div>)}</div>}<div className="ranking-list"><div className="ranking-list-label"><span>MEMBRO</span><span>RESULTADO</span></div>{members.map(member => <div className={`ranking-row ${member.id === sessionId ? 'is-you' : ''}`} key={member.id}><span className="rank-number">{competing.findIndex(person => person.id === member.id) >= 0 ? position(member) : '—'}</span><Avatar name={member.name} image={member.image} /><div className="rank-person"><strong>{member.name}<NameMedals medals={member.medals}/>{member.id === sessionId && <small className="you-label">você</small>}</strong><span>{member.workouts ? `${member.workouts} ${challenge.modality === 'strength' ? 'check-ins' : 'treinos'} · ${member.activeDays} dias em movimento` : 'O próximo treino começa sua história'}</span></div><div className="rank-score"><strong>{score(member, challenge.goalType)}</strong><span>{metricLabel(challenge.goalType)}</span></div></div>)}</div><p className="ranking-note"><ArrowDown size={14} />{challenge.modality === 'strength' ? 'Um check-in por dia. Mais check-ins no período vencem; empates mantêm a mesma posição.' : 'No ranking de pace, menor é melhor. Quem ainda não tem distância registrada aparece sem posição.'}</p></div>
}

function Members({ members, sessionId, challenge }: { challenge: Challenge; members: Member[]; sessionId: string }) {
  const [search, setSearch] = useState('')
  const normalize = (value: string) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
  const visible = members.filter(member => normalize(member.name).includes(normalize(search)))
  return <div className="members-panel"><div className="members-heading"><div><p className="eyebrow">MELHOR EM TURMA</p><h2>Conheça quem se move com você.</h2><p>{members.length} {members.length === 1 ? 'pessoa, um começo.' : 'pessoas compartilhando o mesmo objetivo.'}</p></div><label className="member-search"><Search size={17} /><input aria-label="Buscar membro" placeholder="Buscar na turma" value={search} onChange={event => setSearch(event.target.value)} /></label></div><div className="member-grid">{visible.map(member => <article className="member-card" key={member.id}><div className="member-card-heading"><Avatar name={member.name} image={member.image} size="large" /><span className={`member-role ${member.isOwner ? 'admin' : ''}`}>{member.isOwner ? <><Crown size={12} />Administrador</> : 'Membro'}</span></div><h3>{member.name}<NameMedals medals={member.medals}/>{member.id === sessionId && <small className="you-label">você</small>}</h3><p className="member-since">Na turma desde {new Date(member.joinedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</p><div className="member-numbers"><div><strong>{member.workouts}</strong><span>{challenge.modality === 'strength' ? 'check-ins' : 'treinos'}</span></div>{challenge.modality === 'strength' ? <div><strong>{member.activeDays}</strong><span>dias ativos</span></div> : <><div><strong>{number(member.kilometers, 2)}</strong><span>km</span></div><div><strong>{member.minutes}</strong><span>min</span></div></>}</div><div className={`member-activity ${member.workouts ? 'active' : ''}`}><span />{member.lastTrainingDate ? `Último treino: ${date(member.lastTrainingDate)}` : 'Esperando o primeiro treino'}</div></article>)}</div>{visible.length === 0 && <p className="panel-empty">Nenhum membro encontrado com esse nome.</p>}</div>
}
