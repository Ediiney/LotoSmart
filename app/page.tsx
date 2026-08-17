'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { GameId, LOTTERIES, jackpotOdds } from '../lib/lotteries'
import { generatePortfolio, metrics } from '../lib/generator'
import {buildWheel,generateBudgetPortfolio,monteCarlo,optimizeBudget,type BudgetOption,type MonteCarloResult,type WheelResult} from '../lib/advanced'

type Draw = { game: GameId; contest_number: number; draw_date: string | null; numbers: number[]; estimated_next_prize: number | null; next_contest_number: number | null; next_draw_date: string | null; status: string; confidence: number; source_count: number }
type Ticket = { id: string; numbers: number[]; latest_hits: number | null; latest_prize_tier: string | null; latest_prize_amount: number | null; status: string }
type Portfolio = { id: string; game: GameId; contest_number: number; strategy: string; picks_per_game: number; total_cost: number; status: string; created_at: string; tickets?: Ticket[] }
type DrawSource={provider:string;provider_contest_number:number|null;fetched_at:string;source_url:string|null}
type NotificationPrefs={result_available:boolean;any_prize:boolean;special_contest:boolean;whatsapp_enabled:boolean;email_enabled:boolean;jackpot_threshold_enabled:boolean;jackpot_threshold:number|null}
type UserProfile={whatsapp_phone_e164:string|null;whatsapp_opt_in_at:string|null}
type ValidationWindow={label:string;from:number;to:number;difference_pp:number}
type ValidationSummary={methodology:string;sample_size:number;baseline_repetitions:number;target_hits:number;structural_target_rate:number;random_target_rate:number;difference_pp:number;difference_ci95:[number,number];structural_best_hits_avg:number;random_best_hits_avg:number;structural_mean_percentile:number;wins:number;ties:number;losses:number;positive_windows:number;total_windows:number;window_differences:ValidationWindow[];evidence:'positive'|'negative'|'inconclusive';interpretation:string}

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const int = new Intl.NumberFormat('pt-BR')
const APP_URL = 'https://lotosmart-ediineys-projects.vercel.app'

function normalizeBrazilPhone(value:string){
  const digits=value.replace(/\D/g,'')
  const local=digits.startsWith('55')?digits:`55${digits}`
  return local.length>=12&&local.length<=13?`+${local}`:null
}

function Balls({ nums }: { nums: number[] }) {
  return <div className="balls">{nums.map(n => <b key={n}>{String(n).padStart(2, '0')}</b>)}</div>
}

export default function Home() {
  const [game, setGame] = useState<GameId>('lotofacil')
  const [picks, setPicks] = useState(15)
  const [generated, setGenerated] = useState<number[][]>([])
  const [draws, setDraws] = useState<Record<string, Draw>>({})
  const [session, setSession] = useState<Session | null>(null)
  const [sessionReady, setSessionReady] = useState(false)
  const [view, setView] = useState<'portfolio'|'budget'|'wheel'|'montecarlo'|'validation'|'data'|'mine'|'metrics'|'alerts'>('portfolio')
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [resetMode, setResetMode] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [authBusy, setAuthBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [my, setMy] = useState<Portfolio[]>([])
  const [saving, setSaving] = useState(false)
  const [platform, setPlatform] = useState<any>(null)
  const [budget,setBudget]=useState(100)
  const [budgetGames,setBudgetGames]=useState<number[][]>([])
  const [budgetChoice,setBudgetChoice]=useState<BudgetOption|null>(null)
  const [mc,setMc]=useState<MonteCarloResult|null>(null)
  const [wheel,setWheel]=useState<WheelResult|null>(null)
  const [wheelBase,setWheelBase]=useState(LOTTERIES.lotofacil.minPick+2)
  const [sources,setSources]=useState<DrawSource[]>([])
  const [prefs,setPrefs]=useState<NotificationPrefs|null>(null)
  const [profile,setProfile]=useState<UserProfile|null>(null)
  const [waBusy,setWaBusy]=useState(false)
  const [waPhone,setWaPhone]=useState('')
  const [waConsent,setWaConsent]=useState(false)
  const [validation,setValidation]=useState<ValidationSummary|null>(null)
  const [validationBusy,setValidationBusy]=useState(false)
  const [validationSample,setValidationSample]=useState(120)
  const authLock = useRef(false)

  const rule = LOTTERIES[game]
  const portfolioMetrics = useMemo(() => generated.length ? metrics(generated) : null, [generated])
  const latest = draws[game]
  const contest = latest?.next_contest_number ?? (latest ? latest.contest_number + 1 : 0)
  const cost = (rule.prices[picks] || 0) * 4

  useEffect(() => { setPicks(LOTTERIES[game].minPick);setWheelBase(Math.min(LOTTERIES[game].universe,LOTTERIES[game].minPick+2)); setGenerated([]);setBudgetGames([]);setMc(null);setWheel(null);setValidation(null) }, [game])
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setSessionReady(true) })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => { setSession(next); setSessionReady(true) })
    return () => subscription.unsubscribe()
  }, [])
  useEffect(() => { loadPublic(); const timer = setInterval(loadPublic, 60000); return () => clearInterval(timer) }, [])
  useEffect(() => { if (session) { loadMine(); loadNotifications() } else { setMy([]); setPrefs(null); setProfile(null) } }, [session])

  async function loadPublic() {
    const { data } = await supabase.rpc('get_public_latest_draws')
    if (data) {
      const map: Record<string, Draw> = {}
      for (const draw of data as Draw[]) if (!map[draw.game]) map[draw.game] = draw
      setDraws(map)
    }
    const { data: publicMetrics } = await supabase.from('platform_metrics').select('*').single()
    setPlatform(publicMetrics)
      }


  useEffect(()=>{loadSources()},[game,latest?.contest_number])
  async function loadSources(){
    if(!latest){setSources([]);return}
    const {data:draw}=await supabase.from('lottery_draws').select('id').eq('game',game).eq('contest_number',latest.contest_number).maybeSingle()
    if(!draw){setSources([]);return}
    const {data}=await supabase.from('draw_sources').select('provider,provider_contest_number,fetched_at,source_url').eq('draw_id',draw.id).order('fetched_at',{ascending:false})
    setSources((data||[]) as DrawSource[])
  }
  const budgetOptions=useMemo(()=>optimizeBudget(rule,Math.max(0,budget)),[rule,budget])
  function applyBudget(option:BudgetOption){setBudgetChoice(option);setBudgetGames(generateBudgetPortfolio(rule,option))}
  function runMonteCarlo(){const games=generated.length?generated:budgetGames;if(!games.length){setMsg('Gere um portfÃ³lio antes de rodar a simulaÃ§Ã£o.');return}setMc(monteCarlo(rule,games,12000));setView('montecarlo')}
  function runWheel(){setWheel(buildWheel(rule,wheelBase,40))}

  async function runStatisticalValidation(){
    if(!session)return
    setValidationBusy(true);setMsg('')
    try{
      const {data,error}=await supabase.functions.invoke('statistical-validation',{body:{game,sample_size:validationSample,baseline_repetitions:60}})
      if(error){setMsg(`Falha no Validation Engine: ${error.message || 'erro de comunicaÃ§Ã£o com o backend'}`);return}
      if(data?.error){setMsg(`Falha no Validation Engine: ${data.error}`);return}
      if(data?.summary){setValidation(data.summary as ValidationSummary)}
    }finally{setValidationBusy(false)}
  }

  async function signInWithPassword() {
    if (authLock.current) return
    const clean = email.trim().toLowerCase()
    if (!/^\S+@\S+\.\S+$/.test(clean)) { setMsg('Informe um e-mail vÃ¡lido.'); return }
    if (!password) { setMsg('Informe sua senha.'); return }
    authLock.current = true; setAuthBusy(true); setMsg('')
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: clean, password })
      if (error) {
        const text = (error.message || '').toLowerCase()
        if (text.includes('invalid login credentials')) setMsg('E-mail ou senha incorretos. Se sua conta foi criada antes desta versÃ£o, use â€œEsqueci minha senhaâ€.')
        else if (text.includes('email not confirmed')) setMsg('Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.')
        else setMsg(error.message)
        return
      }
      setAuthOpen(false); setPassword(''); setConfirmPassword(''); setResetMode(false); setResetSent(false)
    } finally { authLock.current = false; setAuthBusy(false) }
  }

  async function signUpWithPassword() {
    if (authLock.current) return
    const clean = email.trim().toLowerCase()
    if (!/^\S+@\S+\.\S+$/.test(clean)) { setMsg('Informe um e-mail vÃ¡lido.'); return }
    if (password.length < 8) { setMsg('Sua senha precisa ter pelo menos 8 caracteres.'); return }
    if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) { setMsg('Use pelo menos uma letra e um nÃºmero na senha.'); return }
    if (password !== confirmPassword) { setMsg('As senhas nÃ£o conferem.'); return }
    authLock.current = true; setAuthBusy(true); setMsg('')
    try {
      const { data, error } = await supabase.auth.signUp({
        email: clean,
        password,
        options: { emailRedirectTo: APP_URL }
      })
      if (error) { setMsg(error.message); return }
      if (data.session) {
        setAuthOpen(false)
      } else {
        setMsg('Conta criada. Enviamos um e-mail de confirmaÃ§Ã£o antes do primeiro acesso.')
      }
    } finally { authLock.current = false; setAuthBusy(false) }
  }

  async function sendPasswordReset() {
    if (authLock.current) return
    const clean = email.trim().toLowerCase()
    if (!/^\S+@\S+\.\S+$/.test(clean)) { setMsg('Informe o e-mail da sua conta.'); return }
    authLock.current = true; setAuthBusy(true); setMsg('')
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(clean, { redirectTo: `${APP_URL}/auth/update-password` })
      if (error) { setMsg(error.message); return }
      setResetSent(true)
      setMsg('Se esse e-mail estiver cadastrado, enviaremos as instruÃ§Ãµes para criar uma nova senha.')
    } finally { authLock.current = false; setAuthBusy(false) }
  }

  async function loadNotifications() {
    if (!session) return
    const [{ data: prefData }, { data: profileData }] = await Promise.all([
      supabase.from('notification_preferences').select('result_available,any_prize,special_contest,whatsapp_enabled,email_enabled,jackpot_threshold_enabled,jackpot_threshold').eq('user_id', session.user.id).maybeSingle(),
      supabase.from('profiles').select('whatsapp_phone_e164,whatsapp_opt_in_at').eq('id', session.user.id).maybeSingle()
    ])
    setPrefs(prefData as NotificationPrefs | null)
    setProfile(profileData as UserProfile | null)
    setWaPhone((profileData as UserProfile | null)?.whatsapp_phone_e164 || '')
    setWaConsent(Boolean((profileData as UserProfile | null)?.whatsapp_opt_in_at))
  }

  async function setAlertPreference(field: keyof NotificationPrefs, value: boolean) {
    if (!session || !prefs) return
    const { error } = await supabase.from('notification_preferences').update({ [field]: value }).eq('user_id', session.user.id)
    if (error) { setMsg(error.message); return }
    setPrefs({ ...prefs, [field]: value })
  }

  async function saveWhatsAppSettings() {
    if (!session || !prefs) return
    const normalized = normalizeBrazilPhone(waPhone)
    if (waConsent && !normalized) { setMsg('Informe um WhatsApp vÃ¡lido com DDD. Ex.: (11) 96838-2532.'); return }
    setWaBusy(true); setMsg('')
    try {
      const profileUpdate = {
        whatsapp_phone_e164: waConsent ? normalized : null,
        whatsapp_opt_in_at: waConsent ? new Date().toISOString() : null
      }
      const { error: profileError } = await supabase.from('profiles').update(profileUpdate).eq('id', session.user.id)
      if (profileError) { setMsg(profileError.message); return }
      const { error: prefError } = await supabase.from('notification_preferences').update({ whatsapp_enabled: waConsent }).eq('user_id', session.user.id)
      if (prefError) { setMsg(prefError.message); return }
      setProfile(profileUpdate)
      setPrefs({ ...prefs, whatsapp_enabled: waConsent })
      setWaPhone(normalized || '')
      setMsg(waConsent ? 'WhatsApp salvo. Os alertas serÃ£o enviados quando o provider oficial estiver conectado.' : 'Alertas por WhatsApp desativados.')
    } finally { setWaBusy(false) }
  }

  async function dispatchWhatsApp() {
    if (!session) return
    setWaBusy(true); setMsg('')
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-dispatch', { body: {} })
      if (error) { setMsg('WhatsApp ainda nÃ£o estÃ¡ conectado Ã  conta Meta de produÃ§Ã£o.'); return }
      if (data?.configured === false) { setMsg('Backend do WhatsApp pronto. Falta conectar as credenciais oficiais da Meta.'); return }
      setMsg(data?.processed ? `${data.processed} notificaÃ§Ã£o(Ãµes) processada(s) pelo WhatsApp.` : 'NÃ£o hÃ¡ notificaÃ§Ãµes pendentes para enviar.')
    } finally { setWaBusy(false) }
  }

  async function loadMine() {
    if (!session) return
    const { data: portfolios } = await supabase.from('portfolios').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false })
    const { data: tickets } = await supabase.from('tickets').select('*').eq('user_id', session.user.id).order('saved_at', { ascending: false })
    const result = (portfolios || []).map((portfolio: any) => ({ ...portfolio, tickets: (tickets || []).filter((ticket: any) => ticket.portfolio_id === portfolio.id) }))
    setMy(result as Portfolio[])
  }

  function generate() { setGenerated(generatePortfolio(rule, picks, 4)) }
  async function save() {
    if (!session || !generated.length) return
    setSaving(true)
    const uid = session.user.id
    const { data: portfolio, error } = await supabase.from('portfolios').insert({ user_id: uid, game, contest_number: contest, strategy: 'coverage', picks_per_game: picks, total_cost: cost, origin: 'generated' }).select().single()
    if (error) { setSaving(false); setMsg(error.message); return }
    const rows = generated.map(numbers => ({ portfolio_id: portfolio.id, user_id: uid, game, contest_number: contest, numbers, origin: 'generated' }))
    const { error: ticketError } = await supabase.from('tickets').insert(rows)
    setSaving(false)
    if (ticketError) setMsg(ticketError.message)
    else { setMsg('4 jogos salvos no seu histÃ³rico.'); await loadMine(); setView('mine') }
  }

  const totalSaved = my.reduce((sum, p) => sum + (p.tickets?.length || 0), 0)
  const checked = my.reduce((sum, p) => sum + (p.tickets?.filter(t => t.status === 'checked').length || 0), 0)
  const awarded = my.reduce((sum, p) => sum + (p.tickets?.filter(t => !!t.latest_prize_tier).length || 0), 0)

  const authModal = authOpen ? <div className="modalBackdrop" onClick={() => !authBusy && setAuthOpen(false)}>
    <div className="modal" onClick={e => e.stopPropagation()}>
      <button className="close" onClick={() => !authBusy && setAuthOpen(false)}>Ã—</button>
      <p className="eyebrow">CONTA LOTOSMART</p>
      <h2>{resetMode ? 'Recuperar senha' : authMode === 'login' ? 'Entrar' : 'Criar conta'}</h2>
      {!resetMode && <div className="authModes"><button className={authMode === 'login' ? 'selected' : ''} onClick={() => { setAuthMode('login'); setMsg(''); setPassword(''); setConfirmPassword('') }}>JÃ¡ tenho conta</button><button className={authMode === 'signup' ? 'selected' : ''} onClick={() => { setAuthMode('signup'); setMsg(''); setPassword(''); setConfirmPassword('') }}>Criar conta</button></div>}
      <p>{resetMode ? 'Informe seu e-mail para definir uma nova senha.' : authMode === 'login' ? 'Entre com seu e-mail e senha.' : 'Crie sua conta e confirme seu e-mail uma Ãºnica vez.'}</p>
      <input className="text" type="email" autoComplete="email" placeholder="voce@email.com" value={email} onChange={e => setEmail(e.target.value)} disabled={authBusy || resetSent} />
      {!resetMode && <input className="text" type="password" autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} placeholder="Senha" value={password} onChange={e => setPassword(e.target.value)} disabled={authBusy} />}
      {!resetMode && authMode === 'signup' && <><input className="text" type="password" autoComplete="new-password" placeholder="Confirme sua senha" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} disabled={authBusy} /><p className="passwordHint">MÃ­nimo de 8 caracteres, com letra e nÃºmero.</p></>}
      {!resetMode && <button className="cta" disabled={authBusy} onClick={authMode === 'login' ? signInWithPassword : signUpWithPassword}>{authBusy ? 'Aguardeâ€¦' : authMode === 'login' ? 'Entrar' : 'Criar minha conta'}</button>}
      {resetMode && !resetSent && <button className="cta" disabled={authBusy} onClick={sendPasswordReset}>{authBusy ? 'Aguardeâ€¦' : 'Enviar recuperaÃ§Ã£o'}</button>}
      {authMode === 'login' && !resetMode && <button className="ghost fullBtn" onClick={() => { setResetMode(true); setResetSent(false); setPassword(''); setMsg('') }}>Esqueci minha senha</button>}
      {resetMode && <button className="ghost fullBtn" onClick={() => { setResetMode(false); setResetSent(false); setMsg('') }}>Voltar para o login</button>}
      {msg && <p className="note">{msg}</p>}
    </div>
  </div> : null

  if (!sessionReady) return <main><div className="loadingBrand">Loto<span>Smart</span></div></main>

  if (!session) return <main className="publicPage">
    <header><div className="brand">Loto<span>Smart</span><small> V1.17.2</small></div><button className="login" onClick={() => setAuthOpen(true)}>Entrar / Criar conta</button></header>
    <section className="publicHero">
      <div className="publicCopy"><p className="eyebrow">PROBABILITY ENGINE â€¢ MY GAMES â€¢ DATA AGENT</p><h1>EstratÃ©gia, histÃ³rico e acompanhamento em um sÃ³ lugar.</h1><p className="lead">Consulte concursos recentes e mÃ©tricas pÃºblicas. A criaÃ§Ã£o dos jogos, fechamentos e o histÃ³rico pessoal ficam disponÃ­veis somente apÃ³s o acesso.</p><div className="publicActions"><button className="cta publicCta" onClick={() => setAuthOpen(true)}>Acessar LotoSmart</button><span>Conta protegida por e-mail e senha</span></div></div>
      <div className="loginCard"><p className="eyebrow">ACESSO LOTOSMART</p><h2>Entre para criar seus jogos</h2><p>O principal motor de geraÃ§Ã£o fica protegido dentro da sua conta.</p><button className="cta" onClick={() => setAuthOpen(true)}>Entrar na minha conta</button><div className="featureMini"><span>âœ“ 4 jogos por estratÃ©gia</span><span>âœ“ HistÃ³rico persistente</span><span>âœ“ ConferÃªncia automÃ¡tica</span></div></div>
    </section>
    <section className="publicDraws">{(Object.keys(LOTTERIES) as GameId[]).map(id => { const d = draws[id], r = LOTTERIES[id]; return <article key={id} className="drawCard"><p className="eyebrow">{r.name.toUpperCase()}</p><h3>{d ? `Concurso ${d.contest_number}` : 'Aguardando dados'}</h3><small>{d?.draw_date ? new Date(d.draw_date + 'T12:00:00').toLocaleDateString('pt-BR') : 'Ãšltimo concurso confirmado'}</small>{d?.numbers?.length ? <Balls nums={d.numbers} /> : <div className="drawSkeleton">Dados em atualizaÃ§Ã£o</div>}<div className="drawMeta"><span>{d?.status === 'confirmed' ? 'â— Confirmado' : 'â— ProvisÃ³rio'}</span><span>{d?.estimated_next_prize ? `PrÃ³ximo prÃªmio: ${money.format(Number(d.estimated_next_prize))}` : `PrÃ³ximo concurso: ${d?.next_contest_number ?? 'â€”'}`}</span></div></article> })}</section>
    <section className="publicMetrics"><div><strong>{int.format(Number(platform?.generated_and_saved_games || 0))}</strong><span>jogos gerados e salvos</span></div><div><strong>{int.format(Number(platform?.checked_games || 0))}</strong><span>jogos conferidos</span></div><div><strong>{int.format(Number(platform?.awarded_games || 0))}</strong><span>jogos premiados</span></div><div><strong>{money.format(Number(platform?.total_prize_amount || 0))}</strong><span>prÃªmios identificados</span></div></section>
    <section className="howItWorks"><p className="eyebrow">COMO FUNCIONA</p><h2>O diferencial fica protegido dentro da sua conta.</h2><div className="steps"><div><b>01</b><h3>Entre</h3><p>E-mail e senha, com confirmaÃ§Ã£o de conta.</p></div><div><b>02</b><h3>Gere</h3><p>Quatro combinaÃ§Ãµes complementares.</p></div><div><b>03</b><h3>Salve</h3><p>HistÃ³rico real dos seus jogos.</p></div><div><b>04</b><h3>Acompanhe</h3><p>ConferÃªncia e premiaÃ§Ãµes.</p></div></div></section>
    {authModal}
  </main>

  return <main>
    <header><div className="brand">Loto<span>Smart</span><small> V1.17.2</small></div><div className="headActions"><span className="email">{session.user.email}</span><button className="ghost" onClick={() => supabase.auth.signOut()}>Sair</button></div></header>
    <section className="hero"><div><p className="eyebrow">PROBABILITY ENGINE + MY GAMES</p><h1>MatemÃ¡tica para jogar.<br />HistÃ³rico para acompanhar.</h1><p>Gere, salve e acompanhe seus jogos.</p></div><div className="prize"><small>{latest?.estimated_next_prize ? 'PrÃªmio estimado do prÃ³ximo concurso' : 'Ãšltimo concurso confirmado'}</small><strong>{latest?.estimated_next_prize ? money.format(Number(latest.estimated_next_prize)) : `${rule.name} ${latest?.contest_number ?? 'â€”'}`}</strong><span>{latest?.next_contest_number ? `PrÃ³ximo: ${latest.next_contest_number}` : `Resultado ${latest?.contest_number ?? 'â€”'}`}</span></div></section>
    <nav className="lotTabs">{(Object.keys(LOTTERIES) as GameId[]).map(id => <button key={id} className={game === id ? 'active' : ''} onClick={() => setGame(id)}>{LOTTERIES[id].name}</button>)}</nav>
    <nav className="sections"><button onClick={() => setView('portfolio')} className={view === 'portfolio' ? 'active' : ''}>PortfÃ³lio</button><button onClick={() => setView('budget')} className={view === 'budget' ? 'active' : ''}>OrÃ§amento</button><button onClick={() => setView('wheel')} className={view === 'wheel' ? 'active' : ''}>Wheeling Lab</button><button onClick={() => setView('montecarlo')} className={view === 'montecarlo' ? 'active' : ''}>Monte Carlo</button><button onClick={() => setView('validation')} className={view === 'validation' ? 'active' : ''}>Validation Engine</button><button onClick={() => setView('data')} className={view === 'data' ? 'active' : ''}>Data Agent</button><button onClick={() => setView('mine')} className={view === 'mine' ? 'active' : ''}>Meus Jogos</button><button onClick={() => setView('metrics')} className={view === 'metrics' ? 'active' : ''}>LotoSmart em nÃºmeros</button><button onClick={() => setView('alerts')} className={view === 'alerts' ? 'active' : ''}>Alertas</button></nav>
    {msg && <div className="toast">{msg}</div>}
    {view === 'portfolio' && <div className="grid"><section className="panel controls"><h2>Monte sua estratÃ©gia</h2><label>Dezenas por jogo <b>{picks}</b></label><input type="range" min={rule.minPick} max={rule.maxPick} value={picks} onChange={e => setPicks(Number(e.target.value))} /><div className="summary"><div><small>4 jogos</small><strong>{money.format(cost)}</strong></div><div><small>Jackpot por jogo</small><strong>1 em {int.format(jackpotOdds(rule, picks))}</strong></div></div><button className="cta" onClick={generate}>Gerar 4 jogos</button>{generated.length > 0 && <><button className="save" onClick={save} disabled={saving}>{saving ? 'Salvandoâ€¦' : 'Salvar em Meus Jogos'}</button><button className="ghost fullBtn" onClick={runMonteCarlo}>Simular no Monte Carlo</button></>}</section><section className="panel output"><div className="outputHead"><div><p className="eyebrow">CONCURSO {contest || 'â€”'}</p><h2>{generated.length ? 'Seus 4 jogos' : 'Pronto para gerar'}</h2></div>{portfolioMetrics && <div className="metric"><small>Cobertura Ãºnica</small><strong>{portfolioMetrics.coverage}%</strong></div>}</div>{!generated.length ? <div className="empty"><div>4Ã—</div><p>Quatro combinaÃ§Ãµes complementares com menor redundÃ¢ncia.</p></div> : <>{generated.map((nums, i) => <div className="gameRow" key={i}><span>JOGO {String(i + 1).padStart(2, '0')}</span><Balls nums={nums} /></div>)}<div className="metrics"><div><small>NÃºmeros Ãºnicos</small><b>{portfolioMetrics?.unique}</b></div><div><small>SobreposiÃ§Ã£o mÃ©dia</small><b>{portfolioMetrics?.overlap}</b></div><div><small>Custo total</small><b>{money.format(cost)}</b></div></div></>}</section></div>}

    {view==='budget'&&<section className="panel full"><div className="outputHead"><div><p className="eyebrow">BUDGET OPTIMIZER</p><h2>Quanto vocÃª quer investir?</h2></div><div className="metric"><small>OrÃ§amento</small><strong>{money.format(budget)}</strong></div></div><p className="note">O otimizador compara quantidade de jogos e dezenas marcadas pelo nÃºmero de combinaÃ§Ãµes simples equivalentes compradas pelo orÃ§amento. NÃ£o promete previsÃ£o do sorteio.</p><div className="budgetInput"><label>Valor disponÃ­vel</label><input className="text" type="number" min="3" step="1" value={budget} onChange={e=>setBudget(Number(e.target.value)||0)}/></div><div className="optionGrid">{budgetOptions.length?budgetOptions.map((o,i)=><button key={`${o.picks}-${o.games}`} className={`optionCard ${budgetChoice?.picks===o.picks&&budgetChoice?.games===o.games?'selected':''}`} onClick={()=>applyBudget(o)}><span>#{i+1} â€¢ {o.label}</span><strong>{o.games} jogo{o.games>1?'s':''} Ã— {o.picks} dezenas</strong><small>{money.format(o.cost)} â€¢ {int.format(o.equivalentSimpleBets)} combinaÃ§Ãµes simples equivalentes</small></button>):<div className="empty compact"><p>OrÃ§amento abaixo da aposta mÃ­nima.</p></div>}</div>{budgetGames.length>0&&<div className="budgetResult"><h3>PortfÃ³lio sugerido</h3>{budgetGames.slice(0,12).map((nums,i)=><div className="gameRow" key={i}><span>JOGO {String(i+1).padStart(2,'0')}</span><Balls nums={nums}/></div>)}{budgetGames.length>12&&<p className="note">Exibindo 12 de {budgetGames.length} jogos sugeridos.</p>}<button className="ghost fullBtn" onClick={()=>{setGenerated(budgetGames);setPicks(budgetChoice?.picks||rule.minPick);setView('portfolio')}}>Levar para PortfÃ³lio</button></div>}</section>}
    {view==='wheel'&&<section className="panel full"><div className="outputHead"><div><p className="eyebrow">WHEELING + VALIDATION AGENT</p><h2>Fechamento auditÃ¡vel</h2></div>{wheel&&<div className="metric"><small>Cobertura</small><strong>{wheel.coverage}%</strong></div>}</div><p className="note">A garantia Ã© condicional: considera que as dezenas-alvo estÃ£o dentro da base selecionada. SÃ³ mostramos â€œvalidadaâ€ quando todos os cenÃ¡rios enumerados forem cobertos.</p><label className="rangeLabel">Dezenas-base <b>{wheelBase}</b></label><input type="range" min={rule.minPick} max={Math.min(rule.universe,rule.minPick+4)} value={wheelBase} onChange={e=>setWheelBase(Number(e.target.value))}/><button className="cta inlineCta" onClick={runWheel}>Construir e validar matriz</button>{wheel&&<><div className="validationGrid"><div><small>Base</small><strong>{wheel.base.length} dezenas</strong></div><div><small>Jogos da matriz</small><strong>{wheel.tickets.length}</strong></div><div><small>CenÃ¡rios</small><strong>{int.format(wheel.covered)} / {int.format(wheel.scenarios)}</strong></div><div><small>Status</small><strong className={wheel.validated?'okText':'warnText'}>{wheel.validated?'GARANTIA VALIDADA':'COBERTURA PARCIAL'}</strong></div></div><div className="wheelTickets">{wheel.tickets.slice(0,16).map((nums,i)=><div className="gameRow" key={i}><span>MATRIZ {String(i+1).padStart(2,'0')}</span><Balls nums={nums}/></div>)}</div></>}</section>}
    {view==='montecarlo'&&<section className="panel full"><div className="outputHead"><div><p className="eyebrow">MONTE CARLO AGENT</p><h2>Teste experimental do portfÃ³lio</h2></div>{mc&&<div className="metric"><small>{rule.targetHits}+ acertos</small><strong>{mc.rate}%</strong></div>}</div><p className="note">SimulaÃ§Ã£o independente; nÃ£o altera a probabilidade matemÃ¡tica oficial e nÃ£o prevÃª o prÃ³ximo resultado.</p><button className="cta inlineCta" onClick={runMonteCarlo}>Rodar 12.000 sorteios</button>{mc?<div className="validationGrid"><div><small>SimulaÃ§Ãµes</small><strong>{int.format(mc.simulations)}</strong></div><div><small>Ao menos {rule.targetHits} acertos</small><strong>{int.format(mc.atLeastTarget)}</strong></div><div><small>Taxa experimental</small><strong>{mc.rate}%</strong></div><div><small>Melhor cartÃ£o mÃ©dio</small><strong>{mc.bestAvg} acertos</strong></div></div>:<div className="empty compact"><p>Use os jogos do PortfÃ³lio ou do Budget Optimizer e rode a simulaÃ§Ã£o.</p></div>}</section>}
    {view==='validation'&&<section className="panel full validationPanel"><div className="outputHead validationHead"><div><p className="eyebrow">STATISTICAL VALIDATION ENGINE V2</p><h2>Backtest, estabilidade e incerteza</h2><p className="note">Compara 4 jogos estruturais com carteiras aleatÃ³rias de mesmo custo em concursos histÃ³ricos. Agora o motor tambÃ©m mede intervalo de confianÃ§a e estabilidade por janelas. Continua sendo auditoria histÃ³rica, nÃ£o previsÃ£o.</p></div>{validation&&<div className={`statusPill evidence-${validation.evidence}`}><small>EvidÃªncia</small><strong>{validation.evidence==='positive'?'SINAL POSITIVO':validation.evidence==='negative'?'SINAL NEGATIVO':'INCONCLUSIVO'}</strong></div>}</div><div className="validationControls"><label>Concursos no teste <b>{validationSample}</b></label><input type="range" min="50" max="200" step="10" value={validationSample} onChange={e=>setValidationSample(Number(e.target.value))}/><button className="cta inlineCta" disabled={validationBusy} onClick={runStatisticalValidation}>{validationBusy?'Executando backtestâ€¦':'Rodar validaÃ§Ã£o histÃ³rica'}</button></div>{validation?<><div className="validationCompare"><article><span>LotoSmart estrutural</span><strong>{validation.structural_target_rate}%</strong><small>concursos com ao menos {validation.target_hits} acertos em um dos 4 jogos</small></article><article><span>Baseline aleatÃ³ria</span><strong>{validation.random_target_rate}%</strong><small>mÃ©dia de {validation.baseline_repetitions} carteiras aleatÃ³rias por concurso</small></article><article className={validation.difference_pp>0?'positiveDelta':validation.difference_pp<0?'negativeDelta':''}><span>DiferenÃ§a histÃ³rica</span><strong>{validation.difference_pp>0?'+':''}{validation.difference_pp} p.p.</strong><small>IC95%: {validation.difference_ci95?.[0]} a {validation.difference_ci95?.[1]} p.p.</small></article></div><div className="validationGrid"><div><small>VitÃ³rias vs mediana aleatÃ³ria</small><strong>{validation.wins}</strong></div><div><small>Empates</small><strong>{validation.ties}</strong></div><div><small>Derrotas</small><strong>{validation.losses}</strong></div><div><small>Janelas positivas</small><strong>{validation.positive_windows}/{validation.total_windows}</strong></div></div><div className="validationGrid"><div><small>Melhor cartÃ£o mÃ©dio â€¢ LotoSmart</small><strong>{validation.structural_best_hits_avg}</strong></div><div><small>Melhor cartÃ£o mÃ©dio â€¢ aleatÃ³rio</small><strong>{validation.random_best_hits_avg}</strong></div><div><small>Percentil estrutural mÃ©dio</small><strong>{validation.structural_mean_percentile}%</strong></div><div><small>Amostra</small><strong>{validation.sample_size} concursos</strong></div></div><div className="stabilityGrid">{validation.window_differences?.map(w=><div key={w.label}><small>{w.label} â€¢ {w.from}â€“{w.to}</small><strong className={w.difference_pp>0?'okText':w.difference_pp<0?'negativeText':''}>{w.difference_pp>0?'+':''}{w.difference_pp} p.p.</strong></div>)}</div><div className="validationDisclaimer"><b>Como interpretar</b><p>{validation.interpretation} â€œSinal positivoâ€ sÃ³ aparece quando o intervalo de 95% da diferenÃ§a histÃ³rica fica acima de zero. â€œInconclusivoâ€ significa que a amostra nÃ£o separa com seguranÃ§a o motor estrutural da baseline. Nenhum dos dois implica maior probabilidade das dezenas futuras.</p></div></>:<div className="empty compact validationEmpty"><div>âˆ‘</div><p>Rode o backtest para comparar o motor estrutural com apostas aleatÃ³rias em atÃ© 200 concursos histÃ³ricos.</p></div>}</section>}

    {view==='data'&&<section className="panel full"><div className="outputHead"><div><p className="eyebrow">DATA AGENT</p><h2>TransparÃªncia das fontes</h2></div><div className="metric"><small>ConfianÃ§a</small><strong>{latest?.confidence??0}/100</strong></div></div><div className="validationGrid"><div><small>Modalidade</small><strong>{rule.name}</strong></div><div><small>Concurso usado</small><strong>{latest?.contest_number??'â€”'}</strong></div><div><small>Status</small><strong className={latest?.status==='confirmed'?'okText':'warnText'}>{latest?.status==='confirmed'?'CONFIRMADO':'PROVISÃ“RIO'}</strong></div><div><small>Fontes coincidentes</small><strong>{latest?.source_count??0}</strong></div></div>{latest?.numbers?.length?<><h3>Resultado normalizado</h3><Balls nums={latest.numbers}/></>:null}<h3>Fontes registradas</h3><div className="sourceList">{sources.length?sources.map((s,i)=><div key={`${s.provider}-${i}`}><b>{s.provider}</b><span>Concurso {s.provider_contest_number??'â€”'} â€¢ {new Date(s.fetched_at).toLocaleString('pt-BR')}</span></div>):<p className="note">NÃ£o hÃ¡ detalhamento de fontes persistido para este concurso. O resultado consolidado acima continua vindo do banco do Data Agent.</p>}</div></section>}

    {view === 'mine' && <section className="panel full minePanel"><div className="outputHead"><div><p className="eyebrow">MINHA CONTA</p><h2>Meus Jogos</h2></div><div className="miniStats"><span>{totalSaved} salvos</span><span>{checked} conferidos</span><span>{awarded} premiados</span></div></div>{my.length === 0 ? <div className="empty"><p>VocÃª ainda nÃ£o salvou nenhum portfÃ³lio.</p></div> : my.map(p => <article className="savedCard" key={p.id}><div><b>{LOTTERIES[p.game].name} â€¢ concurso {p.contest_number}</b><small>{money.format(Number(p.total_cost))}</small></div><div className="savedTickets">{p.tickets?.map((t, i) => <div key={t.id}><span>Jogo {i + 1}</span><Balls nums={t.numbers} /><em>{t.status === 'checked' ? `${t.latest_hits ?? 0} acertos` : 'Aguardando resultado'}</em></div>)}</div></article>)}</section>}
    {view === 'metrics' && <section className="panel full"><p className="eyebrow">TRANSPARÃŠNCIA</p><h2>LotoSmart em nÃºmeros</h2><div className="bigMetrics"><div><strong>{int.format(Number(platform?.generated_and_saved_games || 0))}</strong><span>jogos gerados e salvos</span></div><div><strong>{int.format(Number(platform?.checked_games || 0))}</strong><span>jogos conferidos</span></div><div><strong>{int.format(Number(platform?.awarded_games || 0))}</strong><span>jogos premiados</span></div><div><strong>{money.format(Number(platform?.total_prize_amount || 0))}</strong><span>prÃªmios identificados</span></div></div></section>}
    {view === 'alerts' && <section className="panel full alertsPanel"><div className="outputHead alertsHead"><div><p className="eyebrow">NOTIFICAÃ‡Ã•ES</p><h2>Alertas inteligentes</h2><p className="note">O Checker Agent confere jogos salvos automaticamente. Os alertas usam somente eventos reais persistidos no banco.</p></div><div className="statusPill"><small>WhatsApp</small><strong className={prefs?.whatsapp_enabled&&profile?.whatsapp_opt_in_at?'okText':'warnText'}>{prefs?.whatsapp_enabled&&profile?.whatsapp_opt_in_at?'CONFIGURADO':'NÃƒO CONFIGURADO'}</strong></div></div><div className="alertGrid"><div className="alertCard"><div><b>Resultado disponÃ­vel</b><p>Notificar quando o concurso de um jogo salvo for confirmado.</p></div><button className="ghost fullBtn" onClick={()=>prefs&&setAlertPreference('result_available',!prefs.result_available)}>{prefs?.result_available?'Ativado':'Desativado'}</button></div><div className="alertCard"><div><b>PremiaÃ§Ã£o detectada</b><p>Notificar quando um jogo salvo atingir uma faixa de prÃªmio identificada.</p></div><button className="ghost fullBtn" onClick={()=>prefs&&setAlertPreference('any_prize',!prefs.any_prize)}>{prefs?.any_prize?'Ativado':'Desativado'}</button></div><div className="alertCard whatsappCard"><div><b>WhatsApp</b><p>Cadastre o nÃºmero que receberÃ¡ os avisos do seu prÃ³prio histÃ³rico.</p></div><input className="text" inputMode="tel" placeholder="(11) 96838-2532" value={waPhone} onChange={e=>setWaPhone(e.target.value)} disabled={waBusy}/><label className="consentRow"><input type="checkbox" checked={waConsent} onChange={e=>setWaConsent(e.target.checked)} disabled={waBusy}/><span>Aceito receber alertas transacionais do LotoSmart pelo WhatsApp.</span></label><button className="ghost fullBtn" disabled={waBusy} onClick={saveWhatsAppSettings}>{waBusy?'Salvandoâ€¦':waConsent?'Salvar WhatsApp':'Desativar WhatsApp'}</button></div></div><div className="integrationStatus"><div><p className="eyebrow">STATUS DO CANAL</p><h3>Backend preparado, provider desacoplado</h3><p className="note">Checker Agent, fila e webhook estÃ£o ativos. Enquanto a conta Meta estiver bloqueada, nenhuma mensagem externa serÃ¡ enviada. Assim que o provider oficial for conectado, os usuÃ¡rios que deram opt-in passam a receber os alertas sem mudanÃ§a no restante da aplicaÃ§Ã£o.</p></div><button className="cta testQueueBtn" disabled={waBusy} onClick={dispatchWhatsApp}>{waBusy?'Processandoâ€¦':'Testar fila'}</button></div></section>}
    {latest?.numbers?.length > 0 && <section className="last"><div><p className="eyebrow">ÃšLTIMO RESULTADO CONFIRMADO</p><h3>{rule.name} â€¢ concurso {latest.contest_number}</h3></div><Balls nums={latest.numbers} /></section>}
  </main>
}

