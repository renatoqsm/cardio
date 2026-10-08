'use client'
import { useEffect, useRef } from 'react'
import { Flame, X } from 'lucide-react'
export function Brand() { return <span className="brand"><span className="brand-mark"><Flame size={21} strokeWidth={2.5} /></span>pulso<span className="brand-dot">.</span></span> }
export function Avatar({ name, image, size = 'normal' }: { name: string; image?: string | null; size?: 'small' | 'normal' | 'large' }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase() || 'P'
  return <span className={`avatar avatar-${size}`} aria-label={name}>{image ? <img src={image} alt="" /> : initials}</span>
}
export function Dialog({ title, children, onClose, wide = false }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null, overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'; ref.current?.focus()
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close.current() }
      if (event.key === 'Tab') {
        const items = ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled):not([type="file"]), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')
        if (!items?.length) return
        const first = items[0], last = items[items.length - 1]
        if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', keyboard)
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', keyboard); previous?.focus() }
  }, [])
  return <div className="dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}><div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className={`dialog ${wide ? 'dialog-wide' : ''}`}><header className="dialog-heading"><h2>{title}</h2><button type="button" className="icon-button" onClick={onClose} aria-label="Fechar"><X size={20} /></button></header>{children}</div></div>
}
