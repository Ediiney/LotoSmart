'use client'

import {useEffect,useRef,useState} from 'react'
import type {Session} from '@supabase/supabase-js'
import {supabase} from '../../lib/supabase'
import ProductApp from './ProductApp'
import SavedGamesManager from './SavedGamesManager'
import styles from './paid-access-gate.module.css'

type Entitlements={role:string;plan:'none'|'pro'|'founders';source?:string;has_paid_access?:boolean;is_pro:boolean;can_use_budget?:boolean;can_use_wheeling?:boolean;can_use_monte_carlo?:boolean;can_use_validation?:boolean;can_use_alerts?:boolean}
type CachedAccess={userId:string;ent:Entitlements;at:number}
const ACCESS_CACHE='lotosmart-paid-access-v2'
const CACHE_TTL=10*60*1000
const ENTITLEMENT_TIMEOUT=3000

function readCache(userId:string):Entitlements|null{try{const raw=localStorage.getItem(ACCESS_CACHE);if(!raw)return null;const cached=JSON.parse(raw) as CachedAccess;if(cached.userId!==userId||Date.now()-cached.at>CACHE_TTL)return null;return cached.ent}catch{return null}}
function writeCache(userId:string,ent:Entitlements|null){try{if(ent)localStorage.setItem(ACCESS_CACHE,JSON.stringify({userId,ent,at:Date.now()}));else localStorage.removeItem(ACCESS_CACHE)}catch{}}
async function withTimeout<T>(promise:PromiseLike<T>,ms:number):Promise<T>{return await Promise.race([Promise.resolve(promise),new Promise<T>((_,reject)=>setTimeout(()=>reject(new Error('TIMEOUT')),ms))])}

export default function PaidAccessGate(){
 const[session,setSession]=useState<Session|null>(null),[ent,setEnt]=useState<Entitlements|null>(null),[ready,setReady]=useState(false),[entLoading,setEntLoading]=useState(false)
 const[mode,setMode]=useState<'login'|'signup'>('login'),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
 const syncing=useRef(false)

 async function refreshEntitlements(current:Session,background=false){
  if(syncing.current)return
  syncing.current=true;if(!background)setEntLoading(true)
  try{const result=await withTimeout(supabase.rpc('get_my_entitlements'),ENTITLEMENT_TIMEOUT);if(!result.error&&result.data){const next=result.data as Entitlements;setEnt(next);writeCache(current.user.id,next);setMessage('')}else if(!background)setMessage('Não foi possível sincronizar seu plano agora. Tente novamente.')}
  catch{if(!background)setMessage('A validação do plano demorou mais que o esperado. Tente novamente.');window.setTimeout(()=>void refreshEntitlements(current,true),1200)}
  finally{syncing.current=false;setEntLoading(false)}
 }

 useEffect(()=>{
  let active=true
  async function bootstrap(){const{data:{session:next}}=await supabase.auth.getSession();if(!active)return;setSession(next);setReady(true);if(!next){setEnt(null);return}const cached=readCache(next.user.id);if(cached)setEnt(cached);window.setTimeout(()=>void refreshEntitlements(next,Boolean(cached)),0)}
  void bootstrap()
  const{data:{subscription}}=supabase.auth.onAuthStateChange((_event,next)=>{if(!active)return;setSession(next);setReady(true);if(!next){setEnt(null);writeCache('',null);return}const cached=readCache(next.user.id);if(cached)setEnt(cached);window.setTimeout(()=>void refreshEntitlements(next,Boolean(cached)),0)})
  const onPageShow=()=>{if(document.visibilityState!=='visible')return;void supabase.auth.getSession().then(({data})=>{if(data.session)window.setTimeout(()=>void refreshEntitlements(data.session,true),0)})}
  window.addEventListener('pageshow',onPageShow)
  return()=>{active=false;subscription.unsubscribe();window.removeEventListener('pageshow',onPageShow)}
 },[])

 async function authenticate(){
  const clean=email.trim().toLowerCase();if(!/^\S+@\S+\.\S+$/.test(clean)){setMessage('Informe um e-mail válido.');return}if(password.length<8){setMessage('A senha precisa ter pelo menos 8 caracteres.');return}if(mode==='signup'&&password!==confirm){setMessage('As senhas não conferem.');return}
  setBusy(true);setMessage('')
  try{let next:Session|null=null;if(mode==='login'){const{data,error}=await withTimeout(supabase.auth.signInWithPassword({email:clean,password}),8000);if(error){setMessage(error.message.toLowerCase().includes('invalid login')?'E-mail ou senha incorretos.':error.message);return}next=data.session}else{const{data,error}=await withTimeout(supabase.auth.signUp({email:clean,password,options:{emailRedirectTo:'https://lotosmart-ediineys-projects.vercel.app/app'}}),8000);if(error){setMessage(error.message);return}if(!data.session){setMessage('Conta criada. Confirme seu e-mail e depois entre para escolher um plano.');return}next=data.session}if(next){setSession(next);setReady(true);const cached=readCache(next.user.id);if(cached)setEnt(cached);window.setTimeout(()=>void refreshEntitlements(next,Boolean(cached)),0)}}
  catch{setMessage('A conexão com o login demorou mais que o esperado. Verifique sua internet e tente novamente.')}
  finally{setBusy(false)}
 }

 if(!ready)return <main className={styles.center}><div className={styles.brand}>Loto<span>Smart</span></div><p>Abrindo sua conta…</p></main>
 if(!session)return <main className={styles.center}><section className={styles.loginCard}><div className={styles.brand}>Loto<span>Smart</span></div><small>ACESSO À PLATAFORMA</small><h1>{mode==='login'?'Entre na sua conta.':'Crie sua conta.'}</h1><p>O cadastro é gratuito, mas o uso do LotoSmart exige uma assinatura Pro ou Founders ativa.</p><div className={styles.modeButtons}><button className={mode==='login'?styles.selected:''} onClick={()=>{setMode('login');setMessage('')}}>Já tenho conta</button><button className={mode==='signup'?styles.selected:''} onClick={()=>{setMode('signup');setMessage('')}}>Criar conta</button></div><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="seu@email.com"/><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Senha"/>{mode==='signup'&&<input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="Confirme a senha"/>}{message&&<div className={styles.loginMessage}>{message}</div>}<button className={styles.loginCta} disabled={busy} onClick={authenticate}>{busy?'Entrando…':mode==='login'?'Entrar':'Criar conta'}</button><div className={styles.actions}><a href="/">Voltar ao site</a><a href="/#planos">Ver planos</a></div></section></main>
 if(!ent)return <main className={styles.center}><section className={styles.loginCard}><div className={styles.brand}>Loto<span>Smart</span></div><small>CONTA AUTENTICADA</small><h1>Sincronizando seu acesso.</h1><p>{entLoading?'Consultando seu plano…':'A sincronização ainda não respondeu.'}</p>{message&&<div className={styles.loginMessage}>{message}</div>}<button className={styles.loginCta} disabled={entLoading} onClick={()=>void refreshEntitlements(session)}>{entLoading?'Aguarde…':'Tentar novamente'}</button><div className={styles.actions}><a href="/">Voltar ao site</a></div></section></main>

 const paid=Boolean(ent.has_paid_access??ent.is_pro)
 if(paid)return <><ProductApp initialSession={session} initialEntitlements={ent}/><SavedGamesManager/></>
 return <main className={styles.center}><section className={styles.paywall}><div className={styles.brand}>Loto<span>Smart</span></div><small>ASSINATURA NECESSÁRIA</small><h1>Escolha um plano para continuar.</h1><p>O LotoSmart é um produto pago. Sua conta está ativa, mas geração de jogos, salvamento, Gaming Labs, Validation Engine e alertas exigem um plano vigente.</p><div className={styles.plans}><article><span>PRO</span><strong>R$ 49,90<small>/mês</small></strong><ul><li>Portfólios e jogos ilimitados</li><li>Budget, Wheeling e Monte Carlo</li><li>Validation Engine</li><li>Histórico e conferência</li></ul><a href="/#planos">Escolher Pro</a></article><article className={styles.founder}><span>FOUNDERS</span><strong>R$ 149<small> pagamento único</small></strong><ul><li>Tudo do Pro</li><li>Acesso vitalício aos recursos Pro atuais</li><li>Oferta limitada aos 100 primeiros</li></ul><a href="/#founders">Quero ser Founder</a></article></div><div className={styles.actions}><a href="/">Voltar ao site</a><button onClick={async()=>{writeCache('',null);await supabase.auth.signOut()}}>Sair da conta</button></div><p className={styles.note}>Durante o beta, pagamentos via Pix podem ser liberados manualmente pelo administrador.</p></section></main>
}
