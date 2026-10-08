'use client'
import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { applyTheme, themeStorageKey, type Theme } from '@/lib/theme'
export function ThemeToggle({ floating = false }: { floating?: boolean }) {
  const [theme, setTheme] = useState<Theme>('light'), [ready, setReady] = useState(false)
  useEffect(() => {
    const current = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
    applyTheme(current); setTheme(current); setReady(true)
    const sync = (event: StorageEvent) => {
      if (event.key !== themeStorageKey && event.key !== null) return
      const next = event.newValue === 'dark' ? 'dark' : 'light'
      applyTheme(next); setTheme(next)
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])
  const change = () => {
    const next = theme === 'light' ? 'dark' : 'light'
    applyTheme(next); setTheme(next)
    try { localStorage.setItem(themeStorageKey, next) } catch { /* The selected theme still works for this visit. */ }
  }
  return <button type="button" className={`theme-toggle ${floating ? 'theme-toggle-floating' : ''}`} disabled={!ready} onClick={change} aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'} title={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}>{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}<span>{theme === 'dark' ? 'Claro' : 'Escuro'}</span></button>
}
