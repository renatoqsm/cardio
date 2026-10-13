import { postJSON } from './client'

export function isInstalled() {
  return window.matchMedia('(display-mode: standalone)').matches || !!(navigator as Navigator & { standalone?: boolean }).standalone
}
export async function notificationRegistration() {
  await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
  return Promise.race([navigator.serviceWorker.ready, new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error('Aguarde o aplicativo terminar de atualizar e tente novamente.')), 10000))])
}
export async function bindNotificationAccount(userId: string | null) {
  if (!('serviceWorker' in navigator)) return
  const registration = await navigator.serviceWorker.getRegistration('/')
  const worker = registration?.active
  if (!worker) return
  await new Promise<void>(resolve => {
    const channel = new MessageChannel(), timeout = window.setTimeout(resolve, 1500)
    channel.port1.onmessage = () => { window.clearTimeout(timeout); channel.port1.close(); resolve() }
    worker.postMessage({ type: 'PULSO_ACCOUNT', userId }, [channel.port2])
  })
}
export async function detachNotificationDevice() {
  await bindNotificationAccount(null)
  if (!('serviceWorker' in navigator)) return
  try {
    const registration = await navigator.serviceWorker.getRegistration('/')
    const sub = await registration?.pushManager.getSubscription()
    if (!sub) return
    await postJSON('/api/notifications', { action: 'unsubscribe', endpoint: sub.endpoint })
    await sub.unsubscribe()
  } catch { /* Signing out must stay available; the worker has cleared the account binding. */ }
}
