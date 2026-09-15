'use client'

import {useEffect,useMemo,useState} from 'react'
import type {Session} from '@supabase/supabase-js'
import {supabase} from '../../lib/supabase'
import {GameId,LOTTERIES,jackpotOdds} from '../../lib/lotteries'
import {generatePortfolio,metrics} from '../../lib/generator'
import type {PublicDraw} from '../../lib/public-state-server'
import GameAnalysis from './GameAnalysis'

type View='portfolio'|'mine'
type Draw=PublicDraw
type Ticket={id:string;numbers:number[];latest_hits:number|null;latest_prize_tier:string|null;latest_prize_amount:number|null;status:string}
type Portfolio={id:string;game:GameId;contest_number:number;strategy:string;picks_per_game:number;total_cost:number;status:string;created_at:string;tickets?:Ticket[]}
type Entitlements={role:string;plan:'none'|'pro'|'founders';source?:string;has_paid_access?:boolean;is_pro:boolean;can_generate?:boolean;can_save_games?:boolean}

const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'})
const integer=new Intl.NumberFormat('pt-BR')
const PRODUCT_VERSION='1.26.0'
const PUBLIC_CACHE='lotosmart-public-state-v1'

function Balls({nums}:{nums:number[]}){return <div className="balls">{nums.map(n=><b key={n}>{String(n).padStart(2,'0')}</b>)}</div>}
function cachedDraws():Record<string,Draw>{try{if(typeof window==='undefined')return{};const raw=localStorage.getItem(PUBLIC_CACHE);if(!raw)return{};const state=JSON.parse(raw) as {draws?:Draw[]};const map:Record<string,Draw>={};for(const d of state.draws||[])map[d.game]=d;return map}catch{return{}}}

export default function ProductApp({initialSession,initialEntitlements}:{initialSession:Session;initialEntitlements:Entitlements}){
  const session=initialSession
  const ent=initialEntitlements
  const [game,setGame]=useState<GameId>('lotofacil')
  const [view,setView]=useState<View>('portfolio')
  const [draws,setDraws]=useState<Record<string,Draw>>(()=>cachedDraws())
  const [picks,setPicks]=useState(LOTTERIES.lotofacil.minPick)
  const [generated,setGenerated]=useState<number[][]>([])
  const [saving,setSaving]=useState(false)
  const [my,setMy]=useState<Portfolio[]>([])
  const [msg,setMsg]=useState('')

  const rule=LOTTERIES[game]
  const latest=draws[game]
  const contest=latest?.next_contest_number??(latest?latest.contest_number+1:0)
  const cost=(rule.prices[picks]||0)*4
  const portfolioMetrics=useMemo(()=>generated.length?metrics(generated):null,[generated])

  useEffect(()=>{void loadPublic();const timer=window.setInterval(()=>void loadPublic(),60000);return()=>window.clearInterval(timer)},[])
  useEffect(()=>{setPicks(LOTTERIES[game].minPick);setGenerated([])},[game])
  useEffect(()=>{void loadMine()},[session.user.id])

  async function loadPublic(){
    const controller=new AbortController();const timer=window.setTimeout(()=>controller.abort(),4500)
    try{
      const response=await fetch('/api/public-state',{cache:'no-store',signal:controller.signal})
      if(!response.ok)throw new Error('PUBLIC_STATE_FAILED')
      const state=await response.json() as {draws?:Draw[]}
      if(state.draws?.length){const map:Record<string,Draw>={};for(const draw of state.draws)map[draw.game]=draw;setDraws(map);try{localStorage.setItem(PUBLIC_CACHE,JSON.stringify({draws:state.draws,at:Date.now()}))}catch{}}
    }catch{}
    finally{window.clearTimeout(timer)}
  }

  function generate(){
    if(ent.can_generate===false||!(ent.has_paid_access??ent.is_pro)){setMsg('Um plano pago ativo é necessário para gerar jogos.');return}
    setGenerated(generatePortfolio(rule,picks,4));setMsg('')
  }

  async function save(){
    if(!generated.length)return
    if(ent.can_save_games===false||!(ent.has_paid_access??ent.is_pro)){setMsg('Um plano pago ativo é necessário para salvar jogos.');return}
    if(!contest){setMsg('Aguardando o próximo concurso para salvar esses jogos.');return}
    setSaving(true);setMsg('')
    try{
      const {error}=await supabase.rpc('save_generated_portfolio',{p_game:game,p_contest_number:contest,p_picks_per_game:picks,p_total_cost:cost,p_tickets:generated})
      if(error){setMsg(explainSaveError(error.message));return}
      setMsg('Carteira salva em Meus Jogos.');await loadMine();setView('mine')
    }finally{setSaving(false)}
  }

  function explainSaveError(text:string){
    if(text.includes('PAID_PLAN_REQUIRED'))return'Sua assinatura não está ativa para salvar jogos.'
    if(text.includes('INVALID_CONTEST'))return'Não foi possível identificar o concurso de destino.'
    if(text.includes('INVALID_TICKET')||text.includes('INVALID_PICKS')||text.includes('NUMBER_OUT_OF_RANGE')||text.includes('DUPLICATE_NUMBERS')||text.includes('INVALID_COST'))return'Os jogos não passaram pela validação do servidor. Gere uma nova carteira.'
    return'Não foi possível salvar agora. Tente novamente.'
  }

  async function loadMine(){
    const [{data:portfolios},{data:tickets}]=await Promise.all([
      supabase.from('portfolios').select('*').eq('user_id',session.user.id).order('created_at',{ascending:false}),
      supabase.from('tickets').select('*').eq('user_id',session.user.id).order('saved_at',{ascending:false})
    ])
    setMy(((portfolios||[]) as any[]).map(p=>({...p,tickets:(tickets||[]).filter((t:any)=>t.portfolio_id===p.id)})) as Portfolio[])
  }

  const totalSaved=my.reduce((s,p)=>s+(p.tickets?.length||0),0)
  const checked=my.reduce((s,p)=>s+(p.tickets?.filter(t=>t.status==='checked').length||0),0)
  const planLabel=ent.role==='admin'?'ADMIN':ent.plan.toUpperCase()

  return <main>
    <header>
      <a className="brand" href="/app" aria-label="Voltar para a tela inicial" style={{textDecoration:'none',color:'inherit'}}>Loto<span>Smart</span><small> V{PRODUCT_VERSION}</small></a>
      <div className="headActions"><span className="planRuntimeBadge" data-plan={ent.plan}>{planLabel}</span>{ent.role==='admin'&&<a className="ghost" href="/admin">Admin</a>}<span className="email">{session.user.email}</span><button className="ghost" onClick={()=>supabase.auth.signOut()}>Sair</button></div>
    </header>

    <section className="hero"><div><p className="eyebrow">GERAR • SALVAR • ACOMPANHAR</p><h1>Seus jogos, de forma simples.</h1><p>Escolha a loteria, gere sua carteira e acompanhe os jogos salvos.</p></div><div className="prize"><small>{latest?.estimated_next_prize?'Prêmio estimado do próximo concurso':'Dados do concurso'}</small><strong>{latest?.estimated_next_prize?money.format(Number(latest.estimated_next_prize)):`${rule.name} ${latest?.contest_number??'—'}`}</strong><span>{latest?.next_contest_number?`Próximo: ${latest.next_contest_number}`:`Status: ${latest?.status||'sincronizando'}`}</span></div></section>

    <nav className="lotTabs" aria-label="Escolha da loteria">{(Object.keys(LOTTERIES) as GameId[]).map(id=><button key={id} className={game===id?'active':''} onClick={()=>setGame(id)}>{LOTTERIES[id].name}</button>)}</nav>
    <nav className="sections" aria-label="Navegação principal"><button className={view==='portfolio'?'active':''} onClick={()=>setView('portfolio')}>Criar jogos</button><button className={view==='mine'?'active':''} onClick={()=>setView('mine')}>Meus Jogos</button></nav>
    {msg&&<div className="toast" role="status">{msg}</div>}

    {view==='portfolio'&&<div className="grid">
      <section className="panel controls">
        <p className="eyebrow">{rule.name.toUpperCase()}</p><h2>Monte sua carteira</h2>
        <label>Dezenas por jogo <b>{picks}</b></label>
        <input aria-label="Quantidade de dezenas por jogo" type="range" min={rule.minPick} max={rule.maxPick} value={picks} onChange={e=>setPicks(Number(e.target.value))}/>
        <div className="summary"><div><small>4 jogos</small><strong>{money.format(cost)}</strong></div><div><small>Chance da faixa máxima</small><strong>1 em {integer.format(jackpotOdds(rule,picks))}</strong></div></div>
        <button className="cta" onClick={generate}>Gerar 4 jogos</button>
        {generated.length>0&&<button className="save" onClick={save} disabled={saving||!contest}>{saving?'Salvando…':'Salvar em Meus Jogos'}</button>}
        <p className="note">A análise descreve a composição dos jogos. Ela não prevê resultados nem garante premiação.</p>
      </section>

      <section className="panel output">
        <div className="outputHead"><div><p className="eyebrow">CONCURSO {contest||'—'}</p><h2>{generated.length?'Sua carteira':'Pronto para gerar'}</h2></div></div>
        {!generated.length?<div className="empty"><div>4×</div><p>Gere quatro combinações para visualizar, analisar e salvar.</p></div>:<>
          {generated.map((nums,i)=><div className="gameRow" key={i}><span>JOGO {String(i+1).padStart(2,'0')}</span><Balls nums={nums}/></div>)}
          <div className="metrics"><div><small>Números únicos</small><b>{portfolioMetrics?.unique}</b></div><div><small>Sobreposição média</small><b>{portfolioMetrics?.overlap}</b></div><div><small>Custo total</small><b>{money.format(cost)}</b></div></div>
          <GameAnalysis game={game} games={generated}/>
        </>}
      </section>
    </div>}

    {view==='mine'&&<section className="panel full minePanel">
      <div className="outputHead"><div><p className="eyebrow">HISTÓRICO</p><h2>Meus Jogos</h2><p className="note">Acompanhe suas carteiras e os resultados quando forem conferidos.</p></div><div className="miniStats"><span>{totalSaved} jogos salvos</span><span>{checked} conferidos</span></div></div>
      {my.length===0?<div className="empty"><p>Você ainda não salvou nenhum jogo.</p><button className="cta" onClick={()=>setView('portfolio')}>Criar meu primeiro jogo</button></div>:my.map(p=><article className="savedCard" key={p.id}><div><b>{LOTTERIES[p.game].name} • concurso {p.contest_number}</b><small>{money.format(Number(p.total_cost))} • {new Date(p.created_at).toLocaleDateString('pt-BR')}</small></div><div className="savedTickets">{p.tickets?.map((t,i)=><div key={t.id}><span>Jogo {i+1}</span><Balls nums={t.numbers}/><em>{t.status==='checked'?`${t.latest_hits??0} acertos`:'Aguardando resultado'}</em>{t.latest_prize_amount?<strong>{money.format(Number(t.latest_prize_amount))}</strong>:null}</div>)}</div></article>)}
    </section>}

    <footer><span>LotoNex V{PRODUCT_VERSION}</span><span>Resultados oficiais e análise de composição. Sem promessa de previsão.</span></footer>
  </main>
}
