import type { Metadata } from 'next'
import AppHub from '@/components/app-hub'

export const metadata: Metadata = { title: 'Pulso — Meu aplicativo', robots: { index: false, follow: false } }
export default function AppPage() { return <AppHub /> }
