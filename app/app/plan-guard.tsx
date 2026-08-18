'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import styles from './plan-guard.module.css'

type Entitlements = {
  role: string
  plan: 'free' | 'pro' | 'founders'
  is_pro: boolean
  can_use_budget: boolean
  can_use_wheeling: boolean
  can_use_monte_carlo: boolean
  can_use_validation: boolean
  can_use_alerts: boolean
  saved_games_limit: number | null
}

const PRO_FEATURES = [
  { match: 'Orçamento', feature: 'Budget Optimizer' },
  { match: 'Wheeling Lab', feature: 'Wheeling Lab' },
  { match: 'Monte Carlo', feature: 'Monte Carlo' },
  { match: 'Validation Engine', feature: 'Validation Engine' },
  { match: 'Alertas', feature: 'Alertas inteligentes' },
]

const PRO_ACTIONS = [
  { match: 'Simular no Monte Carlo', feature: 'Monte Carlo' },
  { match: 'Rodar 12.000 sorteios', feature: 'Monte Carlo' },
  { match: 'Construir e validar matriz', feature: 'Wheeling Lab' },
  { match: 'Rodar validação histórica', feature: 'Validation Engine' },
  { match: 'Testar fila', feature: 'Alertas inteligentes' },
]

function findFeature(text: string){
  const clean = text.replace('🔒','').trim()
  return [...PRO_FEATURES, ...PRO_ACTIONS].find(item => clean.includes(item.match))
}

export default function PlanGuard(){
  const [entitlements,setEntitlements] = useState<Entitlements|null>(null)
  const [message,setMessage] = useState('')
  const [loading,setLoading] = useState(true)
  const timerRef = useRef<ReturnType<typeof setTimeout>|null>(null)

  useEffect(()=>{
    let active = true

    async function load(){
      setLoading(true)
      const {data:{session}} = await supabase.auth.getSession()

      if(!session){
        if(active){
          setEntitlements(null)
          setLoading(false)
        }
        return
      }

      const {data,error} = await supabase.rpc('get_my_entitlements')
      if(!active) return

      if(error || !data){
        setEntitlements({
          role:'user',
          plan:'free',
          is_pro:false,
          can_use_budget:false,
          can_use_wheeling:false,
          can_use_monte_carlo:false,
          can_use_validation:false,
          can_use_alerts:false,
          saved_games_limit:10
        })
        setMessage('Não foi possível validar seu plano. Recursos Pro permanecem protegidos.')
      } else {
        setEntitlements(data as Entitlements)
      }
      setLoading(false)
    }

    load()
    const {data:{subscription}} = supabase.auth.onAuthStateChange(()=>load())

    return ()=>{
      active = false
      subscription.unsubscribe()
      if(timerRef.current) clearTimeout(timerRef.current)
    }
  },[])

  useEffect(()=>{
    if(loading) return

    function showUpgrade(feature:string){
      setMessage(`${feature} faz parte do LotoSmart Pro. Faça upgrade para Pro ou Founders para liberar.`)
      if(timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(()=>setMessage(''),7000)
    }

    function decorate(){
      const nav = document.querySelector('nav.sections')
      if(nav){
        const buttons = Array.from(nav.querySelectorAll('button'))
        for(const button of buttons){
          const raw = button.textContent || ''
          const feature = PRO_FEATURES.find(item => raw.replace('🔒','').trim().includes(item.match))
          const existingLock = button.querySelector('[data-lotosmart-lock]')

          if(entitlements?.is_pro){
            button.dataset.planLocked = '0'
            button.style.opacity = ''
            button.style.cursor = ''
            existingLock?.remove()
            continue
          }

          if(feature){
            button.dataset.planLocked = '1'
            button.style.opacity = '0.72'
            button.style.cursor = 'not-allowed'
            if(!existingLock){
              const lock = document.createElement('span')
              lock.textContent = ' 🔒'
              lock.dataset.lotosmartLock = '1'
              button.appendChild(lock)
            }
          }
        }
      }

      const head = document.querySelector('.headActions')
      if(head){
        let badge = head.querySelector('[data-lotosmart-plan-badge]') as HTMLElement|null
        if(!badge){
          badge = document.createElement('span')
          badge.dataset.lotosmartPlanBadge = '1'
          badge.className = 'planRuntimeBadge'
          head.prepend(badge)
        }
        badge.textContent = entitlements?.role === 'admin' ? 'ADMIN' : (entitlements?.plan || 'FREE').toUpperCase()
        badge.dataset.plan = entitlements?.plan || 'free'

        const adminLink = head.querySelector('[data-lotosmart-admin-link]') as HTMLAnchorElement|null
        if(entitlements?.role === 'admin' && !adminLink){
          const link = document.createElement('a')
          link.href = '/admin'
          link.textContent = 'Admin'
          link.dataset.lotosmartAdminLink = '1'
          link.className = 'ghost planAdminLink'
          head.insertBefore(link,badge.nextSibling)
        } else if(entitlements?.role !== 'admin') {
          adminLink?.remove()
        }
      }
    }

    function capture(event:Event){
      if(entitlements?.is_pro) return
      const target = event.target as HTMLElement|null
      const clickable = target?.closest('button,a') as HTMLElement|null
      if(!clickable) return
      const feature = findFeature(clickable.textContent || '')
      if(!feature) return

      event.preventDefault()
      event.stopPropagation()
      if('stopImmediatePropagation' in event) event.stopImmediatePropagation()
      showUpgrade(feature.feature)
    }

    const raf = requestAnimationFrame(decorate)
    const delayed = window.setTimeout(decorate,350)
    const onFocus = () => decorate()
    const onPageShow = () => decorate()

    window.addEventListener('focus',onFocus)
    window.addEventListener('pageshow',onPageShow)
    document.addEventListener('click',capture,true)

    return ()=>{
      cancelAnimationFrame(raf)
      window.clearTimeout(delayed)
      window.removeEventListener('focus',onFocus)
      window.removeEventListener('pageshow',onPageShow)
      document.removeEventListener('click',capture,true)
    }
  },[entitlements,loading])

  if(loading) return <div className={styles.loading}>Validando plano…</div>

  return <>
    {entitlements && !entitlements.is_pro && (
      <div className={styles.freeInfo}>
        <b>Plano Free</b>
        <span>Até {entitlements.saved_games_limit ?? 10} jogos salvos</span>
        <a href="/#planos">Ver planos</a>
      </div>
    )}
    {message && <div className={styles.toast}>{message}<a href="/#planos">Ver planos</a></div>}
  </>
}
