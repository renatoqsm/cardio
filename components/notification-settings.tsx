'use client'
import { useEffect, useState } from 'react'
import { Bell, BellOff } from 'lucide-react'
import { message, postJSON } from '@/lib/client'
import { bindNotificationAccount, isInstalled, notificationRegistration } from '@/lib/push-client'

type Config = { publicKey: string | null; configured: boolean; preferences: { cardio: boolean; strength: boolean } }
export function NotificationSettings({ userId }: { userId: string }) {
  const [config, setConfig] = useState<Config | null>(null), [supported, setSupported] = useState(false), [installed, setInstalled] = useState(false)
  const [active, setActive] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState(''), [retry, setRetry] = useState(0)
  useEffect(() => {
    let cancelled = false
    setInstalled(isInstalled())
    const available = window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
    setSupported(available)
    void (async () => {
      try {
        const response = await fetch('/api/notifications', { cache: 'no-store', signal: AbortSignal.timeout(15000) })
        if (!response.ok) throw new Error('Não foi possível carregar as notificações.')
        const data: Config = await response.json()
        if (!cancelled) setConfig(data)
        if (available) {
          const registration = await navigator.serviceWorker.getRegistration('/')
          const sub = await registration?.pushManager.getSubscription()
          // Reconcile the browser subscription with the signed-in account, without prompting.
          if (sub && Notification.permission === 'granted' && data.configured && isInstalled()) {
            await postJSON('/api/notifications', { action: 'subscribe', subscription: sub.toJSON() })
            await bindNotificationAccount(userId)
            if (!cancelled) setActive(true)
          }
        }
      } catch (e) { if (!cancelled) setError(message(e)) }
    })()
    return () => { cancelled = true }
  }, [userId, retry])
  const enable = async () => {
    if (!config?.publicKey || busy) return
    setBusy(true); setError(''); setNotice('')
    try {
      // Permission is requested only from this explicit button click.
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') throw new Error(permission === 'denied' ? 'Os avisos estão bloqueados. Libere as notificações nas configurações deste aplicativo ou navegador e tente novamente.' : 'Você pode ativar os avisos quando quiser.')
      const registration = await notificationRegistration()
      let sub = await registration.pushManager.getSubscription()
      if (!sub) {
        const raw = atob(config.publicKey.replace(/-/g, '+').replace(/_/g, '/'))
        sub = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: Uint8Array.from(raw, char => char.charCodeAt(0)) })
      }
      await postJSON('/api/notifications', { action: 'subscribe', subscription: sub.toJSON() })
      await bindNotificationAccount(userId); setActive(true); setNotice('Avisos ativados neste dispositivo.')
    } catch (e) { setError(message(e)) } finally { setBusy(false) }
  }
  const disable = async () => {
    setBusy(true); setError(''); setNotice('')
    try {
      const registration = await notificationRegistration(), sub = await registration.pushManager.getSubscription()
      if (sub) { await postJSON('/api/notifications', { action: 'unsubscribe', endpoint: sub.endpoint }); await sub.unsubscribe() }
      setActive(false); setNotice('Avisos desativados neste dispositivo.')
    } catch (e) { setError(message(e)) } finally { setBusy(false) }
  }
  const preference = async (key: 'cardio' | 'strength', value: boolean) => {
    if (!config || busy) return
    const previous = config, preferences = { ...config.preferences, [key]: value }
    setBusy(true); setError(''); setNotice(''); setConfig({ ...config, preferences })
    try {
      await postJSON('/api/notifications', { action: 'preferences', ...preferences })
      setNotice('Preferência atualizada em todos os seus dispositivos.')
    } catch (e) { setConfig(previous); setError(message(e)) } finally { setBusy(false) }
  }
  return <section className="notification-settings" aria-label="Notificações"><div className="profile-section-title"><Bell size={22} /><div><h3>O movimento da turma</h3><p>Saiba quando alguém dos seus desafios treinar.</p></div></div>
    {!installed ? <p className="hint">Instale o Pulso e abra pelo ícone da tela inicial para ativar os avisos. No iPhone, use o app instalado pelo Safari (iOS 16.4 ou superior).</p> : !supported ? <p className="hint">Este navegador não oferece notificações. No Android, tente instalar pelo Chrome; no iPhone, atualize o iOS.</p> : !config ? <p className="hint">Carregando preferências…</p> : !config.configured ? <p className="hint">As notificações estão sendo configuradas. Tente novamente mais tarde.</p> : <button type="button" className={`button ${active ? 'secondary' : 'primary'} full`} disabled={busy} onClick={() => void (active ? disable() : enable())}>{active ? <BellOff size={17} /> : <Bell size={17} />}{busy ? 'Aguarde…' : active ? 'Desativar neste dispositivo' : 'Ativar neste dispositivo'}</button>}
    {config && <fieldset className="notification-options" disabled={busy}><legend>Quais novos registros você quer acompanhar?</legend>{(['strength', 'cardio'] as const).map(key => <label key={key}><span>{key === 'strength' ? 'Musculação' : 'Cardio'}</span><input type="checkbox" role="switch" aria-label={`Avisos de ${key === 'strength' ? 'musculação' : 'cardio'}`} checked={config.preferences[key]} onChange={e => void preference(key, e.target.checked)} /></label>)}</fieldset>}
    <p className="hint">Ativação por dispositivo. Modalidades por conta. Um aviso por treino, mesmo quando vocês compartilham vários desafios.</p>
    {notice && <p className="notice" role="status">{notice}</p>}{error && <p className="error" role="alert">{error}<button type="button" className="text-button" onClick={() => { setError(''); setRetry(v => v + 1) }}>Tentar novamente</button></p>}
  </section>
}
