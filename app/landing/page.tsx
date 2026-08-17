'use client'

import { FormEvent, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import styles from './landing.module.css'

type Plan = {
  id: string
  name: string
  price_monthly: number | null
  price_yearly: number | null
  lifetime_price: number | null
  is_founders: boolean
  founders_limit: number | null
  features: string[]
}

const APP_URL = 'https://lotosmart-ediineys-projects.vercel.app'

export default function LandingPage() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [foundersRemaining, setFoundersRemaining] = useState(100)
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('plans').select('*').eq('active', true).order('price_monthly', { ascending: true }),
      supabase.rpc('founders_remaining')
    ]).then(([plansResult, foundersResult]) => {
      if (plansResult.data) setPlans(plansResult.data as Plan[])
      if (typeof foundersResult.data === 'number') setFoundersRemaining(foundersResult.data)
    })
  }, [])

  async function captureFounder(e: FormEvent) {
    e.preventDefault()
    const clean = email.trim().toLowerCase()
    if (!/^\S+@\S+\.\S+$/.test(clean)) {
      setMessage('Informe um e-mail válido.')
      return
    }
    setBusy(true)
    setMessage('')
    const { error } = await supabase.from('founder_leads').upsert({ email: clean, source: 'landing', status: 'interested' }, { onConflict: 'email' })
    setBusy(false)
    if (error) {
      setMessage('Não foi possível reservar seu interesse agora. Tente novamente.')
      return
    }
    setMessage('Interesse registrado. Você entrou na lista dos Founders.')
  }

  const free = plans.find(p => p.id === 'free')
  const pro = plans.find(p => p.id === 'pro')
  const founders = plans.find(p => p.id === 'founders')
  const foundersSold = Math.max(0, (founders?.founders_limit || 100) - foundersRemaining)

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <a className={styles.brand} href="/landing" aria-label="LotoSmart">
          <span className={styles.mark}>✦</span><b>Loto<span>Smart</span></b>
        </a>
        <nav><a href="#recursos">Recursos</a><a href="#planos">Planos</a><a href={`${APP_URL}/`}>Entrar</a></nav>
      </header>

      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>ESTRATÉGIA • VALIDAÇÃO • ACOMPANHAMENTO</p>
          <h1>Jogue com mais método.<br/><span>Decida com dados.</span></h1>
          <p className={styles.lead}>O LotoSmart reúne geração de portfólios, orçamento, Wheeling, Monte Carlo, Validation Engine e acompanhamento dos seus jogos em uma única plataforma.</p>
          <div className={styles.heroActions}>
            <a className={styles.primary} href="#founders">Quero ser um dos 100 primeiros</a>
            <a className={styles.secondary} href={`${APP_URL}/`}>Criar conta grátis</a>
          </div>
          <div className={styles.trust}><span>✓ Transparência matemática</span><span>✓ Histórico auditável</span><span>✓ Sem promessa de prêmio</span></div>
        </div>
        <aside className={styles.heroCard}>
          <small>FOUNDERS</small>
          <strong>{foundersRemaining}</strong>
          <span>vagas restantes de 100</span>
          <div className={styles.progress}><i style={{ width: `${Math.min(100, foundersSold)}%` }} /></div>
          <p>Acesso vitalício aos recursos Pro atuais para os primeiros usuários.</p>
        </aside>
      </section>

      <section id="recursos" className={styles.section}>
        <p className={styles.eyebrow}>O ECOSSISTEMA LOTOSMART</p>
        <h2>Da geração à conferência.</h2>
        <div className={styles.featureGrid}>
          {[
            ['Portfólio inteligente','Quatro combinações complementares, evitando carteiras redundantes.'],
            ['Budget Optimizer','Distribua seu orçamento entre quantidade de jogos e dezenas por aposta.'],
            ['Wheeling Lab','Monte sistemas de cobertura e visualize o custo matemático.'],
            ['Monte Carlo','Simule milhares de cenários para entender dispersão e cobertura.'],
            ['Validation Engine','Compare a estratégia estrutural contra carteiras aleatórias de mesmo custo.'],
            ['Meus Jogos','Salve, acompanhe, confira e mantenha seu histórico pessoal.']
          ].map(([title,text]) => <article key={title}><b>{title}</b><p>{text}</p></article>)}
        </div>
      </section>

      <section id="planos" className={styles.section}>
        <p className={styles.eyebrow}>PLANOS</p>
        <h2>Comece grátis. Evolua quando fizer sentido.</h2>
        <div className={styles.planGrid}>
          <PlanCard title="Free" price="R$ 0" subtitle="Para conhecer" features={free?.features || ['Resultados e estatísticas','Gerador limitado','Até 10 jogos salvos']} action="Criar conta grátis" href={`${APP_URL}/`} />
          <PlanCard featured title="Pro" price={`R$ ${Number(pro?.price_monthly || 19.9).toFixed(2).replace('.', ',')}`} subtitle={`por mês • ou R$ ${Number(pro?.price_yearly || 199).toFixed(0)}/ano`} features={pro?.features || []} action="Começar no Pro" href={`${APP_URL}/`} />
          <PlanCard founder title="Founders" price={`R$ ${Number(founders?.lifetime_price || 149).toFixed(0)}`} subtitle="pagamento único • 100 vagas" features={founders?.features || []} action="Quero acesso Founder" href="#founders" />
        </div>
      </section>

      <section id="founders" className={styles.founders}>
        <div><p className={styles.eyebrow}>LOTE DE LANÇAMENTO</p><h2>Entre para os 100 primeiros.</h2><p>Cadastre seu e-mail para registrar interesse no acesso Founders. A cobrança será habilitada somente quando o checkout oficial estiver conectado.</p></div>
        <form onSubmit={captureFounder}><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="seu@email.com"/><button disabled={busy}>{busy?'Registrando...':'Quero minha vaga'}</button>{message && <small>{message}</small>}</form>
      </section>

      <footer className={styles.footer}><div className={styles.brand}><span className={styles.mark}>✦</span><b>Loto<span>Smart</span></b></div><p>LotoSmart organiza estratégia e acompanhamento. Resultados de loteria são aleatórios e não há garantia de premiação.</p></footer>
    </main>
  )
}

function PlanCard({title,price,subtitle,features,action,href,featured,founder}:{title:string;price:string;subtitle:string;features:string[];action:string;href:string;featured?:boolean;founder?:boolean}){
  return <article className={`${styles.plan} ${featured?styles.featured:''} ${founder?styles.founderPlan:''}`}>
    <div><small>{title}</small><strong>{price}</strong><span>{subtitle}</span></div>
    <ul>{features.map(f=><li key={f}>✓ {f}</li>)}</ul>
    <a href={href}>{action}</a>
  </article>
}
