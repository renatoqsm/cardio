'use client'
import { useEffect, useState } from 'react'
import { Download, Share } from 'lucide-react'
import { Dialog } from './ui'
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }
export function InstallApp() {
  const [available, setAvailable] = useState(false), [prompt, setPrompt] = useState<InstallPrompt | null>(null)
  const [help, setHelp] = useState(false), [ios, setIos] = useState(false), [android, setAndroid] = useState(false), [busy, setBusy] = useState(false)
  useEffect(() => {
    const display = window.matchMedia('(display-mode: standalone)')
    const update = () => setAvailable(!display.matches && !(navigator as Navigator & { standalone?: boolean }).standalone)
    update()
    setIos(/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))
    setAndroid(/Android/.test(navigator.userAgent))
    const beforeInstall = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPrompt) }
    const installed = () => { setAvailable(false); setPrompt(null); setHelp(false) }
    window.addEventListener('beforeinstallprompt', beforeInstall)
    window.addEventListener('appinstalled', installed)
    display.addEventListener('change', update)
    if ('serviceWorker' in navigator && window.isSecureContext) void navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => {})
    return () => { window.removeEventListener('beforeinstallprompt', beforeInstall); window.removeEventListener('appinstalled', installed); display.removeEventListener('change', update) }
  }, [])
  const install = async () => {
    if (busy) return
    if (!prompt) { setHelp(true); return }
    setBusy(true)
    try { await prompt.prompt(); const choice = await prompt.userChoice; if (choice.outcome === 'accepted') setAvailable(false) }
    catch { setHelp(true) }
    finally { setPrompt(null); setBusy(false) }
  }
  if (!available) return null
  return <><button className="install-app-button" disabled={busy} onClick={() => void install()}><Download size={17} />{busy ? 'Abrindo instalação…' : 'Instalar aplicativo'}</button>{help && <Dialog title="Instalar o Pulso" onClose={() => setHelp(false)}><p className="editor-intro">Tenha o Pulso na tela inicial, com ícone próprio e abertura como aplicativo.</p>{ios ? <ol className="install-steps"><li>Abra este site no Safari.</li><li>Toque em <Share size={16} /> <strong>Compartilhar</strong>.</li><li>Escolha <strong>Adicionar à Tela de Início</strong> e confirme em <strong>Adicionar</strong>.</li></ol> : android ? <ol className="install-steps"><li>Abra este site no Chrome ou Samsung Internet.</li><li>Abra o menu do navegador (⋮ ou ☰).</li><li>Escolha <strong>Instalar aplicativo</strong> ou <strong>Adicionar à tela inicial</strong> e confirme a instalação.</li></ol> : <ol className="install-steps"><li>Abra este site no Chrome ou Edge.</li><li>Use o ícone de instalação na barra de endereço, ou a opção <strong>Instalar Pulso</strong> no menu do navegador.</li><li>Confirme a instalação.</li></ol>}<p className="muted editor-intro">Você continuará usando sua conta atual. É necessário internet para acessar desafios e publicar treinos.</p><button className="button primary full" onClick={() => setHelp(false)}>Entendi</button></Dialog>}</>
}
