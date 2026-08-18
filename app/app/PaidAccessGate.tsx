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

  if(!ready)return <main className={styles.center}><div className={styles.brand}>Loto<span>Smart</span></div><p>Validando acesso…</p></main>

  // Usuários ainda não autenticados continuam vendo o produto e o fluxo de login/cadastro.
  if(!session)return <><ProductApp/></>

  const paid=Boolean(ent?.has_paid_access??ent?.is_pro)
  if(paid)return <><ProductApp/><SavedGamesManager/></>

  return <main className={styles.center}>
    <section className={styles.paywall}>
      <div className={styles.brand}>Loto<span>Smart</span></div>
      <small>ASSINATURA NECESSÁRIA</small>
      <h1>Escolha um plano para continuar.</h1>
      <p>O LotoSmart é um produto pago. Sua conta está ativa, mas geração de jogos, salvamento, Gaming Labs, Validation Engine e alertas exigem um plano vigente.</p>
      <div className={styles.plans}>
        <article>
          <span>PRO</span>
          <strong>R$ 49,90<small>/mês</small></strong>
          <ul><li>Portfólios e jogos ilimitados</li><li>Budget, Wheeling e Monte Carlo</li><li>Validation Engine</li><li>Histórico, conferência e alertas</li></ul>
          <a href="/#planos">Escolher Pro</a>
        </article>
        <article className={styles.founder}>
          <span>FOUNDERS</span>
          <strong>R$ 149<small> pagamento único</small></strong>
          <ul><li>Tudo do Pro</li><li>Acesso vitalício aos recursos Pro atuais</li><li>Oferta limitada aos 100 primeiros</li></ul>
          <a href="/#founders">Quero ser Founder</a>
        </article>
      </div>
      <div className={styles.actions}><a href="/">Voltar ao site</a><button onClick={()=>supabase.auth.signOut()}>Sair da conta</button></div>
      <p className={styles.note}>Checkout Mercado Pago ainda está em preparação. Durante o QA, o administrador pode atribuir Pro ou Founders por mock no painel administrativo.</p>
    </section>
  </main>
}
