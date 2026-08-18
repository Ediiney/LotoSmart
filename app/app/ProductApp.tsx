'use client'

import {useEffect,useMemo,useState} from 'react'
import type {Session} from '@supabase/supabase-js'
import {supabase} from '../../lib/supabase'
import {GameId,LOTTERIES,jackpotOdds} from '../../lib/lotteries'
import {generatePortfolio,metrics} from '../../lib/generator'
import type {PublicDraw} from '../../lib/public-state-server'

type View='portfolio'|'validation'|'data'|'mine'|'metrics'|'alerts'
type Draw=PublicDraw
type Ticket={id:string;numbers:number[];latest_hits:number|null;latest_prize_tier:string|null;latest_prize_amount:number|null;status:string}
type Portfolio={id:string;game:GameId;contest_number:number;strategy:string;picks_per_game:number;total_cost:number;status:string;created_at:string;tickets?:Ticket[]}
type DrawSource={provider:string;provider_contest_number:number|null;fetched_at:string;source_url:string|null}
type Entitlements={role:string;plan:'none'|'pro'|'founders';source?:string;has_paid_access?:boolean;is_pro:boolean;can_use_budget?:boolean;can_use_wheeling?:boolean;can_use_monte_carlo?:boolean;can_use_validation?:boolean;can_use_alerts?:boolean}
type NotificationPrefs={result_available:boolean;any_prize:boolean;email_enabled:boolean}
type ValidationWindow={label:string;from:number;to:number;difference_pp:number}
type ValidationSummary={methodology:string;sample_size:number;baseline_repetitions:number;target_hits:number;structural_target_rate:number;random_target_rate:number;difference_pp:number;difference_ci95:[number,number];structural_best_hits_avg:number;random_best_hits_avg:number;structural_mean_percentile:number;wins:number;ties:number;losses:number;positive_windows:number;total_windows:number;window_differences:ValidationWindow[];evidence:'positive'|'negative'|'inconclusive';interpretation:string}
type LabsContext={version:1;userId:string;game:GameId;contest:number;picks:number;games:number[][];source:'portfolio'|'saved';portfolioId?:string;createdAt:number}

const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'})
const integer=new Intl.NumberFormat('pt-BR')
const PRODUCT_VERSION='1.21.6'
const LABS_CONTEXT='lotosmart-labs-context-v1'
const PUBLIC_CACHE='lotosmart-public-state-v1'

function Balls({nums}:{nums:number[]}){return <div className="balls">{nums.map(n=><b key={n}>{String(n).padStart(2,'0')}</b>)}</div>}
function cachedDraws():Record<string,Draw>{try{if(typeof window==='undefined')return{};const raw=localStorage.getItem(PUBLIC_CACHE);if(!raw)return{};const state=JSON.parse(raw) as {draws?:Draw[]};const map:Record<string,Draw>={};for(const d of state.draws||[])map[d.game]=d;return map}catch{return{}}}

export default function ProductApp({initialSession,initialEntitlements}:{initialSession:Session;initialEntitlements:Entitlements}){
  const session=initialSession
  const ent=initialEntitlements
  const [game,setGame]=useState<GameId>('lotofacil')
  const [view,setView]=useState<View>('portfolio')
  const [draws,setDraws]=useState<Record<string,Draw>>(()=>cachedDraws())
  const [platform,setPlatform]=useState<any>(null)
  const [sources,setSources]=useState<DrawSource[]>([])
  const [picks,setPicks]=useState(LOTTERIES.lotofacil.minPick)
  const [generated,setGenerated]=useState<number[][]>([])
  const [saving,setSaving]=useState(false)
  const [my,setMy]=useState<Portfolio[]>([])
  const [msg,setMsg]=useState('')
  const [validation,setValidation]=useState<ValidationSummary|null>(null)
  const [validationBusy,setValidationBusy]=useState(false)
  const [validationSample,setValidationSample]=useState(120)
  const [prefs,setPrefs]=useState<NotificationPrefs|null>(null)

  const rule=LOTTERIES[game]
  const latest=draws[game]
  const contest=latest?.next_contest_number??(latest?latest.contest_number+1:0)
  const cost=(rule.prices[picks]||0)*4
  const portfolioMetrics=useMemo(()=>generated.length?metrics(generated):null,[generated])

  useEffect(()=>{void loadPublic();const timer=window.setInterval(()=>void loadPublic(),60000);return()=>window.clearInterval(timer)},[])
  useEffect(()=>{setPicks(LOTTERIES[game].minPick);setGenerated([]);setValidation(null)},[game])
  useEffect(()=>{void loadSources()},[game,latest?.contest_number])
  useEffect(()=>{void loadMine();void loadNotifications()},[session.user.id])

  async function loadPublic(){
    const controller=new AbortController();const timer=window.setTimeout(()=>controller.abort(),4500)
    try{
      const response=await fetch('/api/public-state',{cache:'no-store',signal:controller.signal})
      if(response.ok){const state=await response.json() as {draws?:Draw[]};if(state.draws?.length){const map:Record<string,Draw>={};for(const draw of state.draws)map[draw.game]=draw;setDraws(map);try{const old=JSON.parse(localStorage.getItem(PUBLIC_CACHE)||'{}');localStorage.setItem(PUBLIC_CACHE,JSON.stringify({...old,draws:state.draws,at:Date.now()}))}catch{}}}
    }catch{}
    finally{window.clearTimeout(timer)}
    const {data:metricData}=await supabase.from('platform_metrics').select('*').single()
    if(metricData)setPlatform(metricData)
  }

  async function loadSources(){
    if(!latest){setSources([]);return}
    const {data:draw}=await supabase.from('lottery_draws').select('id').eq('game',game).eq('contest_number',latest.contest_number).maybeSingle()
    if(!draw){setSources([]);return}
    const {data}=await supabase.from('draw_sources').select('provider,provider_contest_number,fetched_at,source_url').eq('draw_id',draw.id).order('fetched_at',{ascending:false})
    setSources((data||[]) as DrawSource[])
  }

  function persistLabsContext(context:LabsContext){try{sessionStorage.setItem(LABS_CONTEXT,JSON.stringify(context))}catch{}}
  function openAdvanced(tool:'budget'|'wheel'|'montecarlo',feature:string){
    if(!(ent.has_paid_access??ent.is_pro)){setMsg(`${feature} exige um plano pago ativo.`);return}
    if(generated.length)persistLabsContext({version:1,userId:session.user.id,game,contest,picks,games:generated,source:'portfolio',createdAt:Date.now()})
    else if(tool==='montecarlo'){try{sessionStorage.removeItem(LABS_CONTEXT)}catch{}}
    window.location.assign(`/app/labs?tool=${tool}`)
  }
  function analyzeSaved(p:Portfolio){if(!p.tickets?.length)return;persistLabsContext({version:1,userId:session.user.id,game:p.game,contest:p.contest_number,picks:p.picks_per_game,games:p.tickets.map(t=>t.numbers),source:'saved',portfolioId:p.id,createdAt:Date.now()});window.location.assign('/app/labs?tool=montecarlo')}
  function selectProtected(next:View,feature:string,allowed:boolean){if(!allowed){setMsg(`${feature} exige um plano pago ativo.`);return}setView(next)}
  function generate(){setGenerated(generatePortfolio(rule,picks,4));setMsg('')}

  async function save(){
    if(!generated.length)return
    if(!contest){setMsg('Aguardando o próximo concurso para salvar esses jogos.');return}
    setSaving(true);setMsg('')
    try{const {error}=await supabase.rpc('save_generated_portfolio',{p_game:game,p_contest_number:contest,p_picks_per_game:picks,p_total_cost:cost,p_tickets:generated});if(error){setMsg(explainSaveError(error.message));return}setMsg('4 jogos salvos no seu histórico.');await loadMine();setView('mine')}finally{setSaving(false)}
  }
  function explainSaveError(text:string){if(text.includes('PAID_PLAN_REQUIRED'))return'Sua assinatura não está ativa para salvar jogos.';if(text.includes('INVALID_CONTEST'))return'Não foi possível identificar o concurso de destino.';if(text.includes('INVALID_TICKET')||text.includes('INVALID_PICKS')||text.includes('NUMBER_OUT_OF_RANGE')||text.includes('DUPLICATE_NUMBERS')||text.includes('INVALID_COST'))return'Os jogos não passaram pela validação do servidor. Gere uma nova carteira.';return text}

  async function loadMine(){
    const [{data:portfolios},{data:tickets}]=await Promise.all([supabase.from('portfolios').select('*').eq('user_id',session.user.id).order('created_at',{ascending:false}),supabase.from('tickets').select('*').eq('user_id',session.user.id).order('saved_at',{ascending:false})])
    setMy(((portfolios||[]) as any[]).map(p=>({...p,tickets:(tickets||[]).filter((t:any)=>t.portfolio_id===p.id)})) as Portfolio[])
  }
  async function runValidation(){
    if(!ent.can_use_validation)return
    setValidationBusy(true);setMsg('')
    try{const {data,error}=await supabase.functions.invoke('statistical-validation',{body:{game,sample_size:validationSample,baseline_repetitions:60}});if(error){setMsg(error.message||'Falha no Validation Engine.');return}if(data?.error){setMsg(data.error==='RATE_LIMITED'?'Limite temporário de backtests atingido. Tente novamente em alguns minutos.':String(data.error));return}if(data?.summary)setValidation(data.summary as ValidationSummary)}finally{setValidationBusy(false)}
  }
  async function loadNotifications(){const {data}=await supabase.from('notification_preferences').select('result_available,any_prize,email_enabled').eq('user_id',session.user.id).maybeSingle();setPrefs(data as NotificationPrefs|null)}
  async function setAlertPreference(field:keyof NotificationPrefs,value:boolean){if(!prefs)return;const {error}=await supabase.from('notification_preferences').update({[field]:value}).eq('user_id',session.user.id);if(error){setMsg(error.message);return}setPrefs({...prefs,[field]:value})}

  const totalSaved=my.reduce((s,p)=>s+(p.tickets?.length||0),0),checked=my.reduce((s,p)=>s+(p.tickets?.filter(t=>t.status==='checked').length||0),0),awarded=my.reduce((s,p)=>s+(p.tickets?.filter(t=>!!t.latest_prize_tier).length||0),0)
  const planLabel=ent.role==='admin'?'ADMIN':ent.plan.toUpperCase()

  return <main>
    <header><div className="brand">Loto<span>Smart</span><small> V{PRODUCT_VERSION}</small></div><div className="headActions"><span className="planRuntimeBadge" data-plan={ent.plan}>{planLabel}</span>{ent.role==='admin'&&<a className="ghost" href="/admin">Admin</a>}<span className="email">{session.user.email}</span><button className="ghost" onClick={()=>supabase.auth.signOut()}>Sair</button></div></header>
    <section className="hero"><div><p className="eyebrow">PROBABILITY ENGINE + MY GAMES</p><h1>Matemática para jogar.<br/>Histórico para acompanhar.</h1><p>Gere, salve e acompanhe seus jogos com transparência sobre os dados.</p></div><div className="prize"><small>{latest?.estimated_next_prize?'Prêmio estimado do próximo concurso':'Último concurso disponível'}</small><strong>{latest?.estimated_next_prize?money.format(Number(latest.estimated_next_prize)):`${rule.name} ${latest?.contest_number??'—'}`}</strong><span>{latest?.next_contest_number?`Próximo: ${latest.next_contest_number}`:`Status: ${latest?.status||'sincronizando'}`}</span></div></section>
    <nav className="lotTabs">{(Object.keys(LOTTERIES) as GameId[]).map(id=><button key={id} className={game===id?'active':''} onClick={()=>setGame(id)}>{LOTTERIES[id].name}</button>)}</nav>
    <nav className="sections"><button className={view==='portfolio'?'active':''} onClick={()=>setView('portfolio')}>Portfólio</button><button onClick={()=>openAdvanced('budget','Budget Optimizer')}>Orçamento <span className="serverNavBadge">SERVER</span></button><button onClick={()=>openAdvanced('wheel','Wheeling Lab')}>Wheeling Lab <span className="serverNavBadge">SERVER</span></button><button onClick={()=>openAdvanced('montecarlo','Monte Carlo')}>Monte Carlo <span className="serverNavBadge">SERVER</span></button><button className={view==='validation'?'active':''} onClick={()=>selectProtected('validation','Validation Engine',Boolean(ent.can_use_validation))}>Validation Engine</button><button className={view==='data'?'active':''} onClick={()=>setView('data')}>Data Agent</button><button className={view==='mine'?'active':''} onClick={()=>setView('mine')}>Meus Jogos</button><button className={view==='metrics'?'active':''} onClick={()=>setView('metrics')}>LotoSmart em números</button><button className={view==='alerts'?'active':''} onClick={()=>selectProtected('alerts','Alertas inteligentes',Boolean(ent.can_use_alerts))}>Alertas</button></nav>
    {msg&&<div className="toast">{msg}</div>}
    {view==='portfolio'&&<div className="grid"><section className="panel controls"><h2>Monte sua estratégia</h2><label>Dezenas por jogo <b>{picks}</b></label><input type="range" min={rule.minPick} max={rule.maxPick} value={picks} onChange={e=>setPicks(Number(e.target.value))}/><div className="summary"><div><small>4 jogos</small><strong>{money.format(cost)}</strong></div><div><small>Jackpot por jogo</small><strong>1 em {integer.format(jackpotOdds(rule,picks))}</strong></div></div><button className="cta" onClick={generate}>Gerar 4 jogos</button>{generated.length>0&&<button className="save" onClick={save} disabled={saving||!contest}>{saving?'Salvando…':'Salvar em Meus Jogos'}</button>}<p className="note">Plano {planLabel}: geração e salvamento liberados.</p></section><section className="panel output"><div className="outputHead"><div><p className="eyebrow">CONCURSO {contest||'—'}</p><h2>{generated.length?'Seus 4 jogos':'Pronto para gerar'}</h2></div>{portfolioMetrics&&<div className="metric"><small>Cobertura única</small><strong>{portfolioMetrics.coverage}%</strong></div>}</div>{!generated.length?<div className="empty"><div>4×</div><p>Quatro combinações complementares com menor redundância.</p></div>:<>{generated.map((nums,i)=><div className="gameRow" key={i}><span>JOGO {String(i+1).padStart(2,'0')}</span><Balls nums={nums}/></div>)}<div className="metrics"><div><small>Números únicos</small><b>{portfolioMetrics?.unique}</b></div><div><small>Sobreposição média</small><b>{portfolioMetrics?.overlap}</b></div><div><small>Custo total</small><b>{money.format(cost)}</b></div></div><button className="ghost fullBtn" onClick={()=>openAdvanced('montecarlo','Monte Carlo')}>Analisar estes jogos no Monte Carlo</button></>}</section></div>}
    {view==='validation'&&<section className="panel full validationPanel"><div className="outputHead"><div><p className="eyebrow">STATISTICAL VALIDATION ENGINE V5</p><h2>Backtest, estabilidade e incerteza</h2><p className="note">Compara quatro jogos estruturais contra carteiras aleatórias de mesmo custo. É auditoria histórica, não previsão.</p></div>{validation&&<div className={`statusPill evidence-${validation.evidence}`}><small>Evidência</small><strong>{validation.evidence==='positive'?'SINAL POSITIVO':validation.evidence==='negative'?'SINAL NEGATIVO':'INCONCLUSIVO'}</strong></div>}</div><div className="validationControls"><label>Concursos no teste <b>{validationSample}</b></label><input type="range" min="50" max="200" step="10" value={validationSample} onChange={e=>setValidationSample(Number(e.target.value))}/><button className="cta inlineCta" disabled={validationBusy} onClick={runValidation}>{validationBusy?'Executando backtest…':'Rodar validação histórica'}</button></div>{validation?<><div className="validationCompare"><article><span>LotoSmart estrutural</span><strong>{validation.structural_target_rate}%</strong><small>concursos com ao menos {validation.target_hits} acertos</small></article><article><span>Baseline aleatória</span><strong>{validation.random_target_rate}%</strong><small>{validation.baseline_repetitions} carteiras por concurso</small></article><article><span>Diferença histórica</span><strong>{validation.difference_pp>0?'+':''}{validation.difference_pp} p.p.</strong><small>IC95%: {validation.difference_ci95?.[0]} a {validation.difference_ci95?.[1]} p.p.</small></article></div><div className="validationGrid"><div><small>Vitórias</small><strong>{validation.wins}</strong></div><div><small>Empates</small><strong>{validation.ties}</strong></div><div><small>Derrotas</small><strong>{validation.losses}</strong></div><div><small>Janelas positivas</small><strong>{validation.positive_windows}/{validation.total_windows}</strong></div></div><div className="validationDisclaimer"><b>Interpretação</b><p>{validation.interpretation} Nenhum resultado histórico implica maior probabilidade para dezenas futuras.</p></div></>:<div className="empty compact"><div>∑</div><p>Rode o backtest para comparar a estratégia com a baseline aleatória.</p></div>}</section>}
    {view==='data'&&<section className="panel full"><div className="outputHead"><div><p className="eyebrow">DATA AGENT V5</p><h2>Transparência das fontes</h2></div><div className="metric"><small>Confiança</small><strong>{latest?.confidence??0}/100</strong></div></div><div className="validationGrid"><div><small>Modalidade</small><strong>{rule.name}</strong></div><div><small>Concurso usado</small><strong>{latest?.contest_number??'—'}</strong></div><div><small>Status</small><strong className={latest?.status==='confirmed'?'okText':'warnText'}>{latest?.status==='confirmed'?'CONFIRMADO':'PROVISÓRIO'}</strong></div><div><small>Fontes coincidentes</small><strong>{latest?.source_count??0}</strong></div></div>{latest?.numbers?.length?<><h3>Resultado normalizado</h3><Balls nums={latest.numbers}/></>:null}<h3>Fontes registradas</h3><div className="sourceList">{sources.length?sources.map((s,i)=><div key={`${s.provider}-${i}`}><b>{s.provider}</b><span>Concurso {s.provider_contest_number??'—'} • {new Date(s.fetched_at).toLocaleString('pt-BR')}</span></div>):<p className="note">Sem detalhamento persistido para este concurso.</p>}</div></section>}
    {view==='mine'&&<section className="panel full minePanel"><div className="outputHead"><div><p className="eyebrow">MINHA CONTA</p><h2>Meus Jogos</h2></div><div className="miniStats"><span>{totalSaved} salvos</span><span>{checked} conferidos</span><span>{awarded} premiados</span></div></div>{my.length===0?<div className="empty"><p>Você ainda não salvou nenhum portfólio.</p></div>:my.map(p=><article className="savedCard" key={p.id}><div><b>{LOTTERIES[p.game].name} • concurso {p.contest_number}</b><small>{money.format(Number(p.total_cost))} • {new Date(p.created_at).toLocaleDateString('pt-BR')}</small></div><div className="savedTickets">{p.tickets?.map((t,i)=><div key={t.id}><span>Jogo {i+1}</span><Balls nums={t.numbers}/><em>{t.status==='checked'?`${t.latest_hits??0} acertos`:'Aguardando resultado'}</em>{t.latest_prize_amount?<strong>{money.format(Number(t.latest_prize_amount))}</strong>:null}</div>)}</div>{p.tickets?.length?<button className="ghost fullBtn" onClick={()=>analyzeSaved(p)}>Analisar este portfólio no Monte Carlo</button>:null}</article>)}</section>}
    {view==='metrics'&&<section className="panel full"><p className="eyebrow">TRANSPARÊNCIA</p><h2>LotoSmart em números</h2><div className="bigMetrics"><div><strong>{integer.format(Number(platform?.generated_and_saved_games||0))}</strong><span>jogos gerados e salvos</span></div><div><strong>{integer.format(Number(platform?.checked_games||0))}</strong><span>jogos conferidos</span></div><div><strong>{integer.format(Number(platform?.awarded_games||0))}</strong><span>jogos premiados</span></div><div><strong>{money.format(Number(platform?.total_prize_amount||0))}</strong><span>prêmios identificados</span></div></div></section>}
    {view==='alerts'&&<section className="panel full alertsPanel"><div className="outputHead"><div><p className="eyebrow">NOTIFICAÇÕES</p><h2>Alertas por e-mail</h2><p className="note">WhatsApp permanece fora desta fase. As preferências de e-mail já ficam persistidas.</p></div></div><div className="alertGrid"><AlertCard title="Resultado disponível" text="Avisar quando o concurso de um jogo salvo for confirmado." active={Boolean(prefs?.result_available)} onClick={()=>prefs&&setAlertPreference('result_available',!prefs.result_available)}/><AlertCard title="Premiação detectada" text="Avisar quando um jogo salvo atingir uma faixa de prêmio identificada." active={Boolean(prefs?.any_prize)} onClick={()=>prefs&&setAlertPreference('any_prize',!prefs.any_prize)}/><AlertCard title="E-mail" text="Canal de notificações por e-mail." active={Boolean(prefs?.email_enabled)} onClick={()=>prefs&&setAlertPreference('email_enabled',!prefs.email_enabled)}/></div></section>}
  </main>
}

function AlertCard({title,text,active,onClick}:{title:string;text:string;active:boolean;onClick:()=>void}){return <div className="alertCard"><div><b>{title}</b><p>{text}</p></div><button className="ghost fullBtn" onClick={onClick}>{active?'Ativado':'Desativado'}</button></div>}
