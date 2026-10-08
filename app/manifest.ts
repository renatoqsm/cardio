import type { MetadataRoute } from 'next'
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/', name: 'Pulso — Desafios com amigos', short_name: 'Pulso',
    description: 'Desafios de cardio e musculação. Registre seus treinos e acompanhe sua turma.',
    lang: 'pt-BR', start_url: '/', scope: '/', display: 'standalone',
    background_color: '#f7f8f6', theme_color: '#26351f',
    icons: [
      { src: '/icons/pulso-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/pulso-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/pulso-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
