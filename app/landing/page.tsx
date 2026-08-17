'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
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

type PublicDraw = {
  game: 'megasena' | 'lotofacil' | 'quina'
  contest_number: number
  draw_date: string | null
  numbers: number[]
  status: string
  confidence: number | null
  source_count: number | null
  next_contest_number: number | null
  next_draw_date: string | null
  estimated_next_prize: number | string | null
  updated_at: string
}

const GAME_ORDER: PublicDraw['game'][] = ['megasena', 'lotofacil', 'quina']
const GAME_LABEL: Record<PublicDraw['game'], string> = {
  megasena: 'Mega-Sena',
  lotofacil: 'Lotofácil',
  quina: 'Quina',
}

const money = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
})

function formatDate(value: string | null) {
  if (!value) return 'Data aguardando atualização'
  const [y,m,d] = value.slice(0,10).split('-')
  if (!y || !m || !d) return value
  return `${d}/${m}/${y}`
}

function formatUpdated(value?: string) {
  if (!value) return 'Atualização indisponível'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Atualização indisponível'
  return `Atualizado às ${date.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' })}`
}

export default function LandingPage() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [foundersRemaining, setFoundersRemaining] = useState(100)
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const [draws, setDraws] = useState<PublicDraw[]>([])
  const [drawLoading, setDrawLoading] = useState(true)
  const [drawError, setDrawError] = useState('')

  const loadDraws = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_public_latest_draws')
    if (error) {
      setDrawError('Não foi possível atualizar os concursos agora. Os últimos dados confirmados serão exibidos assim que a conexão for restabelecida.')
      setDrawLoading(false)
      return
    }

    const rows = (data || []) as PublicDraw[]
    if (rows.length) {
      setDraws(rows)
      setDrawError('')
    } else {
      setDrawError('Os concursos estão temporariamente indisponíveis.')
    }
    setDrawLoading(false)
  }, [])

  useEffect(() => {
    Promise.all([
      supabase.from('plans').select('*').eq('active', true).order('price_monthly', { ascending: true }),
      supabase.rpc('founders_remaining')
    ]).then(([plansResult, foundersResult]) => {
      if (plansResult.data) setPlans(plansResult.data as Plan[])
      if (typeof foundersResult.data === 'number') setFoundersRemaining(foundersResult.data)
    })

    loadDraws()
    const timer = window.setInterval(loadDraws, 60_000)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') loadDraws()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [loadDraws])

  async function captureFounder(e: FormEvent) {
    e.preventDefault()
    const clean = email.trim().toLowerCase()
    if (!/^\S+@\S+\.\S+$/.test(clean)) {
      setMessage('Informe um e-mail válido.')
      return
    }
    setBusy(true)
    setMessage('')
    const { error } = await supabase
      .from('founder_leads')
      .upsert({ email: clean, source: 'home', status: 'interested' }, { onConflict: 'email' })
    setBusy(false)
    if (error) {
      setMessage('Não foi possível registrar seu interesse agora. Tente novamente.')
      return
    }
    setMessage('Interesse registrado. Você entrou na lista dos Founders.')
  }

  const free = plans.find(p => p.id === 'free')
  const pro = plans.find(p => p.id === 'pro')
  const founders = plans.find(p => p.id === 'founders')
  const limit = founders?.founders_limit || 100
  const foundersSold = Math.max(0, limit - foundersRemaining)
  const progress = Math.min(100, (foundersSold / limit) * 100)

  const drawsByGame = new Map(draws.map(draw => [draw.game, draw]))

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <a className={styles.brand} href="/" aria-label="LotoSmart">
          <span className={styles.mark}>✦</span><b>Loto<span>Smart</span></b>
        </a>
        <nav>
          <a href="#concursos">Concursos</a>
          <a href="#recursos">Recursos</a>
          <a href="#planos">Planos</a>
          <a href="/app">Entrar</a>
        </nav>
      </header>

      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>ESTRATÉGIA • VALIDAÇÃO • ACOMPANHAMENTO</p>
          <h1>Jogue com mais método.<br/><span>Decida com dados.</span></h1>
          <p className={styles.lead}>
            O LotoSmart reúne geração de portfólios, orçamento, Wheeling, Monte Carlo,
            Validation Engine e acompanhamento dos seus jogos em uma única plataforma.
          </p>
          <div className={styles.heroActions}>
            <a className={styles.primary} href="#founders">Quero ser um dos 100 primeiros</a>
            <a className={styles.secondary} href="/app">Criar conta grátis</a>
          </div>
          <div className={styles.trust}>
            <span>✓ Transparência matemática</span>
            <span>✓ Histórico auditável</span>
            <span>✓ Sem promessa de prêmio</span>
          </div>
        </div>

        <aside className={styles.heroCard}>
          <small>FOUNDERS</small>
          <strong>{foundersRemaining}</strong>
          <span>vagas restantes de {limit}</span>
          <div className={styles.progress}><i style={{ width: `${progress}%` }} /></div>
          <p>Acesso vitalício aos recursos Pro atuais para os primeiros usuários.</p>
        </aside>
      </section>

      <section id="concursos" className={styles.section}>
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>DADOS DOS CONCURSOS</p>
            <h2>Últimos resultados confirmados.</h2>
          </div>
          <button className={styles.refreshButton} onClick={loadDraws} disabled={drawLoading}>
            {drawLoading ? 'Atualizando…' : 'Atualizar dados'}
          </button>
        </div>

        {drawError && <div className={styles.drawWarning}>{drawError}</div>}

        <div className={styles.drawGrid}>
          {GAME_ORDER.map(game => {
            const draw = drawsByGame.get(game)

            if (!draw) {
              return (
                <article className={styles.drawCard} key={game}>
                  <div className={styles.drawTop}>
                    <div>
                      <small>{GAME_LABEL[game]}</small>
                      <strong>Consultando…</strong>
                    </div>
                    <span className={styles.drawStatusPending}>AGUARDANDO</span>
                  </div>
                  <p className={styles.drawMuted}>Buscando o último concurso confirmado.</p>
                </article>
              )
            }

            const estimated = Number(draw.estimated_next_prize || 0)

            return (
              <article className={styles.drawCard} key={game}>
                <div className={styles.drawTop}>
                  <div>
                    <small>{GAME_LABEL[game]}</small>
                    <strong>Concurso {draw.contest_number}</strong>
                    <span>{formatDate(draw.draw_date)}</span>
                  </div>
                  <span className={draw.status === 'confirmed' ? styles.drawStatus : styles.drawStatusPending}>
                    {draw.status === 'confirmed' ? 'CONFIRMADO' : 'PROVISÓRIO'}
                  </span>
                </div>

                <div className={styles.balls}>
                  {(draw.numbers || []).map(number => (
                    <b key={number}>{String(number).padStart(2,'0')}</b>
                  ))}
                </div>

                <div className={styles.drawMeta}>
                  <div>
                    <small>Próximo concurso</small>
                    <strong>{draw.next_contest_number || '—'}</strong>
                    <span>{formatDate(draw.next_draw_date)}</span>
                  </div>
                  <div>
                    <small>Prêmio estimado</small>
                    <strong>{estimated > 0 ? money.format(estimated) : 'Aguardando'}</strong>
                    <span>{draw.source_count ? `${draw.source_count} fontes verificadas` : 'Fonte em validação'}</span>
                  </div>
                </div>

                <footer className={styles.drawFooter}>
                  <span>{formatUpdated(draw.updated_at)}</span>
                  <span>{draw.confidence ? `Confiança dos dados: ${draw.confidence}%` : 'Validação em andamento'}</span>
                </footer>
              </article>
            )
          })}
        </div>

        <p className={styles.drawDisclaimer}>
          Os resultados são consolidados pelo Data Agent a partir de múltiplas fontes e persistidos no LotoSmart.
          Em indisponibilidade externa, mantemos o último concurso confirmado em vez de exibir dados vazios.
        </p>
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
          ].map(([title,text]) => (
            <article key={title}><b>{title}</b><p>{text}</p></article>
          ))}
        </div>
      </section>

      <section id="planos" className={styles.section}>
        <p className={styles.eyebrow}>PLANOS</p>
        <h2>Comece grátis. Evolua quando fizer sentido.</h2>
        <div className={styles.planGrid}>
          <PlanCard
            title="Free"
            price="R$ 0"
            subtitle="Para conhecer"
            features={free?.features || ['Resultados e estatísticas','Gerador limitado','Até 10 jogos salvos']}
            action="Criar conta grátis"
            href="/app"
          />
          <PlanCard
            featured
            title="Pro"
            price={`R$ ${Number(pro?.price_monthly || 19.9).toFixed(2).replace('.', ',')}`}
            subtitle={`por mês • ou R$ ${Number(pro?.price_yearly || 199).toFixed(0)}/ano`}
            features={pro?.features || []}
            action="Começar no Pro"
            href="/app"
          />
          <PlanCard
            founder
            title="Founders"
            price={`R$ ${Number(founders?.lifetime_price || 149).toFixed(0)}`}
            subtitle={`pagamento único • ${foundersRemaining} vagas restantes`}
            features={founders?.features || []}
            action="Quero acesso Founder"
            href="#founders"
          />
        </div>
      </section>

      <section id="founders" className={styles.founders}>
        <div>
          <p className={styles.eyebrow}>LOTE DE LANÇAMENTO</p>
          <h2>Entre para os 100 primeiros.</h2>
          <p>
            Cadastre seu e-mail para registrar interesse no acesso Founders por R$ 149.
            A cobrança será habilitada somente quando o checkout oficial estiver conectado.
          </p>
        </div>
        <form onSubmit={captureFounder}>
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="seu@email.com"/>
          <button disabled={busy}>{busy?'Registrando...':'Quero minha vaga'}</button>
          {message && <small>{message}</small>}
        </form>
      </section>

      <footer className={styles.footer}>
        <div className={styles.brand}><span className={styles.mark}>✦</span><b>Loto<span>Smart</span></b></div>
        <p>LotoSmart organiza estratégia e acompanhamento. Resultados de loteria são aleatórios e não há garantia de premiação.</p>
      </footer>
    </main>
  )
}

function PlanCard({
  title,price,subtitle,features,action,href,featured,founder
}:{
  title:string;price:string;subtitle:string;features:string[];action:string;href:string;featured?:boolean;founder?:boolean
}){
  return (
    <article className={`${styles.plan} ${featured?styles.featured:''} ${founder?styles.founderPlan:''}`}>
      <div><small>{title}</small><strong>{price}</strong><span>{subtitle}</span></div>
      <ul>{features.map(f=><li key={f}>✓ {f}</li>)}</ul>
      <a href={href}>{action}</a>
    </article>
  )
}
