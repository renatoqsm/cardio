'use client'
import { useEffect, useRef, useState } from 'react'
import { Camera, RefreshCw, SwitchCamera, X } from 'lucide-react'
import type { DailyGesture } from '@/lib/gestures'
export type CapturedPhoto = { file: File; captureDay: string; gestureId: string }
export function CameraProof({ photo, onCapture, disabled, onBusy }: { photo: CapturedPhoto | null; onCapture: (photo: CapturedPhoto | null) => void; disabled: boolean; onBusy: (busy: boolean) => void }) {
  const [gesture, setGesture] = useState<DailyGesture | null>(null), [error, setError] = useState('')
  const [stream, setStream] = useState<MediaStream | null>(null), [opening, setOpening] = useState(false), [ready, setReady] = useState(false)
  const [facing, setFacing] = useState<'user' | 'environment'>('user'), [canSwitch, setCanSwitch] = useState(false), [preview, setPreview] = useState('')
  const video = useRef<HTMLVideoElement>(null), active = useRef<MediaStream | null>(null), generation = useRef(0)
  const stop = () => { generation.current++; active.current?.getTracks().forEach(track => track.stop()); active.current = null; setStream(null); setReady(false); setOpening(false) }
  const loadGesture = async (signal?: AbortSignal) => {
    const response = await fetch('/api/capture', { cache: 'no-store', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000) })
    if (!response.ok) throw new Error(response.status === 401 ? 'Sua sessão expirou. Entre novamente.' : 'Não foi possível carregar o gesto do dia. Tente novamente.')
    const result = await response.json(); return result.gesture as DailyGesture
  }
  useEffect(() => {
    const controller = new AbortController()
    void loadGesture(controller.signal).then(value => { if (!controller.signal.aborted) setGesture(value) }).catch(() => { if (!controller.signal.aborted) setError('Não foi possível carregar o gesto do dia. Toque em Abrir câmera para tentar novamente.') })
    return () => { controller.abort(); generation.current++; active.current?.getTracks().forEach(track => track.stop()); active.current = null }
  }, [])
  useEffect(() => { onBusy(opening || !!stream); return () => onBusy(false) }, [opening, stream, onBusy])
  useEffect(() => { if (!photo) { setPreview(''); return }; const url = URL.createObjectURL(photo.file); setPreview(url); return () => URL.revokeObjectURL(url) }, [photo])
  useEffect(() => {
    if (!stream || !video.current) return
    setReady(false); video.current.srcObject = stream
    void video.current.play().catch(() => { if (active.current !== stream) return; setError('Não foi possível iniciar a prévia. Feche a câmera e tente novamente.'); stop() })
  }, [stream])
  const open = async (direction = facing) => {
    stop(); const attempt = generation.current
    setError(''); setOpening(true); onCapture(null)
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) throw new Error('Abra o site pelo endereço HTTPS no Chrome para usar a câmera.')
      const day = await loadGesture()
      if (attempt !== generation.current) return
      setGesture(day)
      const media = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: direction }, width: { ideal: 1280 }, height: { ideal: 960 } } })
      if (attempt !== generation.current) { media.getTracks().forEach(track => track.stop()); return }
      active.current = media; setFacing(direction); setStream(media); setOpening(false)
      void navigator.mediaDevices.enumerateDevices().then(devices => { if (attempt === generation.current) setCanSwitch(devices.filter(device => device.kind === 'videoinput').length > 1) }).catch(() => {})
    } catch (error) {
      if (attempt !== generation.current) return
      const name = error instanceof Error ? error.name : ''
      setError(name === 'NotAllowedError' || name === 'PermissionDeniedError' ? 'Permita o acesso à câmera nas configurações do navegador e tente novamente. No Samsung, abra o site no Chrome.' : name === 'NotFoundError' ? 'Nenhuma câmera foi encontrada. Abra o site em um celular com câmera.' : name === 'NotReadableError' ? 'A câmera está em uso. Feche outros aplicativos que usam a câmera e tente novamente.' : error instanceof Error && name === 'Error' ? error.message : 'Não foi possível abrir a câmera. Abra o site no Chrome e tente novamente.')
      stop()
    }
  }
  const capture = () => {
    const source = video.current
    if (!gesture || !source || !source.videoWidth || !source.videoHeight || !ready) return
    const attempt = generation.current, canvas = document.createElement('canvas')
    const scale = Math.min(1, 1600 / Math.max(source.videoWidth, source.videoHeight))
    canvas.width = Math.round(source.videoWidth * scale); canvas.height = Math.round(source.videoHeight * scale)
    const context = canvas.getContext('2d')
    if (!context) { setError('Não foi possível tirar a foto. Tente novamente.'); return }
    context.drawImage(source, 0, 0, canvas.width, canvas.height)
    canvas.toBlob(blob => {
      if (attempt !== generation.current) return
      if (!blob) { setError('Não foi possível tirar a foto. Tente novamente.'); return }
      const captured = { file: new File([blob], 'treino-camera.jpg', { type: 'image/jpeg' }), captureDay: gesture.captureDay, gestureId: gesture.id }
      stop(); onCapture(captured)
    }, 'image/jpeg', .88)
  }
  return <section className="camera-proof" aria-label="Foto pela câmera do site">
    {gesture && <div className="daily-gesture"><span className="gesture-emoji" aria-hidden="true">{gesture.emoji}</span><div><strong>Gesto do dia: {gesture.title}</strong><p>{gesture.instruction} Mostre também o ambiente do treino.</p><small>{gesture.captureDay.split('-').reverse().join('/')} · horário de Brasília</small></div></div>}
    <p className="camera-note">Faça o gesto com a mão. Sua turma poderá conferir se ele aparece na foto.</p>
    {(stream || opening) ? <><div className="camera-view"><video ref={video} muted autoPlay playsInline onLoadedData={() => setReady(true)} className={facing === 'user' ? 'camera-mirrored' : ''} aria-label="Prévia da câmera" />{opening && <span>Abrindo câmera…</span>}</div><div className="camera-actions"><button type="button" className="button secondary" onClick={stop} aria-label="Fechar câmera"><X size={16} />Fechar</button>{canSwitch && <button type="button" className="button secondary" disabled={opening} onClick={() => void open(facing === 'user' ? 'environment' : 'user')}><SwitchCamera size={16} />Trocar câmera</button>}<button type="button" className="button primary" disabled={!ready || opening} onClick={capture}><Camera size={16} />Tirar foto</button></div></> : <><div className="camera-photo">{preview ? <img src={preview} alt="Foto capturada pela câmera" /> : <Camera size={36} />}</div><button className="button secondary full" type="button" disabled={disabled} onClick={() => void open()}>{photo ? <RefreshCw size={17} /> : <Camera size={17} />}{photo ? 'Tirar outra foto' : 'Abrir câmera'}</button></>}
    {error && <p className="error" role="alert">{error}</p>}
    <p className="camera-note">A foto é tirada aqui no site. Não há seleção pela galeria.</p>
  </section>
}
