'use client'

import {useEffect,useMemo,useState} from 'react'
import type {Session} from '@supabase/supabase-js'
import {supabase} from '../../../lib/supabase'
import {LOTTERIES,type GameId} from '../../../lib/lotteries'
import {generatePortfolio} from '../../../lib/generator'
import {generateBudgetPortfolio,type BudgetOption} from '../../../lib/advanced'
import {buildWheelServer,monteCarloServer,optimizeBudgetServer,type ServerMonteCarloResult,type ServerWheelResult} from '../../../lib/gaming-api'
import styles from './labs.module.css'

type Entitlements={role:string;plan:'free'|'pro'|'founders';source?:string;is_pro:boolean;can_use_budget:boolean;can_use_wheeling:boolean;can_use_monte_carlo:boolean}
type Tool='budget'|'wheel'|'montecarlo'

const brl=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'})
const integer=new Intl.NumberFormat('pt-BR')
const validTools=new Set<Tool>(['budget','wheel','montecarlo'])

export default function GamingLabsPage(){
  const [session,setSession]=useState<Session|null>(null)
  const [ready,setReady]=useState(false)
  const [ent,setEnt]=useState<Entitlements|null>(null)
  const [game,setGame]=useState<GameId>('lotofacil')
  const [tool,setTool]=useState<Tool>('budget')
  const [budget,setBudget]=useState(100)
  const [options,setOptions]=useState<BudgetOption[]>([])
  const [budgetChoice,setBudgetChoice]=useState<BudgetOption|null>(null)
  const [budgetGames,setBudgetGames]=useState<number[][]>([])
  const [wheelBase,setWheelBase]=useState(17)
  const [wheel,setWheel]=useState<ServerWheelResult|null>(null)
  const [mc,setMc]=useState<ServerMonteCarloResult|null>(null)
  const [busy,setBusy]=useState<'budget'|'wheel'|'mc'|null>(null)
  const [message,setMessage]=useState('')

  const rule=LOTTERIES[game]
  const fallbackPortfolio=useMemo(()=>generatePortfolio(rule,rule.minPick,4),[rule])

  useEffect(()=>{
    const requested=new URLSearchParams(window.location.search).get('tool') as Tool|null
    if(requested&&validTools.has(requested))setTool(requested)
    let active=true
    async function load(){
      const {data:{session:next}}=await supabase.auth.getSession()
      if(!active)return
      setSession(next)
      if(next){const {data}=await supabase.rpc('get_my_entitlements');if(active)setEnt((data||null) as Entitlements|null)}
      setReady(true)
    }
    load()
    const {data:{subscription}}=supabase.auth.onAuthStateChange(async(_event,next)=>{
      if(!active)return
      setSession(next)
      if(next){const {data}=await supabase.rpc('get_my_entitlements');if(active)setEnt((data||null) as Entitlements|null)}else setEnt(null)
      setReady(true)
    })
    return()=>{active=false;subscription.unsubscribe()}
  },[])

  useEffect(()=>{
    setOptions([]);setBudgetChoice(null);setBudgetGames([]);setWheel(null);setMc(null);setMessage('')
    setWheelBase(Math.min(LOTTERIES[game].universe,LOTTERIES[game].minPick+2))
  },[game])

  function chooseTool(next:Tool){
    setTool(next);setMessage('')
    const url=new URL(window.location.href);url.searchParams.set('tool',next);window.history.replaceState({},'',url)
  }

  function explainError(error:unknown){
    const text=error instanceof Error?error.message:String(error)
    if(text.includes('PLAN_REQUIRED'))return'Recurso disponível apenas para Pro/Founders.'
    if(text.includes('RATE_LIMITED'))return'Limite temporário de execuções atingido. Tente novamente em cerca de 1 minuto.'
    if(text.includes('WHEEL_TOO_LARGE'))return'A matriz solicitada ficou grande demais para execução segura.'
    if(text.includes('INVALID_GAMES'))return'O portfólio enviado não passou pela validação do servidor.'
    return text||'Falha ao executar o Gaming Engine.'
  }

  async function runBudget(){setBusy('budget');setMessage('');try{setOptions((await optimizeBudgetServer(game,budget)) as BudgetOption[])}catch(e){setMessage(explainError(e))}finally{setBusy(null)}}
  function selectBudget(option:BudgetOption){setBudgetChoice(option);setBudgetGames(generateBudgetPortfolio(rule,option))}
  async function runWheel(){setBusy('wheel');setMessage('');try{setWheel(await buildWheelServer(game,wheelBase,40))}catch(e){setMessage(explainError(e))}finally{setBusy(null)}}
  async function runMonteCarlo(){setBusy('mc');setMessage('');const games=budgetGames.length?budgetGames:fallbackPortfolio;try{setMc(await monteCarloServer(game,games,12000))}catch(e){setMessage(explainError(e))}finally{setBusy(null)}}

  if(!ready)return <main className={styles.center}>Validando sessão…</main>
  if(!session)return <main className={styles.center}><div><h1>Gaming Labs v2</h1><p>Entre no LotoSmart para acessar os motores server-side.</p><a href="/app">Voltar para entrar</a></div></main>
  if(!ent?.is_pro)return <main className={styles.center}><div><h1>Gaming Labs v2</h1><p>Sua conta está no plano Free. Budget, Monte Carlo e Wheeling permanecem protegidos no backend.</p><a href="/app">Voltar ao LotoSmart</a></div></main>

  return <main className={styles.page}>
    <header className={styles.header}>
      <div><small>LOTO<span>SMART</span> • GAMING LABS V2</small><h1>Motores server-side</h1><p>Os motores avançados agora executam fora do navegador e respeitam o entitlement no backend.</p></div>
      <div className={styles.headerActions}><span>{ent.role==='admin'?'ADMIN':ent.plan.toUpperCase()}</span><a href="/app">Voltar ao produto</a></div>
    </header>

    <nav className={styles.games}>{(Object.keys(LOTTERIES) as GameId[]).map(id=><button key={id} className={id===game?styles.active:''} onClick={()=>setGame(id)}>{LOTTERIES[id].name}</button>)}</nav>
    <nav className={styles.tools} aria-label="Motores avançados"><button className={tool==='budget'?styles.activeTool:''} onClick={()=>chooseTool('budget')}>Orçamento</button><button className={tool==='wheel'?styles.activeTool:''} onClick={()=>chooseTool('wheel')}>Wheeling</button><button className={tool==='montecarlo'?styles.activeTool:''} onClick={()=>chooseTool('montecarlo')}>Monte Carlo</button></nav>
    {message&&<div className={styles.message}>{message}</div>}

    {tool==='budget'&&<section className={styles.panel}>
      <div className={styles.title}><div><small>BUDGET OPTIMIZER • SERVER</small><h2>Otimização por orçamento</h2></div><strong>{brl.format(budget)}</strong></div>
      <p>O servidor compara dezenas, quantidade de apostas, custo e equivalência em jogos simples. Não existe promessa de previsão ou prêmio.</p>
      <div className={styles.controls}><input type="number" min={rule.prices[rule.minPick]||1} value={budget} onChange={e=>setBudget(Number(e.target.value)||0)}/><button onClick={runBudget} disabled={busy==='budget'}>{busy==='budget'?'Calculando…':'Calcular no servidor'}</button></div>
      <div className={styles.cards}>{options.map((o,i)=><button key={`${o.picks}-${o.games}`} onClick={()=>selectBudget(o)} className={budgetChoice?.picks===o.picks&&budgetChoice?.games===o.games?styles.selected:''}><small>#{i+1} • {o.label}</small><b>{o.games} × {o.picks} dezenas</b><span>{brl.format(o.cost)} • {integer.format(o.equivalentSimpleBets)} equivalentes</span></button>)}</div>
      {!options.length&&<div className={styles.placeholder}>Informe seu orçamento e peça a análise ao servidor.</div>}
      {budgetGames.length>0&&<div className={styles.result}><b>Portfólio sugerido: {budgetGames.length} jogos</b><p>A estratégia de orçamento foi definida pelo Gaming Engine; as combinações exibidas são materializadas a partir da opção aprovada.</p><button className={styles.secondary} onClick={()=>chooseTool('montecarlo')}>Testar esta carteira no Monte Carlo</button></div>}
    </section>}

    {tool==='wheel'&&<section className={styles.panel}>
      <div className={styles.title}><div><small>WHEELING • SERVER</small><h2>Matriz validada no backend</h2></div>{wheel&&<strong>{wheel.coverage}%</strong>}</div>
      <p>A garantia é sempre condicional à presença das dezenas-alvo dentro da base. A validação enumera os cenários suportados antes de marcar a matriz como validada.</p>
      <div className={styles.controls}><label>Base: <b>{wheelBase}</b></label><input type="range" min={rule.minPick} max={Math.min(rule.universe,rule.minPick+4)} value={wheelBase} onChange={e=>setWheelBase(Number(e.target.value))}/><button onClick={runWheel} disabled={busy==='wheel'}>{busy==='wheel'?'Validando…':'Construir matriz'}</button></div>
      {wheel?<><div className={styles.stats}><Stat label="Jogos" value={String(wheel.tickets.length)}/><Stat label="Cenários" value={integer.format(wheel.scenarios)}/><Stat label="Cobertos" value={integer.format(wheel.covered)}/><Stat label="Status" value={wheel.validated?'VALIDADA':'PARCIAL'}/></div><div className={styles.ticketGrid}>{wheel.tickets.slice(0,12).map((nums,i)=><div key={i}><small>Matriz {String(i+1).padStart(2,'0')}</small><b>{nums.map(n=>String(n).padStart(2,'0')).join(' • ')}</b></div>)}</div></>:<div className={styles.placeholder}>Escolha o tamanho da base e valide a matriz no servidor.</div>}
    </section>}

    {tool==='montecarlo'&&<section className={styles.panel}>
      <div className={styles.title}><div><small>MONTE CARLO • SERVER</small><h2>12.000 sorteios fora do navegador</h2></div>{mc&&<strong>{mc.rate}%</strong>}</div>
      <p>{budgetGames.length?'A carteira escolhida no Budget Optimizer será usada no teste.':'Sem uma carteira de orçamento selecionada, o laboratório usa quatro jogos estruturais mínimos como amostra.'}</p>
      <button className={styles.primary} onClick={runMonteCarlo} disabled={busy==='mc'}>{busy==='mc'?'Simulando 12.000 cenários…':'Rodar Monte Carlo no servidor'}</button>
      {mc?<><div className={styles.stats}><Stat label="Simulações" value={integer.format(mc.simulations)}/><Stat label={`≥ ${rule.targetHits} acertos`} value={integer.format(mc.atLeastTarget)}/><Stat label="Taxa experimental" value={`${mc.rate}%`}/><Stat label="Melhor cartão médio" value={String(mc.bestAvg)}/></div><div className={styles.disclaimer}>Resultado experimental de simulação. Não altera a probabilidade matemática oficial e não prevê o próximo concurso.</div></>:<div className={styles.placeholder}>Execute a simulação para receber as métricas do backend.</div>}
    </section>}

    <footer className={styles.footer}>Entitlement: {ent.source||'unknown'} • Gaming Engine v3 • execução auditável e protegida por plano.</footer>
  </main>
}

function Stat({label,value}:{label:string;value:string}){return <div><small>{label}</small><strong>{value}</strong></div>}
