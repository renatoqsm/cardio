import type { Metadata, Viewport } from 'next'
import './globals.css'
import { InstallApp } from '@/components/install-app'

export const metadata: Metadata = {
  title: 'Pulso — Desafios de cardio e musculação',
  description: 'Crie desafios de cardio e musculação, registre seus treinos e acompanhe sua turma.',
  applicationName: 'Pulso',
  appleWebApp: { capable: true, title: 'Pulso', statusBarStyle: 'default' },
  icons: { icon: '/icons/pulso-192.png', apple: '/icons/pulso-apple-180.png' },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#26351f',
  userScalable: true,
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body className="antialiased">{children}<InstallApp /></body></html>
}
