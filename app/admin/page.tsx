'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import styles from './admin.module.css'

type Profile={id:string;email:string|null;display_name:string|null;role:string;plan_code:string;created_at:string}
type Subscription={id:string;user_id:string;plan_id:string;status:string;billing_cycle:string|null;created_at:string}
type Transaction={id:string;status:string;gross_amount_brl:number;fee_amount_brl:number;net_amount_brl:number;paid_at:string|null;created_at:string}
type Entry={id:string;entry_type:'income'|'expense';category:string;description:string;amount_brl:number;occurred_on:string;vendor:string|null;recurring:boolean}
type HealthDraw={game:string;contest_number:number;status:string;confidence:number;source_count:number;updated_at:string}
type EngineActionHealth={action:string;total:number;success:number;rejected:number;failed:number}
type GamingHealth={version:string;runs_24h:number;success_24h:number;rejected_24h:number;failed_24h:number;avg_latency_ms:number;by_action:EngineActionHealth[];last_errors?:Array<{action:string;status:string;error_code:string;created_at:string}>}
type HealthPayload={ok:boolean;database:string;latency_ms:number;data?:{status:string;missing:string[];stale:string[];provisional?:string[];draws:HealthDraw[]};data_agent?:{status:string;fresh_sources:number};gaming_engine?:GamingHealth;engines?:Record<string,string>;integrations?:Record<string,string>;checked_at:string}
type MockPlan='free'|'pro'|'founders'

const brl=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'})
const gameName:Record<string,string>={megasena:'Mega-Sena',lotofacil:'Lotofácil',quina:'Quina'}
const actionName:Record<string,string>={optimize_budget:'Budget',monte_carlo:'Monte Carlo',build_wheel:'Wheeling'}

export default function AdminPage(){
  const [session,setSession]=useState<Session|null>(null)
  const [ready,setReady]=useState(false)
  const [authorized,setAuthorized]=useState(false)
  const [profiles,setProfiles]=useState<Profile[]>([])
  const [subscriptions,setSubscriptions]=useState<Subscription[]>([])
  const [transactions,setTransactions]=useState<Transaction[]>([])
  const [entries,setEntries]=useState<Entry[]>([])
  const [health,setHealth]=useState<HealthPayload|null>(null)
  const [form,setForm]=useState({entry_type:'expense',category:'Infraestrutura',description:'',amount_brl:'',vendor:'',occurred_on:new Date().toISOString().slice(0,10)})
  const [message,setMessage]=useState('')
  const [planBusy,setPlanBusy]=useState<string|null>(null)

  useEffect(()=>{
    supabase.auth.getSession().then(({data})=>{setSession(data.session);setReady(true)})
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
    const [p,s,t,e,h]=await Promise.all([
      supabase.from('profiles').select('id,email,display_name,role,plan_code,created_at').order('created_at',{ascending:false}).limit(500),
      supabase.from('subscriptions').select('*').order('created_at',{ascending:false}).limit(500),
      supabase.from('payment_transactions').select('*').order('created_at',{ascending:false}).limit(500),
      supabase.from('financial_entries').select('*').order('occurred_on',{ascending:false}).limit(500),
      supabase.functions.invoke('health',{body:{}})
    ])
    setProfiles((p.data||[]) as Profile[])
    setSubscriptions((s.data||[]) as Subscription[])
    setTransactions((t.data||[]) as Transaction[])
    setEntries((e.data||[]) as Entry[])
    if(!h.error&&h.data)setHealth(h.data as HealthPayload)
  }

  const metrics=useMemo(()=>{
    const paying=new Set(subscriptions.filter(s=>['active','trialing'].includes(s.status)&&s.plan_id!=='free').map(s=>s.user_id)).size
    const paid=transactions.filter(t=>t.status==='paid').reduce((a,t)=>a+Number(t.net_amount_brl||0),0)
    const manualIncome=entries.filter(e=>e.entry_type==='income').reduce((a,e)=>a+Number(e.amount_brl),0)
    const expenses=entries.filter(e=>e.entry_type==='expense').reduce((a,e)=>a+Number(e.amount_brl),0)
    const monthly=subscriptions.filter(s=>s.status==='active'&&s.plan_id==='pro'&&s.billing_cycle==='monthly').length*19.9
    const yearly=subscriptions.filter(s=>s.status==='active'&&s.plan_id==='pro'&&s.billing_cycle==='yearly').length*(199/12)
    const free=profiles.filter(p=>p.role!=='admin'&&p.plan_code==='free').length
    const pro=profiles.filter(p=>p.role!=='admin'&&p.plan_code==='pro').length
    const founders=profiles.filter(p=>p.role!=='admin'&&p.plan_code==='founders').length
    const admins=profiles.filter(p=>p.role==='admin').length
    return {paying,free,pro,founders,admins,revenue:paid+manualIncome,expenses,profit:paid+manualIncome-expenses,mrr:monthly+yearly}
  },[profiles,subscriptions,transactions,entries])

  async function addEntry(e:FormEvent){
    e.preventDefault()
    setMessage('')
    const amount=Number(form.amount_brl.replace(',','.'))
    if(!form.description.trim()||!Number.isFinite(amount)||amount<=0){setMessage('Preencha descrição e valor válido.');return}
    const {error}=await supabase.from('financial_entries').insert({entry_type:form.entry_type,category:form.category,description:form.description.trim(),amount_brl:amount,vendor:form.vendor||null,occurred_on:form.occurred_on,created_by:session?.user.id})
    if(error){setMessage(error.message);return}
    setForm({...form,description:'',amount_brl:'',vendor:''})
    setMessage('Lançamento registrado.')
    await loadAll()
  }

  async function setMockPlan(profile:Profile,targetPlan:MockPlan){
    if(profile.role==='admin')return
    setPlanBusy(profile.id);setMessage('')
    try{
      const {error}=await supabase.rpc('admin_mock_set_plan',{target_user:profile.id,target_plan:targetPlan})
      if(error){setMessage(`Não foi possível alterar o plano: ${error.message}`);return}
      setMessage(`${profile.email||'Usuário'} agora está em ${targetPlan.toUpperCase()} no ambiente de teste.`)
      await loadAll()
    }finally{setPlanBusy(null)}
  }

  if(!ready)return <main className={styles.center}>Carregando painel...</main>
  if(!session)return <main className={styles.center}><div><h1>Acesso administrativo</h1><p>Entre no LotoSmart antes de abrir o painel.</p><a href="/app">Entrar no produto</a></div></main>
  if(!authorized)return <main className={styles.center}><div><h1>Acesso restrito</h1><p>Sua conta não possui permissão administrativa.</p><a href="/app">Voltar ao LotoSmart</a></div></main>

  return <main className={styles.page}>
    <header>
      <div><p>LOTO<span>SMART</span> • ADMIN 2.2</p><h1>Visão do negócio</h1></div>
      <div style={{display:'flex',gap:16}}><a href="/">Abrir site</a><a href="/app">Abrir produto</a></div>
    </header>

    {message&&<section className={styles.panel} style={{padding:14,marginBottom:16}}><strong>{message}</strong></section>}

    <section className={styles.metrics}>
      <Metric label="Usuários" value={String(profiles.length)}/>
      <Metric label="Free" value={String(metrics.free)}/>
      <Metric label="Pro (mock/real)" value={String(metrics.pro)}/>
      <Metric label="Founders (mock/real)" value={`${metrics.founders}/100`}/>
      <Metric label="Admins" value={String(metrics.admins)}/>
      <Metric label="Assinantes pagos" value={String(metrics.paying)}/>
      <Metric label="MRR real estimado" value={brl.format(metrics.mrr)}/>
      <Metric label="Receita líquida" value={brl.format(metrics.revenue)}/>
      <Metric label="Custos" value={brl.format(metrics.expenses)}/>
      <Metric label="Resultado" value={brl.format(metrics.profit)}/>
    </section>

    <section className={styles.panel}>
      <div style={{display:'flex',justifyContent:'space-between',gap:16,alignItems:'flex-start',flexWrap:'wrap'}}>
        <div><h2>Saúde da plataforma</h2><p>Leitura consolidada do banco, concursos e engines. Mercado Pago e WhatsApp permanecem em readiness.</p></div>
        <button onClick={loadAll}>Atualizar</button>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12,marginTop:16}}>
        <HealthCard label="Dados" value={(health?.data?.status||'aguardando').toUpperCase()} ok={health?.data?.status==='healthy'}/>
        <HealthCard label="Banco" value={(health?.database||'aguardando').toUpperCase()} ok={health?.database==='ok'}/>
        <HealthCard label="Data Agent" value={`${health?.engines?.data_agent||'aguardando'} • ${health?.data_agent?.status||'unknown'}`} ok={health?.data_agent?.status==='success'}/>
        <HealthCard label="Fontes frescas" value={String(health?.data_agent?.fresh_sources??0)} ok={(health?.data_agent?.fresh_sources??0)>=3}/>
        <HealthCard label="Gaming Engine" value={health?.gaming_engine?.version||health?.engines?.gaming_engine||'aguardando'} ok={health?.gaming_engine?.failed_24h===0}/>
        <HealthCard label="Gaming runs 24h" value={String(health?.gaming_engine?.runs_24h??0)} ok={(health?.gaming_engine?.failed_24h??0)===0}/>
        <HealthCard label="Gaming latência" value={`${health?.gaming_engine?.avg_latency_ms??0} ms`} ok={(health?.gaming_engine?.avg_latency_ms??0)<1500}/>
        <HealthCard label="Validation" value={health?.engines?.validation_engine||'aguardando'} ok={Boolean(health?.engines?.validation_engine)}/>
        <HealthCard label="Mercado Pago" value={health?.integrations?.mercado_pago||'pending'} ok={false}/>
        <HealthCard label="WhatsApp" value={health?.integrations?.whatsapp||'pending'} ok={false}/>
      </div>
      <div className={styles.table} style={{marginTop:18}}>
        <div className={styles.tableHead}><span>Modalidade</span><span>Concurso</span><span>Status</span><span>Fontes</span></div>
        {(health?.data?.draws||[]).map(d=><div key={d.game}><span>{gameName[d.game]||d.game}</span><span>{d.contest_number}</span><span>{d.status} • {d.confidence}%</span><span>{d.source_count}</span></div>)}
      </div>
    </section>

    <section className={styles.panel}>
      <h2>Gaming Engine v2</h2>
      <p>Telemetria das últimas 24 horas. Rejeições de plano/rate limit são separadas de falhas reais do motor.</p>
      <div className={styles.metrics} style={{marginTop:16}}>
        <Metric label="Sucessos" value={String(health?.gaming_engine?.success_24h??0)}/>
        <Metric label="Rejeitados" value={String(health?.gaming_engine?.rejected_24h??0)}/>
        <Metric label="Falhas" value={String(health?.gaming_engine?.failed_24h??0)}/>
        <Metric label="Latência média" value={`${health?.gaming_engine?.avg_latency_ms??0} ms`}/>
      </div>
      <div className={styles.table}>
        <div className={styles.tableHead}><span>Motor</span><span>Execuções</span><span>Sucesso</span><span>Rejeitado / Falha</span></div>
        {(health?.gaming_engine?.by_action||[]).map(a=><div key={a.action}><span>{actionName[a.action]||a.action}</span><span>{a.total}</span><span>{a.success}</span><span>{a.rejected} / {a.failed}</span></div>)}
      </div>
    </section>

    <div className={styles.twoCol}>
      <section className={styles.panel}>
        <h2>Controle de caixa</h2>
        <p>Registre custos de Vercel, Supabase, domínio, IA, marketing e outras receitas/despesas. Integrações ainda não conectadas não entram como custo automático.</p>
        <form className={styles.form} onSubmit={addEntry}>
          <select value={form.entry_type} onChange={e=>setForm({...form,entry_type:e.target.value})}><option value="expense">Despesa</option><option value="income">Receita</option></select>
          <input value={form.category} onChange={e=>setForm({...form,category:e.target.value})} placeholder="Categoria"/>
          <input value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Descrição"/>
          <input value={form.amount_brl} onChange={e=>setForm({...form,amount_brl:e.target.value})} placeholder="Valor (R$)"/>
          <input value={form.vendor} onChange={e=>setForm({...form,vendor:e.target.value})} placeholder="Fornecedor (opcional)"/>
          <input type="date" value={form.occurred_on} onChange={e=>setForm({...form,occurred_on:e.target.value})}/>
          <button>Registrar lançamento</button>
        </form>
      </section>

      <section className={styles.panel}>
        <h2>Últimos lançamentos</h2>
        <div className={styles.rows}>
          {entries.slice(0,10).map(e=><div key={e.id}><span><b>{e.description}</b><small>{e.category} • {e.occurred_on}</small></span><strong className={e.entry_type==='expense'?styles.negative:styles.positive}>{e.entry_type==='expense'?'-':'+'}{brl.format(Number(e.amount_brl))}</strong></div>)}
          {!entries.length&&<p className={styles.empty}>Nenhum lançamento ainda.</p>}
        </div>
      </section>
    </div>

    <section className={styles.panel}>
      <h2>Usuários e QA de planos</h2>
      <p>Os botões abaixo usam apenas o mock administrativo. Eles não contam como assinatura paga e não substituirão uma assinatura real quando o Mercado Pago for conectado.</p>
      <div className={styles.table}>
        <div className={styles.tableHead}><span>E-mail</span><span>Perfil</span><span>Plano / teste</span><span>Cadastro</span></div>
        {profiles.slice(0,50).map(p=><div key={p.id}>
          <span>{p.email||'—'}</span>
          <span>{p.role}</span>
          <span style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
            <b>{p.plan_code}</b>
            {p.role!=='admin'&&(['free','pro','founders'] as MockPlan[]).map(plan=><button key={plan} disabled={planBusy===p.id||p.plan_code===plan} onClick={()=>setMockPlan(p,plan)} style={{padding:'5px 8px',fontSize:10,borderRadius:8}}>{plan}</button>)}
          </span>
          <span>{new Date(p.created_at).toLocaleDateString('pt-BR')}</span>
        </div>)}
      </div>
    </section>
  </main>
}

function Metric({label,value}:{label:string;value:string}){return <div><small>{label}</small><strong>{value}</strong></div>}
function HealthCard({label,value,ok}:{label:string;value:string;ok:boolean}){return <div style={{background:'#08130f',border:'1px solid #173229',borderRadius:14,padding:16}}><small style={{display:'block',opacity:.65}}>{label}</small><strong style={{display:'block',marginTop:6,color:ok?'#5be899':'#d8bd6b'}}>{value}</strong></div>}
