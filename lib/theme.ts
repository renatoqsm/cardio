export type Theme = 'light' | 'dark'
export const themeStorageKey = 'pulso-theme'
export function applyTheme(theme: Theme) {
  const root = document.documentElement
  root.dataset.theme = theme
  root.classList.toggle('dark', theme === 'dark')
  root.style.colorScheme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0b1410' : '#26351f')
}
// This trusted, static script runs before paint; storage may be blocked by the browser.
export const themeBootstrap = `(()=>{let t='dark';try{if(localStorage.getItem('pulso-theme')==='light')t='light'}catch{}const r=document.documentElement;r.dataset.theme=t;r.classList.toggle('dark',t==='dark');r.style.colorScheme=t})()`
