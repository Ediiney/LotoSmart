'use client'

import {useEffect,useState} from 'react'
import type {Session} from '@supabase/supabase-js'
import {supabase} from '../../lib/supabase'
import ProductApp from './ProductApp'
import SavedGamesManager from './SavedGamesManager'
import styles from './paid-access-gate.module.css'

type Entitlements={role:string;plan:'none'|'pro'|'founders';source?:string;has_paid_access?:boolean;is_pro:boolean}

export default function PaidAccessGate(){
  const [session,setSession]=useState<Session|null>(null)
  const [ent,setEnt]=useState<Entitlements|null>(null)
  const [ready,setReady]=useState(false)
  const [mode,setMode]=useState<'login'|'signup'>('login')
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [confirm,setConfirm]=useState('')
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')

  async function sync(){
    const {data:{session:next}}=await supabase.auth.getSession()
    setSession(next)
    if(next){
      const {data}=await supabase.rpc('get_my_entitlements')
      setEnt((data||null) as Entitlements|null)
    }else setEnt(null)
    setReady(true)
  }

  useEffect(()=>{
    sync()
    const {data:{subscription}}=supabase.auth.onAuthStateChange(()=>sync())
    const onFocus=()=>sync()
    window.addEventListener('focus',onFocus)
    window.addEventListener('pageshow',onFocus)
    return()=>{subscription.unsubscribe();window.removeEventListener('focus',onFocus);window.removeEventListener('pageshow',onFocus)}
  },[])

  async function authenticate(){
    const clean=email.trim().toLowerCase()
    if(!/^\S+@\S+\.\S+$/.test(clean)){setMessage('Informe um e-mail válido.');return}
    if(password.length<8){setMessage('A senha precisa ter pelo menos 8 caracteres.');return}
    if(mode==='signup'&&password!==confirm){setMessage('As senhas não conferem.');return}
    setBusy(true);setMessage('')
    try{
      if(mode==='login'){
        const {error}=await supabase.auth.signInWithPassword({email:clean,password})
        if(error){setMessage(error.message.toLowerCase().includes('invalid login')?'E-mail ou senha incorretos.':error.message);return}
      }else{
        const {data,error}=await supabase.auth.signUp({email:clean,password,options:{emailRedirectTo:'https://lotosmart-ediineys-projects.vercel.app/app'}})
        if(error){setMessage(error.message);return}
        if(!data.session){setMessage('Conta criada. Confirme seu e-mail e depois entre para escolher um plano.');return}
      }
      await sync()
    }finally{setBusy(false)}
  }

  if(!ready)return <main className={styles.center}><div className={styles.brand}>Loto<span>Smart</span></div><p>Validando acesso…</p></main>

  if(!session)return <main className={styles.center}>
    <section className={styles.loginCard}>
      <div className={styles.brand}>Loto<span>Smart</span></div>
      <small>ACESSO À PLATAFORMA</small>
      <h1>{mode==='login'?'Entre na sua conta.':'Crie sua conta.'}</h1>
      <p>O cadastro é gratuito, mas o uso do LotoSmart exige uma assinatura Pro ou Founders ativa.</p>
      <div className={styles.modeButtons}><button className={mode==='login'?styles.selected:''} onClick={()=>{setMode('login');setMessage('')}}>Já tenho conta</button><button className={mode==='signup'?styles.selected:''} onClick={()=>{setMode('signup');setMessage('')}}>Criar conta</button></div>
      <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="seu@email.com"/>
      <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Senha"/>
      {mode==='signup'&&<input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="Confirme a senha"/>}
      {message&&<div className={styles.loginMessage}>{message}</div>}
      <button className={styles.loginCta} disabled={busy} onClick={authenticate}>{busy?'Aguarde…':mode==='login'?'Entrar':'Criar conta'}</button>
      <div className={styles.actions}><a href="/">Voltar ao site</a><a href="/#planos">Ver planos</a></div>
    </section>
  </main>

  const paid=Boolean(ent?.has_paid_access??ent?.is_pro)
  if(paid)return <><ProductApp/><SavedGamesManager/></>

  return <main className={styles.center}>
    <section className={styles.paywall}>
      <div className={styles.brand}>Loto<span>Smart</span></div>
      <small>ASSINATURA NECESSÁRIA</small>
      <h1>Escolha um plano para continuar.</h1>
      <p>O LotoSmart é um produto pago. Sua conta está ativa, mas geração de jogos, salvamento, Gaming Labs, Validation Engine e alertas exigem um plano vigente.</p>
      <div className={styles.plans}>
        <article><span>PRO</span><strong>R$ 49,90<small>/mês</small></strong><ul><li>Portfólios e jogos ilimitados</li><li>Budget, Wheeling e Monte Carlo</li><li>Validation Engine</li><li>Histórico, conferência e alertas</li></ul><a href="/#planos">Escolher Pro</a></article>
        <article className={styles.founder}><span>FOUNDERS</span><strong>R$ 149<small> pagamento único</small></strong><ul><li>Tudo do Pro</li><li>Acesso vitalício aos recursos Pro atuais</li><li>Oferta limitada aos 100 primeiros</li></ul><a href="/#founders">Quero ser Founder</a></article>
      </div>
      <div className={styles.actions}><a href="/">Voltar ao site</a><button onClick={()=>supabase.auth.signOut()}>Sair da conta</button></div>
      <p className={styles.note}>Checkout Mercado Pago ainda está em preparação. Durante o QA, o administrador pode atribuir Pro ou Founders por mock no painel administrativo.</p>
    </section>
  </main>
}
