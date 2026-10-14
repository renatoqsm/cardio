import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, Award, Bell, Camera, Check, ChevronRight, Dumbbell, Flame, Menu, Plus, ShieldCheck, Smartphone, Target, Timer, Trophy, Users } from 'lucide-react'
import { Brand } from '@/components/ui'
import './landing.css'

const origin = 'https://cardio.renatoqsousam.workers.dev'
export const metadata: Metadata = {
  title: 'Pulso — Seu treino. Sua turma. Seu ritmo.',
  description: 'Transforme seus treinos em desafios com amigos. Musculação, cardio, metas semanais e conquistas em um aplicativo que você instala direto no celular.',
  alternates: { canonical: origin },
  openGraph: { type: 'website', locale: 'pt_BR', url: origin, title: 'Pulso — Seu treino. Sua turma. Seu ritmo.', description: 'Treine, registre e evolua com sua turma. Conheça o Pulso e instale no celular.', images: [{ url: `${origin}/icons/pulso-512.png`, width: 512, height: 512, alt: 'Pulso' }] },
  twitter: { card: 'summary', title: 'Pulso — Melhor em turma.', description: 'Desafios de musculação e cardio com amigos.', images: [`${origin}/icons/pulso-512.png`] },
}

const features = [
  { Icon: Dumbbell, title: 'Musculação com constância', text: 'Um check-in por dia. Seu treino conta nos desafios de musculação em que você participa, dentro do período de cada um.' },
  { Icon: Flame, title: 'Cardio no seu ritmo', text: 'Registre minutos, quilômetros e pace opcional. Mais de um cardio no dia também pode contar nos desafios elegíveis.' },
  { Icon: Camera, title: 'O treino tem sua marca', text: 'Use a câmera do aplicativo e o gesto do dia para registrar o momento. Compartilhe sua conquista com a turma.' },
  { Icon: Target, title: 'Metas que cabem na vida', text: 'Defina objetivos semanais e acompanhe seu progresso. Com espaço para os dias de descanso.' },
  { Icon: Award, title: 'Sua evolução merece uma medalha', text: 'Desbloqueie 40 conquistas. A maior medalha de cada modalidade acompanha seu nome, e todas ficam no perfil.' },
  { Icon: Bell, title: 'Sua turma te dá um empurrão', text: 'Reaja, comente e ative avisos de novos treinos no app instalado. Você escolhe quais modalidades acompanhar.' },
]
const faq = [
  ['Preciso baixar pela loja?', 'Não. O Pulso é instalado diretamente pelo navegador e ganha um ícone na tela inicial. No Android, use Chrome ou Samsung Internet. No iPhone, abra no Safari e escolha Compartilhar → Adicionar à Tela de Início.'],
  ['Como entro no desafio de um amigo?', 'Abra o link do convite ou informe a chave dentro do app. Entre na sua conta, confira o convite e confirme sua participação.'],
  ['Preciso registrar o mesmo treino em cada desafio?', 'Não. Um registro conta nos desafios da mesma modalidade em que você participa, desde que a data esteja dentro do período de cada desafio. Na musculação, conta um check-in por dia; no cardio, você pode registrar vários.'],
  ['Posso acompanhar meus treinos sem um desafio?', 'Sim. Seus registros ficam no histórico pessoal e alimentam seu resumo, metas e conquistas, mesmo quando não pontuam em um desafio.'],
  ['O Pulso funciona sem internet?', 'É necessário internet para entrar, ver os desafios e publicar treinos. A instalação permite abrir pelo ícone do celular, mas não transforma os dados em conteúdo offline.'],
  ['Como recebo os avisos no celular?', 'Depois de instalar e abrir o Pulso pelo ícone, vá a Meu perfil e ative as notificações neste dispositivo. Permita os avisos no celular e escolha cardio, musculação ou ambos. No iPhone, é necessário iOS 16.4 ou superior.'],
]

function AppPreview() {
  return <div className="lp-preview" aria-label="Exemplo ilustrativo da tela do Pulso"><div className="lp-preview-glow" /><div className="lp-phone"><div className="lp-phone-status"><span>9:41</span><span>● ● ▰</span></div><div className="lp-phone-bar"><Menu size={17} /><Brand /><span className="lp-demo-avatar">VC</span></div><div className="lp-phone-content"><p className="lp-demo-eyebrow">SEU RITMO, SUA EVOLUÇÃO</p><h2>Vamos nessa,<br /><span>sua turma te espera.</span></h2><div className="lp-demo-stats"><span><Dumbbell size={16} /><strong>12</strong><small>Check-ins</small></span><span><Flame size={16} /><strong>24 <small>km</small></strong><small>Cardio</small></span></div><div className="lp-demo-goal"><div><span><small>SEU FOCO DA SEMANA</small><strong>Cada treino<br />te aproxima.</strong></span><span className="lp-demo-ring">75%</span></div><p>Musculação <strong>3 / 4 dias</strong></p><i /><p>Cardio <strong>45 / 60 min</strong></p><i /></div><div className="lp-demo-week"><span>Seu mês em movimento</span><div>{['S','T','Q','Q','S','S','D'].map((day,i)=><span key={i} className={i===0||i===2||i===4?'active':''}>{day}<strong>{12+i}</strong></span>)}</div></div><div className="lp-demo-challenge"><span><Trophy size={15} />A turma não para<ChevronRight size={15} /></span><small>Um objetivo. Melhor em turma.</small></div></div><span className="lp-demo-add"><Plus size={25}/></span><div className="lp-phone-home" /></div><span className="lp-preview-label">PRÉVIA ILUSTRATIVA DO APLICATIVO</span><span className="lp-floating-medal"><ShieldCheck size={23}/><span><strong>Uma conquista de cada vez.</strong><small>Seu esforço ganha reconhecimento.</small></span></span></div>
}

export default async function LandingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams
  // Preserve previously shared invitations, payment returns and notification links.
  if (['join', 'challengeId', 'recordId', 'checkout'].some(key => query[key] !== undefined)) {
    const target = new URLSearchParams()
    for (const [key, value] of Object.entries(query)) if (value !== undefined) for (const entry of Array.isArray(value) ? value : [value]) target.append(key, entry)
    redirect(`/app?${target}`)
  }
  return <main className="lp"><header className="lp-header"><Link href="/" aria-label="Pulso, início"><Brand /></Link><nav aria-label="Navegação do site"><a href="#como-funciona">Como funciona</a><a href="#recursos">O aplicativo</a><a href="#duvidas">Dúvidas</a></nav><Link className="lp-login" href="/app">Entrar<ArrowRight size={16}/></Link></header>
    <section className="lp-hero"><div className="lp-hero-copy"><p className="lp-kicker"><span/>MELHOR EM TURMA.</p><h1>Seu treino.<br/>Sua turma.<br/><em>Seu ritmo.</em></h1><p className="lp-intro">A motivação pode até oscilar.<br/>A sua turma te ajuda a continuar.</p><p className="lp-hero-description">Crie desafios de musculação e cardio, registre seus treinos e celebre cada conquista com seus amigos.</p><div className="lp-actions"><Link href="/app?signup=1" className="lp-primary">Começar agora<ArrowRight size={18}/></Link><a href="#como-funciona" className="lp-secondary">Conhecer o Pulso<ChevronRight size={17}/></a></div><p className="lp-install-note"><Smartphone size={16}/>Instale no celular. Abra pelo seu próprio ícone.</p></div><AppPreview /></section>
    <div className="lp-ribbon"><span><Dumbbell size={19}/>Musculação</span><span><Flame size={19}/>Cardio</span><span><Users size={19}/>Sua turma</span><span><Award size={19}/>Suas conquistas</span></div>
    <section id="como-funciona" className="lp-section"><div className="lp-section-heading"><p className="lp-kicker">DO PRIMEIRO PASSO AO PRÓXIMO TREINO.</p><h2>Começar é simples.<br/><em>Continuar é melhor em turma.</em></h2><p>Sem precisar registrar o mesmo treino várias vezes. Sem transformar descanso em derrota.</p></div><div className="lp-steps">{[
      ['01','Encontre sua turma','Crie sua conta e monte um desafio ou entre pelo convite de um amigo.',Users],
      ['02','Registre seu movimento','Escolha cardio ou musculação, tire sua foto com o gesto do dia e publique.',Camera],
      ['03','Veja cada treino somar','Acompanhe metas, ranking e conquistas. Incentive os amigos e siga no seu ritmo.',Trophy],
    ].map(([n,title,text,Icon])=>{const Symbol=Icon as typeof Users;return <article key={n as string}><div><span>{n as string}</span><Symbol size={26}/></div><h3>{title as string}</h3><p>{text as string}</p></article>})}</div></section>
    <section id="recursos" className="lp-section lp-features"><div className="lp-section-heading"><p className="lp-kicker">FEITO PARA A VIDA REAL.</p><h2>O treino é seu.<br/><em>O incentivo é compartilhado.</em></h2></div><div className="lp-feature-grid">{features.map(({Icon,title,text})=><article key={title}><span className="lp-feature-icon"><Icon size={25}/></span><h3>{title}</h3><p>{text}</p></article>)}</div></section>
    <section id="instalar" className="lp-install-section"><div><p className="lp-kicker">UM ÍCONE. SUA TURMA SEMPRE POR PERTO.</p><h2>Daqui para<br/><em>a sua tela inicial.</em></h2><p>Entre ou crie sua conta. Depois, instale o Pulso pelo navegador e abra direto no aplicativo.</p><Link href="/app?install=1" className="lp-primary"><Smartphone size={19}/>Acessar e instalar<ArrowRight size={17}/></Link></div><div className="lp-install-guide"><h3><Smartphone size={23}/>Como instalar</h3><article><strong>Android</strong><p>Abra no Chrome ou Samsung Internet, toque em “Instalar aplicativo” e confirme.</p></article><article><strong>iPhone</strong><p>Abra no Safari → Compartilhar → Adicionar à Tela de Início.</p></article><p className="lp-install-check"><Check size={16}/>Já instalou? Abra pelo ícone para ir direto ao login ou à sua home.</p></div></section>
    <section id="duvidas" className="lp-section lp-faq"><div className="lp-section-heading"><p className="lp-kicker">ANTES DO PRIMEIRO CHECK-IN.</p><h2>Ficou alguma dúvida?</h2></div><div>{faq.map(([question,answer])=><details key={question}><summary>{question}<Plus size={18}/></summary><p>{answer}</p></details>)}</div></section>
    <section className="lp-final"><Flame size={36}/><h2>Seu próximo treino<br/>pode começar <em>uma história.</em></h2><p>Chame sua turma. Encontre seu ritmo.</p><Link href="/app?signup=1" className="lp-primary">Quero começar<ArrowRight size={18}/></Link></section><footer className="lp-footer"><Brand/><span>Seu ritmo. Sua turma.</span><Link href="/app">Acessar o aplicativo<ArrowRight size={15}/></Link></footer>
  </main>
}
