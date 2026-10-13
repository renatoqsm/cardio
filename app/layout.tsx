import type { Metadata, Viewport } from 'next'
import './globals.css'
import './themes.css'
import './app-shell.css'
import { themeBootstrap } from '@/lib/theme'
import { InstallApp } from '@/components/install-app'

export const metadata: Metadata = {
  title: 'Pulso — Desafios de cardio e musculação',
  description: 'Crie desafios de cardio e musculação, registre seus treinos e acompanhe sua turma.',
  applicationName: 'Pulso',
  appleWebApp: { capable: true, title: 'Pulso', statusBarStyle: 'black-translucent' },
  icons: { icon: '/icons/pulso-192.png', apple: '/icons/pulso-apple-180.png' },
}

export const viewport: Viewport = {
  themeColor: '#0b1410',
  userScalable: true,
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: themeBootstrap }} /></head><body className="antialiased">{children}<InstallApp /></body></html>
}
