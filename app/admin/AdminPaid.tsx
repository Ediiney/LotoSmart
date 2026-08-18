'use client'

import {FormEvent,useEffect,useMemo,useState} from 'react'
import type {Session} from '@supabase/supabase-js'
import {supabase} from '../../lib/supabase'
import styles from './admin-paid.module.css'

type Profile={id:string;email:string|null;role:string;plan_code:string;created_at:string}
type Subscription={id:string;user_id:string;plan_id:string;status:string;billing_cycle:string|null;provider:string|null;current_period_end:string|null;created_at:string}
type Transaction={status:string;net_amount_brl:number;provider:string|null}
type Entry={id:string;entry_type:'income'|'expense';category:string;description:string;amount_brl:number;occurred_on:string;vendor:string|null}
type HealthPayload={ok:boolean;database:string;data?:{status:string;draws:Array<{game:string;contest_number:number;status:string;confidence:number;source_count:number}>};data_agent?:{status:string;fresh_sources:number};gaming_engine?:{version:string;runs_24h:number;failed_24h:number;avg_latency_ms:number};validation_engine?:{version:string;runs_24h:number;failed_24h:number;avg_latency_ms:number};integrations?:Record<string,string>}
type EffectivePlan='none'|'pro'|'founders'
type Effective={plan:EffectivePlan;source:string;accessUntil:string|null}
const brl=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'})

function subscriptionIsValid(s:Subscription){
 const now=Date.now(),end=s.current_period_end?Date.parse(s.current_period_end):null
 if(s.plan_id==='founders')return ['active','trialing','lifetime'].includes(s.status)&&(end===null||end>now)
 if(s.plan_id==='pro')return ['active','trialing'].includes(s.status)&&end!==null&&end>now
 return false
}

export default function AdminPaid(){
 const[session,setSession]=useState<Session|null>(null),[ready,setReady]=useState(false),[authorized,setAuthorized]=useState(false),[profiles,setProfiles]=useState<Profile[]>([]),[subscriptions,setSubscriptions]=useState<Subscription[]>([]),[transactions,setTransactions]=useState<Transaction[]>([]),[entries,setEntries]=useState<Entry[]>([]),[health,setHealth]=useState<HealthPayload|null>(null),[foundersRemaining,setFoundersRemaining]=useState(100),[message,setMessage]=useState(''),[planBusy,setPlanBusy]=useState<string|null>(null)
 const[form,setForm]=useState({entry_type:'expense',category:'Infraestrutura',description:'',amount_brl:'',vendor:'',occurred_on:new Date().toISOString().slice(0,10)})

 useEffect(()=>{supabase.auth.getSession().then(({data})=>{setSession(data.session);setReady(true)});const{data:{subscription}}=supabase.auth.onAuthStateChange((_e,next)=>setSession(next));return()=>subscription.unsubscribe()},[])
 useEffect(()=>{if(session)void bootstrap(session);else if(ready)setAuthorized(false)},[session,ready])

 async function bootstrap(current:Session){const{data}=await supabase.from('profiles').select('role').eq('id',current.user.id).maybeSingle();if(data?.role!=='admin'){setAuthorized(false);return}setAuthorized(true);await loadAll()}
 async function loadAll(){const[p,s,t,e,h,f]=await Promise.all([supabase.from('profiles').select('id,email,role,plan_code,created_at').order('created_at',{ascending:false}).limit(500),supabase.from('subscriptions').select('id,user_id,plan_id,status,billing_cycle,provider,current_period_end,created_at').order('created_at',{ascending:false}).limit(1000),supabase.from('payment_transactions').select('status,net_amount_brl,provider').limit(1000),supabase.from('financial_entries').select('id,entry_type,category,description,amount_brl,occurred_on,vendor').order('occurred_on',{ascending:false}).limit(500),supabase.functions.invoke('health',{body:{}}),supabase.rpc('founders_remaining')]);setProfiles((p.data||[]) as Profile[]);setSubscriptions((s.data||[]) as Subscription[]);setTransactions((t.data||[]) as Transaction[]);setEntries((e.data||[]) as Entry[]);if(!h.error&&h.data)setHealth(h.data as HealthPayload);if(typeof f.data==='number')setFoundersRemaining(f.data)}

 const effective=useMemo(()=>{const map=new Map<string,Effective>();for(const p of profiles){if(p.role==='admin'){map.set(p.id,{plan:'founders',source:'admin',accessUntil:null});continue}const active=subscriptions.filter(s=>s.user_id===p.id&&subscriptionIsValid(s)).sort((a,b)=>{if(a.plan_id!==b.plan_id)return a.plan_id==='founders'?-1:1;const rank=(x:Subscription)=>x.provider==='manual_pix'?0:x.provider==='mock'?2:1;const r=rank(a)-rank(b);return r||b.created_at.localeCompare(a.created_at)})[0];if(active)map.set(p.id,{plan:active.plan_id as EffectivePlan,source:active.provider==='mock'?'mock':active.provider==='manual_pix'?'manual_pix':'subscription',accessUntil:active.current_period_end});else map.set(p.id,{plan:'none',source:'none',accessUntil:null})}return map},[profiles,subscriptions])

 const metrics=useMemo(()=>{const realActive=subscriptions.filter(s=>s.provider!=='mock'&&subscriptionIsValid(s));const paying=new Set(realActive.map(s=>s.user_id)).size;const proMonthly=realActive.filter(s=>s.plan_id==='pro'&&s.billing_cycle==='monthly').length*49.9;const proYearly=realActive.filter(s=>s.plan_id==='pro'&&s.billing_cycle==='yearly').length*(598.8/12);const paid=transactions.filter(t=>t.status==='paid').reduce((a,t)=>a+Number(t.net_amount_brl||0),0);const income=entries.filter(e=>e.entry_type==='income').reduce((a,e)=>a+Number(e.amount_brl),0),expenses=entries.filter(e=>e.entry_type==='expense').reduce((a,e)=>a+Number(e.amount_brl),0);let none=0,pro=0,founders=0,admins=0;for(const p of profiles){if(p.role==='admin'){admins++;continue}const plan=effective.get(p.id)?.plan||'none';if(plan==='pro')pro++;else if(plan==='founders')founders++;else none++}return{paying,none,pro,founders,admins,mrr:proMonthly+proYearly,revenue:paid+income,expenses,profit:paid+income-expenses}},[profiles,subscriptions,transactions,entries,effective])

 async function setMockPlan(profile:Profile,target:EffectivePlan){if(profile.role==='admin')return;setPlanBusy(profile.id);setMessage('');try{const{error}=await supabase.rpc('admin_mock_set_plan',{target_user:profile.id,target_plan:target});if(error){setMessage(error.message);return}setMessage(`${profile.email||'Usuário'}: ${target==='none'?'SEM PLANO':target.toUpperCase()} aplicado somente no QA.`);await loadAll()}finally{setPlanBusy(null)}}

 async function activatePix(profile:Profile,target:'pro'|'founders'){
  if(profile.role==='admin')return
  const amount=target==='pro'?49.90:149
  const reference=window.prompt(`Confirme que recebeu ${brl.format(amount)} via Pix. Informe a referência/comprovante (opcional):`)
  if(reference===null)return
  if(!window.confirm(`Ativar ${target.toUpperCase()} para ${profile.email||'este usuário'} por ${brl.format(amount)}?`))return
  setPlanBusy(profile.id);setMessage('')
  try{const{data,error}=await supabase.rpc('admin_record_pix_payment',{target_user:profile.id,target_plan:target,paid_amount:amount,payment_reference:reference||null,payment_notes:'Ativação manual pelo Admin durante beta/hypercare'});if(error){setMessage(`Pix não registrado: ${error.message}`);return}const until=(data as any)?.access_until;setMessage(`${profile.email||'Usuário'} ativado em ${target.toUpperCase()} via Pix${until?` até ${new Date(until).toLocaleDateString('pt-BR')}`:' com acesso vitalício'}.`);await loadAll()}finally{setPlanBusy(null)}
 }

 async function revokePix(profile:Profile){if(!window.confirm(`Revogar o acesso manual via Pix de ${profile.email||'este usuário'}?`))return;setPlanBusy(profile.id);setMessage('');try{const{error}=await supabase.rpc('admin_revoke_manual_access',{target_user:profile.id});if(error){setMessage(error.message);return}setMessage(`Acesso manual de ${profile.email||'usuário'} revogado.`);await loadAll()}finally{setPlanBusy(null)}}

 async function addEntry(e:FormEvent){e.preventDefault();const amount=Number(form.amount_brl.replace(',','.'));if(!form.description.trim()||!Number.isFinite(amount)||amount<=0){setMessage('Preencha descrição e valor válido.');return}const{error}=await supabase.from('financial_entries').insert({entry_type:form.entry_type,category:form.category,description:form.description.trim(),amount_brl:amount,vendor:form.vendor||null,occurred_on:form.occurred_on,created_by:session?.user.id});if(error){setMessage(error.message);return}setForm({...form,description:'',amount_brl:'',vendor:''});setMessage('Lançamento registrado.');await loadAll()}

 if(!ready)return <main className={styles.center}>Carregando painel…</main>
 if(!session)return <main className={styles.center}><div><h1>Acesso administrativo</h1><a href="/app">Entrar no produto</a></div></main>
 if(!authorized)return <main className={styles.center}><div><h1>Acesso restrito</h1><a href="/app">Voltar</a></div></main>

 return <main className={styles.page}>
  <header><div><p>LOTOSMART • ADMIN 3.1</p><h1>Visão do negócio</h1></div><div><a href="/">Abrir site</a><a href="/app">Abrir produto</a></div></header>
  {message&&<div className={styles.message}>{message}</div>}
  <section className={styles.metrics}><Metric label="Usuários" value={String(profiles.length)}/><Metric label="Sem plano" value={String(metrics.none)}/><Metric label="Pro" value={String(metrics.pro)}/><Metric label="Founders" value={`${metrics.founders} atribuídos`}/><Metric label="Vagas Founders" value={`${foundersRemaining}/100`}/><Metric label="Admins" value={String(metrics.admins)}/><Metric label="Assinantes pagos reais" value={String(metrics.paying)}/><Metric label="MRR real estimado" value={brl.format(metrics.mrr)}/><Metric label="Receita líquida" value={brl.format(metrics.revenue)}/><Metric label="Custos" value={brl.format(metrics.expenses)}/><Metric label="Resultado" value={brl.format(metrics.profit)}/></section>

  <section className={styles.panel}><div className={styles.panelHead}><div><h2>Regra comercial</h2><p>Pro custa R$ 49,90/mês. Founders custa R$ 149 em pagamento único e consome uma das 100 vagas. Pix manual já pode liberar acesso real; mocks continuam exclusivos para QA.</p></div><button onClick={loadAll}>Atualizar</button></div><div className={styles.priceGrid}><article><small>PRO</small><strong>R$ 49,90</strong><span>30 dias por pagamento Pix</span></article><article><small>FOUNDERS</small><strong>R$ 149</strong><span>pagamento único • {foundersRemaining} vagas</span></article></div></section>

  <section className={styles.panel}><div className={styles.panelHead}><div><h2>Saúde da plataforma</h2><p>Mercado Pago e WhatsApp continuam fora desta liberação beta.</p></div></div><div className={styles.health}><Health label="Banco" value={health?.database||'aguardando'}/><Health label="Dados" value={health?.data?.status||'aguardando'}/><Health label="Data Agent" value={`${health?.data_agent?.status||'unknown'} • ${health?.data_agent?.fresh_sources??0} fontes`}/><Health label="Gaming Engine" value={`${health?.gaming_engine?.version||'—'} • ${health?.gaming_engine?.runs_24h??0} runs`}/><Health label="Validation" value={`${health?.validation_engine?.version||'—'} • ${health?.validation_engine?.runs_24h??0} runs`}/></div></section>

  <section className={styles.panel}><h2>Usuários, Pix e QA</h2><p><b>PIX</b> registra pagamento real e entra na receita. <b>QA</b> apenas simula entitlement e nunca entra no MRR/receita. Não registre o mesmo Pix novamente no Controle de Caixa.</p><div className={styles.table}><div className={styles.tableHead}><span>E-mail</span><span>Perfil</span><span>Plano efetivo</span><span>Ações</span></div>{profiles.map(p=>{const ep=effective.get(p.id)||{plan:'none',source:'none',accessUntil:null};return <div key={p.id}><span>{p.email||'—'}</span><span>{p.role}</span><span><b>{ep.plan==='none'?'SEM PLANO':ep.plan.toUpperCase()}</b><small>{ep.source}{ep.accessUntil?` • até ${new Date(ep.accessUntil).toLocaleDateString('pt-BR')}`:''}</small></span><span className={styles.buttons}>{p.role==='admin'?<em>fixo</em>:<><button disabled={planBusy===p.id} onClick={()=>activatePix(p,'pro')}>PIX Pro</button><button disabled={planBusy===p.id||foundersRemaining<=0} onClick={()=>activatePix(p,'founders')}>PIX Founder</button>{ep.source==='manual_pix'&&<button disabled={planBusy===p.id} onClick={()=>revokePix(p)}>Revogar Pix</button>}<button disabled={planBusy===p.id||ep.plan==='none'} onClick={()=>setMockPlan(p,'none')}>QA none</button><button disabled={planBusy===p.id||ep.plan==='pro'} onClick={()=>setMockPlan(p,'pro')}>QA pro</button><button disabled={planBusy===p.id||ep.plan==='founders'} onClick={()=>setMockPlan(p,'founders')}>QA founder</button></>}</span></div>})}</div></section>

  <div className={styles.twoCol}><section className={styles.panel}><h2>Controle de caixa</h2><p>Use para despesas e receitas externas. Pagamentos Pix ativados acima já entram automaticamente na receita.</p><form className={styles.form} onSubmit={addEntry}><select value={form.entry_type} onChange={e=>setForm({...form,entry_type:e.target.value})}><option value="expense">Despesa</option><option value="income">Receita externa</option></select><input value={form.category} onChange={e=>setForm({...form,category:e.target.value})}/><input value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Descrição"/><input value={form.amount_brl} onChange={e=>setForm({...form,amount_brl:e.target.value})} placeholder="Valor (R$)"/><input value={form.vendor} onChange={e=>setForm({...form,vendor:e.target.value})} placeholder="Fornecedor"/><input type="date" value={form.occurred_on} onChange={e=>setForm({...form,occurred_on:e.target.value})}/><button>Registrar lançamento</button></form></section><section className={styles.panel}><h2>Últimos lançamentos manuais</h2><div className={styles.rows}>{entries.slice(0,10).map(e=><div key={e.id}><span><b>{e.description}</b><small>{e.category} • {e.occurred_on}</small></span><strong>{e.entry_type==='expense'?'-':'+'}{brl.format(Number(e.amount_brl))}</strong></div>)}{!entries.length&&<p>Nenhum lançamento.</p>}</div></section></div>
 </main>
}
function Metric({label,value}:{label:string;value:string}){return <article><small>{label}</small><strong>{value}</strong></article>}
function Health({label,value}:{label:string;value:string}){return <article><small>{label}</small><strong>{value.toUpperCase()}</strong></article>}
