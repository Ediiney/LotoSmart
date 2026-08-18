'use client'

import {useEffect,useMemo,useState} from 'react'
import {supabase} from '../../lib/supabase'
import {LOTTERIES,type GameId} from '../../lib/lotteries'
import styles from './saved-games-manager.module.css'

type Portfolio={id:string;game:GameId;contest_number:number;total_cost:number;created_at:string;tickets?:Array<{id:string}>}
type Entitlements={role:string;plan:'free'|'pro'|'founders';saved_games_limit:number|null}

const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'})

export default function SavedGamesManager(){
  const [open,setOpen]=useState(false)
  const [portfolios,setPortfolios]=useState<Portfolio[]>([])
  const [ent,setEnt]=useState<Entitlements|null>(null)
  const [ready,setReady]=useState(false)
  const [busy,setBusy]=useState<string|null>(null)
  const [message,setMessage]=useState('')

  async function load(){
    const {data:{session}}=await supabase.auth.getSession()
    if(!session){setReady(true);setPortfolios([]);setEnt(null);return}
    const [{data:p},{data:t},{data:e}]=await Promise.all([
      supabase.from('portfolios').select('id,game,contest_number,total_cost,created_at').eq('user_id',session.user.id).order('created_at',{ascending:false}),
      supabase.from('tickets').select('id,portfolio_id').eq('user_id',session.user.id),
      supabase.rpc('get_my_entitlements')
    ])
    const tickets=(t||[]) as Array<{id:string;portfolio_id:string}>
    setPortfolios(((p||[]) as Portfolio[]).map(item=>({...item,tickets:tickets.filter(ticket=>ticket.portfolio_id===item.id)})))
    setEnt((e||null) as Entitlements|null)
    setReady(true)
  }

  useEffect(()=>{
    load()
    const {data:{subscription}}=supabase.auth.onAuthStateChange(()=>load())
    return()=>subscription.unsubscribe()
  },[])

  const total=useMemo(()=>portfolios.reduce((sum,p)=>sum+(p.tickets?.length||0),0),[portfolios])
  const limit=ent?.saved_games_limit

  async function remove(id:string){
    if(!window.confirm('Excluir este portfólio e todos os jogos salvos nele?'))return
    setBusy(id);setMessage('')
    try{
      const {error}=await supabase.from('portfolios').delete().eq('id',id)
      if(error){setMessage(error.message);return}
      await load()
      window.dispatchEvent(new CustomEvent('lotosmart:saved-games-changed'))
      setMessage('Portfólio excluído e espaço liberado. Atualizando a visão…')
      window.setTimeout(()=>window.location.reload(),650)
    }finally{setBusy(null)}
  }

  if(!ready||!ent)return null
  return <>
    <button className={styles.fab} onClick={()=>{setOpen(true);load()}} aria-label="Gerenciar jogos salvos">
      <span>Meus jogos</span><b>{limit?`${total}/${limit}`:total}</b>
    </button>
    {open&&<div className={styles.backdrop} onClick={()=>setOpen(false)}>
      <section className={styles.modal} onClick={e=>e.stopPropagation()}>
        <header><div><small>GESTÃO DE CAPACIDADE</small><h2>Jogos salvos</h2><p>{ent.plan==='free'?`Você usa ${total} de ${limit??10} espaços do plano Free.`:`Você possui ${total} jogos salvos.`}</p></div><button onClick={()=>setOpen(false)}>×</button></header>
        {message&&<div className={styles.message}>{message}</div>}
        <div className={styles.list}>
          {portfolios.map(p=><article key={p.id}><div><b>{LOTTERIES[p.game]?.name||p.game} • concurso {p.contest_number}</b><span>{p.tickets?.length||0} jogos • {money.format(Number(p.total_cost||0))} • {new Date(p.created_at).toLocaleDateString('pt-BR')}</span></div><button disabled={busy===p.id} onClick={()=>remove(p.id)}>{busy===p.id?'Excluindo…':'Excluir'}</button></article>)}
          {!portfolios.length&&<p className={styles.empty}>Nenhum portfólio salvo.</p>}
        </div>
        <footer><span>A exclusão é permanente.</span>{ent.plan==='free'&&<a href="/#planos">Ver planos</a>}</footer>
      </section>
    </div>}
  </>
}
