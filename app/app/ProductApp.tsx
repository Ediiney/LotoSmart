'use client'

import {useEffect,useMemo,useRef,useState} from 'react'
import type {Session} from '@supabase/supabase-js'
import {supabase} from '../../lib/supabase'
import {GameId,LOTTERIES,jackpotOdds} from '../../lib/lotteries'
import {generatePortfolio,metrics} from '../../lib/generator'

type View='portfolio'|'validation'|'data'|'mine'|'metrics'|'alerts'
type Draw={game:GameId;contest_number:number;draw_date:string|null;numbers:number[];estimated_next_prize:number|null;next_contest_number:number|null;next_draw_date:string|null;status:string;confidence:number;source_count:number;updated_at?:string}
type Ticket={id:string;numbers:number[];latest_hits:number|null;latest_prize_tier:string|null;latest_prize_amount:number|null;status:string}
type Portfolio={id:string;game:GameId;contest_number:number;strategy:string;picks_per_game:number;total_cost:number;status:string;created_at:string;tickets?:Ticket[]}
type DrawSource={provider:string;provider_contest_number:number|null;fetched_at:string;source_url:string|null}
type Entitlements={role:string;plan:'free'|'pro'|'founders';source?:string;is_pro:boolean;can_use_budget:boolean;can_use_wheeling:boolean;can_use_monte_carlo:boolean;can_use_validation:boolean;can_use_alerts:boolean;saved_games_limit:number|null}
type NotificationPrefs={result_available:boolean;any_prize:boolean;special_contest:boolean;whatsapp_enabled:boolean;email_enabled:boolean;jackpot_threshold_enabled:boolean;jackpot_threshold:number|null}
type UserProfile={whatsapp_phone_e164:string|null;whatsapp_opt_in_at:string|null}
type ValidationWindow={label:string;from:number;to:number;difference_pp:number}
type ValidationSummary={methodology:string;sample_size:number;baseline_repetitions:number;target_hits:number;structural_target_rate:number;random_target_rate:number;difference_pp:number;difference_ci95:[number,number];structural_best_hits_avg:number;random_best_hits_avg:number;structural_mean_percentile:number;wins:number;ties:number;losses:number;positive_windows:number;total_windows:number;window_differences:ValidationWindow[];evidence:'positive'|'negative'|'inconclusive';interpretation:string}

const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'})
const integer=new Intl.NumberFormat('pt-BR')
const APP_URL='https://lotosmart-ediineys-projects.vercel.app'

function Balls({nums}:{nums:number[]}){return <div className="balls">{nums.map(n=><b key={n}>{String(n).padStart(2,'0')}</b>)}</div>}
function normalizeBrazilPhone(value:string){const digits=value.replace(/\D/g,'');const local=digits.startsWith('55')?digits:`55${digits}`;return local.length>=12&&local.length<=13?`+${local}`:null}

export default function ProductApp(){
  const [session,setSession]=useState<Session|null>(null)
  const [ready,setReady]=useState(false)
  const [ent,setEnt]=useState<Entitlements|null>(null)
  const [game,setGame]=useState<GameId>('lotofacil')
  const [view,setView]=useState<View>('portfolio')
  const [draws,setDraws]=useState<Record<string,Draw>>({})
  const [platform,setPlatform]=useState<any>(null)
  const [sources,setSources]=useState<DrawSource[]>([])
  const [picks,setPicks]=useState(LOTTERIES.lotofacil.minPick)
  const [generated,setGenerated]=useState<number[][]>([])
  const [saving,setSaving]=useState(false)
  const [my,setMy]=useState<Portfolio[]>([])
  const [msg,setMsg]=useState('')

  const [authOpen,setAuthOpen]=useState(false)
  const [authMode,setAuthMode]=useState<'login'|'signup'>('login')
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [confirmPassword,setConfirmPassword]=useState('')
  const [resetMode,setResetMode]=useState(false)
  const [resetSent,setResetSent]=useState(false)
  const [authBusy,setAuthBusy]=useState(false)
  const authLock=useRef(false)

  const [validation,setValidation]=useState<ValidationSummary|null>(null)
  const [validationBusy,setValidationBusy]=useState(false)
  const [validationSample,setValidationSample]=useState(120)

  const [prefs,setPrefs]=useState<NotificationPrefs|null>(null)
  const [profile,setProfile]=useState<UserProfile|null>(null)
  const [waPhone,setWaPhone]=useState('')
  const [waConsent,setWaConsent]=useState(false)
  const [waBusy,setWaBusy]=useState(false)

  const rule=LOTTERIES[game]
  const latest=draws[game]
  const contest=latest?.next_contest_number??(latest?latest.contest_number+1:0)
  const cost=(rule.prices[picks]||0)*4
  const portfolioMetrics=useMemo(()=>generated.length?metrics(generated):null,[generated])

  useEffect(()=>{
    let active=true
    async function syncSession(){
      const {data:{session:next}}=await supabase.auth.getSession();if(!active)return
      setSession(next)
      if(next){const {data}=await supabase.rpc('get_my_entitlements');if(active)setEnt((data||null) as Entitlements|null)}else setEnt(null)
      setReady(true)
    }
    syncSession()
    const {data:{subscription}}=supabase.auth.onAuthStateChange(async(_event,next)=>{if(!active)return;setSession(next);if(next){const {data}=await supabase.rpc('get_my_entitlements');if(active)setEnt((data||null) as Entitlements|null)}else setEnt(null);setReady(true)})
    return()=>{active=false;subscription.unsubscribe()}
  },[])

  useEffect(()=>{loadPublic();const timer=window.setInterval(loadPublic,60000);return()=>window.clearInterval(timer)},[])
  useEffect(()=>{setPicks(LOTTERIES[game].minPick);setGenerated([]);setValidation(null)},[game])
  useEffect(()=>{loadSources()},[game,latest?.contest_number])
  useEffect(()=>{if(session){loadMine();loadNotifications()}else{setMy([]);setPrefs(null);setProfile(null)}},[session])

  async function loadPublic(){
    const [{data:drawData},{data:metricData}]=await Promise.all([supabase.rpc('get_public_latest_draws'),supabase.from('platform_metrics').select('*').single()])
    if(drawData){const map:Record<string,Draw>={};for(const draw of drawData as Draw[])if(!map[draw.game])map[draw.game]=draw;setDraws(map)}
    if(metricData)setPlatform(metricData)
  }

  async function loadSources(){
    if(!latest){setSources([]);return}
    const {data:draw}=await supabase.from('lottery_draws').select('id').eq('game',game).eq('contest_number',latest.contest_number).maybeSingle()
    if(!draw){setSources([]);return}
    const {data}=await supabase.from('draw_sources').select('provider,provider_contest_number,fetched_at,source_url').eq('draw_id',draw.id).order('fetched_at',{ascending:false})
    setSources((data||[]) as DrawSource[])
  }

  async function refreshEntitlements(){if(!session)return;const {data}=await supabase.rpc('get_my_entitlements');if(data)setEnt(data as Entitlements)}

  function openAdvanced(tool:'budget'|'wheel'|'montecarlo',feature:string){
    if(!ent?.is_pro){setMsg(`${feature} faz parte do LotoSmart Pro. Faça upgrade para liberar.`);return}
    window.location.assign(`/app/labs?tool=${tool}`)
  }

  function selectProtected(next:View,feature:string,allowed:boolean){if(!allowed){setMsg(`${feature} faz parte do LotoSmart Pro.`);return}setView(next)}

  function generate(){setGenerated(generatePortfolio(rule,picks,4));setMsg('')}
  async function save(){
    if(!session||!generated.length)return
    setSaving(true);setMsg('')
    const uid=session.user.id
    const {data:portfolio,error}=await supabase.from('portfolios').insert({user_id:uid,game,contest_number:contest,strategy:'coverage',picks_per_game:picks,total_cost:cost,origin:'generated'}).select().single()
    if(error){setSaving(false);setMsg(explainSaveError(error.message));return}
    const rows=generated.map(numbers=>({portfolio_id:portfolio.id,user_id:uid,game,contest_number:contest,numbers,origin:'generated'}))
    const {error:ticketError}=await supabase.from('tickets').insert(rows)
    setSaving(false)
    if(ticketError){setMsg(explainSaveError(ticketError.message));return}
    setMsg('4 jogos salvos no seu histórico.');await loadMine();setView('mine')
  }
  function explainSaveError(text:string){if(text.includes('FREE_PORTFOLIO_CAPACITY_EXCEEDED')||text.includes('FREE_SAVED_GAMES_LIMIT_REACHED'))return`Seu plano Free permite até ${ent?.saved_games_limit??10} jogos salvos. Exclua jogos ou faça upgrade para continuar.`;return text}

  async function loadMine(){
    if(!session)return
    const [{data:portfolios},{data:tickets}]=await Promise.all([supabase.from('portfolios').select('*').eq('user_id',session.user.id).order('created_at',{ascending:false}),supabase.from('tickets').select('*').eq('user_id',session.user.id).order('saved_at',{ascending:false})])
    setMy(((portfolios||[]) as any[]).map(p=>({...p,tickets:(tickets||[]).filter((t:any)=>t.portfolio_id===p.id)})) as Portfolio[])
  }

  async function runValidation(){
    if(!session||!ent?.can_use_validation)return
    setValidationBusy(true);setMsg('')
    try{
      const {data,error}=await supabase.functions.invoke('statistical-validation',{body:{game,sample_size:validationSample,baseline_repetitions:60}})
      if(error){setMsg(error.message||'Falha no Validation Engine.');return}
      if(data?.error){setMsg(data.error==='RATE_LIMITED'?'Limite temporário de backtests atingido. Tente novamente em alguns minutos.':String(data.error));return}
      if(data?.summary)setValidation(data.summary as ValidationSummary)
    }finally{setValidationBusy(false)}
  }

  async function loadNotifications(){
    if(!session)return
    const [{data:prefData},{data:profileData}]=await Promise.all([supabase.from('notification_preferences').select('result_available,any_prize,special_contest,whatsapp_enabled,email_enabled,jackpot_threshold_enabled,jackpot_threshold').eq('user_id',session.user.id).maybeSingle(),supabase.from('profiles').select('whatsapp_phone_e164,whatsapp_opt_in_at').eq('id',session.user.id).maybeSingle()])
    setPrefs(prefData as NotificationPrefs|null);setProfile(profileData as UserProfile|null);setWaPhone((profileData as UserProfile|null)?.whatsapp_phone_e164||'');setWaConsent(Boolean((profileData as UserProfile|null)?.whatsapp_opt_in_at))
  }
  async function setAlertPreference(field:keyof NotificationPrefs,value:boolean){if(!session||!prefs)return;const {error}=await supabase.from('notification_preferences').update({[field]:value}).eq('user_id',session.user.id);if(error){setMsg(error.message);return}setPrefs({...prefs,[field]:value})}
  async function saveWhatsAppSettings(){
    if(!session||!prefs)return
    const normalized=normalizeBrazilPhone(waPhone);if(waConsent&&!normalized){setMsg('Informe um WhatsApp válido com DDD.');return}
    setWaBusy(true);setMsg('')
    try{
      const profileUpdate={whatsapp_phone_e164:waConsent?normalized:null,whatsapp_opt_in_at:waConsent?new Date().toISOString():null}
      const {error:profileError}=await supabase.from('profiles').update(profileUpdate).eq('id',session.user.id);if(profileError){setMsg(profileError.message);return}
      const {error:prefError}=await supabase.from('notification_preferences').update({whatsapp_enabled:waConsent}).eq('user_id',session.user.id);if(prefError){setMsg(prefError.message);return}
      setProfile(profileUpdate);setPrefs({...prefs,whatsapp_enabled:waConsent});setWaPhone(normalized||'');setMsg(waConsent?'WhatsApp salvo em readiness. O envio ficará ativo quando a integração oficial for conectada.':'Alertas por WhatsApp desativados.')
    }finally{setWaBusy(false)}
  }

  async function signIn(){if(authLock.current)return;const clean=email.trim().toLowerCase();if(!/^\S+@\S+\.\S+$/.test(clean)){setMsg('Informe um e-mail válido.');return}if(!password){setMsg('Informe sua senha.');return}authLock.current=true;setAuthBusy(true);setMsg('');try{const {error}=await supabase.auth.signInWithPassword({email:clean,password});if(error){setMsg(error.message.toLowerCase().includes('invalid login')?'E-mail ou senha incorretos.':error.message);return}setAuthOpen(false);setPassword('');setConfirmPassword('');await refreshEntitlements()}finally{authLock.current=false;setAuthBusy(false)}}
  async function signUp(){if(authLock.current)return;const clean=email.trim().toLowerCase();if(!/^\S+@\S+\.\S+$/.test(clean)){setMsg('Informe um e-mail válido.');return}if(password.length<8||!/[A-Za-z]/.test(password)||!(/\d/.test(password))){setMsg('Use ao menos 8 caracteres, com letra e número.');return}if(password!==confirmPassword){setMsg('As senhas não conferem.');return}authLock.current=true;setAuthBusy(true);setMsg('');try{const {data,error}=await supabase.auth.signUp({email:clean,password,options:{emailRedirectTo:APP_URL+'/app'}});if(error){setMsg(error.message);return}if(data.session)setAuthOpen(false);else setMsg('Conta criada. Verifique seu e-mail caso a confirmação esteja habilitada.')}finally{authLock.current=false;setAuthBusy(false)}}
  async function sendReset(){const clean=email.trim().toLowerCase();if(!/^\S+@\S+\.\S+$/.test(clean)){setMsg('Informe o e-mail da sua conta.');return}setAuthBusy(true);setMsg('');try{const {error}=await supabase.auth.resetPasswordForEmail(clean,{redirectTo:`${APP_URL}/auth/update-password`});if(error){setMsg(error.message);return}setResetSent(true);setMsg('Se esse e-mail estiver cadastrado, as instruções de recuperação serão enviadas.')}finally{setAuthBusy(false)}}

  const authModal=authOpen?<div className="modalBackdrop" onClick={()=>!authBusy&&setAuthOpen(false)}><div className="modal" onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>!authBusy&&setAuthOpen(false)}>×</button><p className="eyebrow">CONTA LOTOSMART</p><h2>{resetMode?'Recuperar senha':authMode==='login'?'Entrar':'Criar conta'}</h2>{!resetMode&&<div className="authModes"><button className={authMode==='login'?'selected':''} onClick={()=>{setAuthMode('login');setMsg('')}}>Já tenho conta</button><button className={authMode==='signup'?'selected':''} onClick={()=>{setAuthMode('signup');setMsg('')}}>Criar conta</button></div>}<input className="text" type="email" autoComplete="email" placeholder="voce@email.com" value={email} onChange={e=>setEmail(e.target.value)} disabled={authBusy||resetSent}/>{!resetMode&&<input className="text" type="password" autoComplete={authMode==='login'?'current-password':'new-password'} placeholder="Senha" value={password} onChange={e=>setPassword(e.target.value)} disabled={authBusy}/>} {!resetMode&&authMode==='signup'&&<><input className="text" type="password" autoComplete="new-password" placeholder="Confirme sua senha" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} disabled={authBusy}/><p className="passwordHint">Mínimo de 8 caracteres, com letra e número.</p></>}{!resetMode&&<button className="cta" disabled={authBusy} onClick={authMode==='login'?signIn:signUp}>{authBusy?'Aguarde…':authMode==='login'?'Entrar':'Criar minha conta'}</button>}{resetMode&&!resetSent&&<button className="cta" disabled={authBusy} onClick={sendReset}>{authBusy?'Aguarde…':'Enviar recuperação'}</button>}{authMode==='login'&&!resetMode&&<button className="ghost fullBtn" onClick={()=>{setResetMode(true);setResetSent(false);setMsg('')}}>Esqueci minha senha</button>}{resetMode&&<button className="ghost fullBtn" onClick={()=>{setResetMode(false);setResetSent(false);setMsg('')}}>Voltar para o login</button>}{msg&&<p className="note">{msg}</p>}</div></div>:null

  if(!ready)return <main><div className="loadingBrand">Loto<span>Smart</span></div></main>
  if(!session)return <main className="publicPage"><header><div className="brand">Loto<span>Smart</span><small> V1.20.0</small></div><div className="headActions"><a className="ghost" href="/">Início</a><button className="login" onClick={()=>setAuthOpen(true)}>Entrar / Criar conta</button></div></header><section className="publicHero"><div className="publicCopy"><p className="eyebrow">PROBABILITY ENGINE • MY GAMES • DATA AGENT</p><h1>Seu espaço de estratégia e acompanhamento.</h1><p className="lead">Entre para gerar, salvar, validar e acompanhar seus jogos. Os motores avançados são executados no backend e protegidos pelo seu plano.</p><div className="publicActions"><button className="cta publicCta" onClick={()=>setAuthOpen(true)}>Acessar LotoSmart</button><a className="ghost" href="/">Ver planos</a></div></div><div className="loginCard"><p className="eyebrow">ACESSO LOTOSMART</p><h2>Entre na sua conta</h2><p>Plano, histórico e recursos ficam associados ao seu usuário.</p><button className="cta" onClick={()=>setAuthOpen(true)}>Entrar / Criar conta</button></div></section>{authModal}</main>

  const totalSaved=my.reduce((s,p)=>s+(p.tickets?.length||0),0),checked=my.reduce((s,p)=>s+(p.tickets?.filter(t=>t.status==='checked').length||0),0),awarded=my.reduce((s,p)=>s+(p.tickets?.filter(t=>!!t.latest_prize_tier).length||0),0)

  return <main>
    <header><div className="brand">Loto<span>Smart</span><small> V1.20.0</small></div><div className="headActions"><span className="planRuntimeBadge" data-plan={ent?.plan||'free'}>{ent?.role==='admin'?'ADMIN':(ent?.plan||'free').toUpperCase()}</span>{ent?.role==='admin'&&<a className="ghost" href="/admin">Admin</a>}<span className="email">{session.user.email}</span><button className="ghost" onClick={()=>supabase.auth.signOut()}>Sair</button></div></header>
    <section className="hero"><div><p className="eyebrow">PROBABILITY ENGINE + MY GAMES</p><h1>Matemática para jogar.<br/>Histórico para acompanhar.</h1><p>Gere, salve e acompanhe seus jogos com transparência sobre os dados.</p></div><div className="prize"><small>{latest?.estimated_next_prize?'Prêmio estimado do próximo concurso':'Último concurso disponível'}</small><strong>{latest?.estimated_next_prize?money.format(Number(latest.estimated_next_prize)):`${rule.name} ${latest?.contest_number??'—'}`}</strong><span>{latest?.next_contest_number?`Próximo: ${latest.next_contest_number}`:`Status: ${latest?.status||'aguardando'}`}</span></div></section>
    <nav className="lotTabs">{(Object.keys(LOTTERIES) as GameId[]).map(id=><button key={id} className={game===id?'active':''} onClick={()=>setGame(id)}>{LOTTERIES[id].name}</button>)}</nav>
    <nav className="sections"><button className={view==='portfolio'?'active':''} onClick={()=>setView('portfolio')}>Portfólio</button><button onClick={()=>openAdvanced('budget','Budget Optimizer')}>Orçamento <span className="serverNavBadge">SERVER</span>{!ent?.is_pro?' 🔒':''}</button><button onClick={()=>openAdvanced('wheel','Wheeling Lab')}>Wheeling Lab <span className="serverNavBadge">SERVER</span>{!ent?.is_pro?' 🔒':''}</button><button onClick={()=>openAdvanced('montecarlo','Monte Carlo')}>Monte Carlo <span className="serverNavBadge">SERVER</span>{!ent?.is_pro?' 🔒':''}</button><button className={view==='validation'?'active':''} onClick={()=>selectProtected('validation','Validation Engine',Boolean(ent?.can_use_validation))}>Validation Engine {!ent?.can_use_validation?'🔒':''}</button><button className={view==='data'?'active':''} onClick={()=>setView('data')}>Data Agent</button><button className={view==='mine'?'active':''} onClick={()=>setView('mine')}>Meus Jogos</button><button className={view==='metrics'?'active':''} onClick={()=>setView('metrics')}>LotoSmart em números</button><button className={view==='alerts'?'active':''} onClick={()=>selectProtected('alerts','Alertas inteligentes',Boolean(ent?.can_use_alerts))}>Alertas {!ent?.can_use_alerts?'🔒':''}</button></nav>
    {msg&&<div className="toast">{msg}</div>}

    {view==='portfolio'&&<div className="grid"><section className="panel controls"><h2>Monte sua estratégia</h2><label>Dezenas por jogo <b>{picks}</b></label><input type="range" min={rule.minPick} max={rule.maxPick} value={picks} onChange={e=>setPicks(Number(e.target.value))}/><div className="summary"><div><small>4 jogos</small><strong>{money.format(cost)}</strong></div><div><small>Jackpot por jogo</small><strong>1 em {integer.format(jackpotOdds(rule,picks))}</strong></div></div><button className="cta" onClick={generate}>Gerar 4 jogos</button>{generated.length>0&&<button className="save" onClick={save} disabled={saving}>{saving?'Salvando…':'Salvar em Meus Jogos'}</button>}{!ent?.is_pro&&<p className="note">Plano Free: até {ent?.saved_games_limit??10} jogos salvos.</p>}</section><section className="panel output"><div className="outputHead"><div><p className="eyebrow">CONCURSO {contest||'—'}</p><h2>{generated.length?'Seus 4 jogos':'Pronto para gerar'}</h2></div>{portfolioMetrics&&<div className="metric"><small>Cobertura única</small><strong>{portfolioMetrics.coverage}%</strong></div>}</div>{!generated.length?<div className="empty"><div>4×</div><p>Quatro combinações complementares com menor redundância.</p></div>:<>{generated.map((nums,i)=><div className="gameRow" key={i}><span>JOGO {String(i+1).padStart(2,'0')}</span><Balls nums={nums}/></div>)}<div className="metrics"><div><small>Números únicos</small><b>{portfolioMetrics?.unique}</b></div><div><small>Sobreposição média</small><b>{portfolioMetrics?.overlap}</b></div><div><small>Custo total</small><b>{money.format(cost)}</b></div></div>{ent?.is_pro&&<button className="ghost fullBtn" onClick={()=>openAdvanced('montecarlo','Monte Carlo')}>Testar no Monte Carlo server-side</button>}</>}</section></div>}

    {view==='validation'&&<section className="panel full validationPanel"><div className="outputHead"><div><p className="eyebrow">STATISTICAL VALIDATION ENGINE V5</p><h2>Backtest, estabilidade e incerteza</h2><p className="note">Compara quatro jogos estruturais contra carteiras aleatórias de mesmo custo. É auditoria histórica, não previsão.</p></div>{validation&&<div className={`statusPill evidence-${validation.evidence}`}><small>Evidência</small><strong>{validation.evidence==='positive'?'SINAL POSITIVO':validation.evidence==='negative'?'SINAL NEGATIVO':'INCONCLUSIVO'}</strong></div>}</div><div className="validationControls"><label>Concursos no teste <b>{validationSample}</b></label><input type="range" min="50" max="200" step="10" value={validationSample} onChange={e=>setValidationSample(Number(e.target.value))}/><button className="cta inlineCta" disabled={validationBusy} onClick={runValidation}>{validationBusy?'Executando backtest…':'Rodar validação histórica'}</button></div>{validation?<><div className="validationCompare"><article><span>LotoSmart estrutural</span><strong>{validation.structural_target_rate}%</strong><small>concursos com ao menos {validation.target_hits} acertos</small></article><article><span>Baseline aleatória</span><strong>{validation.random_target_rate}%</strong><small>{validation.baseline_repetitions} carteiras por concurso</small></article><article><span>Diferença histórica</span><strong>{validation.difference_pp>0?'+':''}{validation.difference_pp} p.p.</strong><small>IC95%: {validation.difference_ci95?.[0]} a {validation.difference_ci95?.[1]} p.p.</small></article></div><div className="validationGrid"><div><small>Vitórias</small><strong>{validation.wins}</strong></div><div><small>Empates</small><strong>{validation.ties}</strong></div><div><small>Derrotas</small><strong>{validation.losses}</strong></div><div><small>Janelas positivas</small><strong>{validation.positive_windows}/{validation.total_windows}</strong></div></div><div className="validationDisclaimer"><b>Interpretação</b><p>{validation.interpretation} Nenhum resultado histórico implica maior probabilidade para dezenas futuras.</p></div></>:<div className="empty compact"><div>∑</div><p>Rode o backtest para comparar a estratégia com a baseline aleatória.</p></div>}</section>}

    {view==='data'&&<section className="panel full"><div className="outputHead"><div><p className="eyebrow">DATA AGENT V5</p><h2>Transparência das fontes</h2></div><div className="metric"><small>Confiança</small><strong>{latest?.confidence??0}/100</strong></div></div><div className="validationGrid"><div><small>Modalidade</small><strong>{rule.name}</strong></div><div><small>Concurso usado</small><strong>{latest?.contest_number??'—'}</strong></div><div><small>Status</small><strong className={latest?.status==='confirmed'?'okText':'warnText'}>{latest?.status==='confirmed'?'CONFIRMADO':'PROVISÓRIO'}</strong></div><div><small>Fontes coincidentes</small><strong>{latest?.source_count??0}</strong></div></div>{latest?.numbers?.length?<><h3>Resultado normalizado</h3><Balls nums={latest.numbers}/></>:null}<h3>Fontes registradas</h3><div className="sourceList">{sources.length?sources.map((s,i)=><div key={`${s.provider}-${i}`}><b>{s.provider}</b><span>Concurso {s.provider_contest_number??'—'} • {new Date(s.fetched_at).toLocaleString('pt-BR')}</span></div>):<p className="note">Sem detalhamento persistido para este concurso.</p>}</div></section>}

    {view==='mine'&&<section className="panel full minePanel"><div className="outputHead"><div><p className="eyebrow">MINHA CONTA</p><h2>Meus Jogos</h2></div><div className="miniStats"><span>{totalSaved} salvos</span><span>{checked} conferidos</span><span>{awarded} premiados</span></div></div>{my.length===0?<div className="empty"><p>Você ainda não salvou nenhum portfólio.</p></div>:my.map(p=><article className="savedCard" key={p.id}><div><b>{LOTTERIES[p.game].name} • concurso {p.contest_number}</b><small>{money.format(Number(p.total_cost))} • {new Date(p.created_at).toLocaleDateString('pt-BR')}</small></div><div className="savedTickets">{p.tickets?.map((t,i)=><div key={t.id}><span>Jogo {i+1}</span><Balls nums={t.numbers}/><em>{t.status==='checked'?`${t.latest_hits??0} acertos`:'Aguardando resultado'}</em>{t.latest_prize_amount? <strong>{money.format(Number(t.latest_prize_amount))}</strong>:null}</div>)}</div></article>)}</section>}

    {view==='metrics'&&<section className="panel full"><p className="eyebrow">TRANSPARÊNCIA</p><h2>LotoSmart em números</h2><div className="bigMetrics"><div><strong>{integer.format(Number(platform?.generated_and_saved_games||0))}</strong><span>jogos gerados e salvos</span></div><div><strong>{integer.format(Number(platform?.checked_games||0))}</strong><span>jogos conferidos</span></div><div><strong>{integer.format(Number(platform?.awarded_games||0))}</strong><span>jogos premiados</span></div><div><strong>{money.format(Number(platform?.total_prize_amount||0))}</strong><span>prêmios identificados</span></div></div></section>}

    {view==='alerts'&&<section className="panel full alertsPanel"><div className="outputHead"><div><p className="eyebrow">NOTIFICAÇÕES</p><h2>Alertas inteligentes</h2><p className="note">Preferências já ficam persistidas. WhatsApp continua em readiness até a conexão oficial.</p></div><div className="statusPill"><small>WhatsApp</small><strong className="warnText">PENDING</strong></div></div><div className="alertGrid"><AlertCard title="Resultado disponível" text="Avisar quando o concurso de um jogo salvo for confirmado." active={Boolean(prefs?.result_available)} onClick={()=>prefs&&setAlertPreference('result_available',!prefs.result_available)}/><AlertCard title="Premiação detectada" text="Avisar quando um jogo salvo atingir uma faixa de prêmio identificada." active={Boolean(prefs?.any_prize)} onClick={()=>prefs&&setAlertPreference('any_prize',!prefs.any_prize)}/><AlertCard title="E-mail" text="Canal de notificações por e-mail." active={Boolean(prefs?.email_enabled)} onClick={()=>prefs&&setAlertPreference('email_enabled',!prefs.email_enabled)}/></div><div className="whatsappSetup"><h3>WhatsApp oficial — readiness</h3><p>Você pode deixar o número e consentimento preparados. Nenhuma mensagem será disparada até a integração Meta estar pronta.</p><input className="text" value={waPhone} onChange={e=>setWaPhone(e.target.value)} placeholder="(11) 99999-9999"/><label><input type="checkbox" checked={waConsent} onChange={e=>setWaConsent(e.target.checked)}/> Autorizo alertas do LotoSmart neste número.</label><button className="cta" disabled={waBusy} onClick={saveWhatsAppSettings}>{waBusy?'Salvando…':'Salvar readiness'}</button></div></section>}
  </main>
}

function AlertCard({title,text,active,onClick}:{title:string;text:string;active:boolean;onClick:()=>void}){return <div className="alertCard"><div><b>{title}</b><p>{text}</p></div><button className="ghost fullBtn" onClick={onClick}>{active?'Ativado':'Desativado'}</button></div>}
