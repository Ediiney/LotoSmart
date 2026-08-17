'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import styles from './admin.module.css'

type Profile={id:string;email:string|null;display_name:string|null;role:string;plan_code:string;created_at:string}
type Subscription={id:string;user_id:string;plan_id:string;status:string;billing_cycle:string|null;created_at:string}
type Transaction={id:string;status:string;gross_amount_brl:number;fee_amount_brl:number;net_amount_brl:number;paid_at:string|null;created_at:string}
type Entry={id:string;entry_type:'income'|'expense';category:string;description:string;amount_brl:number;occurred_on:string;vendor:string|null;recurring:boolean}

const brl=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'})

export default function AdminPage(){
  const [session,setSession]=useState<Session|null>(null)
  const [ready,setReady]=useState(false)
  const [authorized,setAuthorized]=useState(false)
  const [profiles,setProfiles]=useState<Profile[]>([])
  const [subscriptions,setSubscriptions]=useState<Subscription[]>([])
  const [transactions,setTransactions]=useState<Transaction[]>([])
  const [entries,setEntries]=useState<Entry[]>([])
  const [form,setForm]=useState({entry_type:'expense',category:'Infraestrutura',description:'',amount_brl:'',vendor:'',occurred_on:new Date().toISOString().slice(0,10)})
  const [message,setMessage]=useState('')

  useEffect(()=>{
    supabase.auth.getSession().then(({data})=>{
      setSession(data.session)
      setReady(true)
    })
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,next)=>setSession(next))
    return ()=>subscription.unsubscribe()
  },[])

  useEffect(()=>{
    if(session) bootstrap(session)
    else if(ready)setAuthorized(false)
  },[session,ready])

  async function bootstrap(current:Session){
    const {data:me}=await supabase.from('profiles').select('role').eq('id',current.user.id).maybeSingle()
    if(me?.role!=='admin'){setAuthorized(false);return}
    setAuthorized(true)
    await loadAll()
  }

  async function loadAll(){
    const [p,s,t,e]=await Promise.all([
      supabase.from('profiles').select('id,email,display_name,role,plan_code,created_at').order('created_at',{ascending:false}).limit(500),
      supabase.from('subscriptions').select('*').order('created_at',{ascending:false}).limit(500),
      supabase.from('payment_transactions').select('*').order('created_at',{ascending:false}).limit(500),
      supabase.from('financial_entries').select('*').order('occurred_on',{ascending:false}).limit(500)
    ])
    setProfiles((p.data||[]) as Profile[])
    setSubscriptions((s.data||[]) as Subscription[])
    setTransactions((t.data||[]) as Transaction[])
    setEntries((e.data||[]) as Entry[])
  }

  const metrics=useMemo(()=>{
    const paying=new Set(subscriptions.filter(s=>['active','trialing'].includes(s.status)&&s.plan_id!=='free').map(s=>s.user_id)).size
    const founders=new Set(subscriptions.filter(s=>['active','trialing'].includes(s.status)&&s.plan_id==='founders').map(s=>s.user_id)).size
    const paid=transactions.filter(t=>t.status==='paid').reduce((a,t)=>a+Number(t.net_amount_brl||0),0)
    const manualIncome=entries.filter(e=>e.entry_type==='income').reduce((a,e)=>a+Number(e.amount_brl),0)
    const expenses=entries.filter(e=>e.entry_type==='expense').reduce((a,e)=>a+Number(e.amount_brl),0)
    const monthly=subscriptions.filter(s=>s.status==='active'&&s.plan_id==='pro'&&s.billing_cycle==='monthly').length*19.9
    const yearly=subscriptions.filter(s=>s.status==='active'&&s.plan_id==='pro'&&s.billing_cycle==='yearly').length*(199/12)
    return {paying,founders,revenue:paid+manualIncome,expenses,profit:paid+manualIncome-expenses,mrr:monthly+yearly}
  },[subscriptions,transactions,entries])

  async function addEntry(e:FormEvent){
    e.preventDefault()
    setMessage('')
    const amount=Number(form.amount_brl.replace(',','.'))
    if(!form.description.trim()||!Number.isFinite(amount)||amount<=0){
      setMessage('Preencha descrição e valor válido.')
      return
    }
    const {error}=await supabase.from('financial_entries').insert({
      entry_type:form.entry_type,
      category:form.category,
      description:form.description.trim(),
      amount_brl:amount,
      vendor:form.vendor||null,
      occurred_on:form.occurred_on,
      created_by:session?.user.id
    })
    if(error){setMessage(error.message);return}
    setForm({...form,description:'',amount_brl:'',vendor:''})
    setMessage('Lançamento registrado.')
    await loadAll()
  }

  if(!ready)return <main className={styles.center}>Carregando painel...</main>
  if(!session)return <main className={styles.center}><div><h1>Acesso administrativo</h1><p>Entre no LotoSmart antes de abrir o painel.</p><a href="/app">Entrar no produto</a></div></main>
  if(!authorized)return <main className={styles.center}><div><h1>Acesso restrito</h1><p>Sua conta não possui permissão administrativa.</p><a href="/app">Voltar ao LotoSmart</a></div></main>

  return <main className={styles.page}>
    <header>
      <div><p>LOTO<span>SMART</span> • ADMIN</p><h1>Visão do negócio</h1></div>
      <div style={{display:'flex',gap:16}}>
        <a href="/">Abrir site</a>
        <a href="/app">Abrir produto</a>
      </div>
    </header>

    <section className={styles.metrics}>
      <Metric label="Usuários" value={String(profiles.length)}/>
      <Metric label="Assinantes" value={String(metrics.paying)}/>
      <Metric label="Founders" value={`${metrics.founders}/100`}/>
      <Metric label="MRR estimado" value={brl.format(metrics.mrr)}/>
      <Metric label="Receita líquida" value={brl.format(metrics.revenue)}/>
      <Metric label="Custos" value={brl.format(metrics.expenses)}/>
      <Metric label="Resultado" value={brl.format(metrics.profit)}/>
    </section>

    <div className={styles.twoCol}>
      <section className={styles.panel}>
        <h2>Controle de caixa</h2>
        <p>Registre custos de Vercel, Supabase, domínio, WhatsApp, IA, marketing e outras receitas/despesas.</p>
        <form className={styles.form} onSubmit={addEntry}>
          <select value={form.entry_type} onChange={e=>setForm({...form,entry_type:e.target.value})}>
            <option value="expense">Despesa</option>
            <option value="income">Receita</option>
          </select>
          <input value={form.category} onChange={e=>setForm({...form,category:e.target.value})} placeholder="Categoria"/>
          <input value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Descrição"/>
          <input value={form.amount_brl} onChange={e=>setForm({...form,amount_brl:e.target.value})} placeholder="Valor (R$)"/>
          <input value={form.vendor} onChange={e=>setForm({...form,vendor:e.target.value})} placeholder="Fornecedor (opcional)"/>
          <input type="date" value={form.occurred_on} onChange={e=>setForm({...form,occurred_on:e.target.value})}/>
          <button>Registrar lançamento</button>
          {message&&<small>{message}</small>}
        </form>
      </section>

      <section className={styles.panel}>
        <h2>Últimos lançamentos</h2>
        <div className={styles.rows}>
          {entries.slice(0,10).map(e=><div key={e.id}>
            <span><b>{e.description}</b><small>{e.category} • {e.occurred_on}</small></span>
            <strong className={e.entry_type==='expense'?styles.negative:styles.positive}>
              {e.entry_type==='expense'?'-':'+'}{brl.format(Number(e.amount_brl))}
            </strong>
          </div>)}
          {!entries.length&&<p className={styles.empty}>Nenhum lançamento ainda.</p>}
        </div>
      </section>
    </div>

    <section className={styles.panel}>
      <h2>Usuários recentes</h2>
      <div className={styles.table}>
        <div className={styles.tableHead}><span>E-mail</span><span>Perfil</span><span>Plano</span><span>Cadastro</span></div>
        {profiles.slice(0,15).map(p=><div key={p.id}>
          <span>{p.email||'—'}</span><span>{p.role}</span><span>{p.plan_code}</span>
          <span>{new Date(p.created_at).toLocaleDateString('pt-BR')}</span>
        </div>)}
      </div>
    </section>
  </main>
}

function Metric({label,value}:{label:string;value:string}){
  return <div><small>{label}</small><strong>{value}</strong></div>
}
