'use client'

import { useEffect } from 'react'
import { supabase } from '../lib/supabase'

const RECOVERY_FLAG = 'lotosmart-auth-recovery-v2'

function authUiLooksStuck() {
  const text = document.body?.innerText || ''
  return text.includes('Aguarde…') || text.includes('Aguarde...')
}

export default function AuthSessionRecovery() {
  useEffect(() => {
    let recoveryTimer:number|undefined

    function recoverIfNeeded(hasSession:boolean){
      if(!hasSession) return
      if(!authUiLooksStuck()){
        sessionStorage.removeItem(RECOVERY_FLAG)
        return
      }
      if(sessionStorage.getItem(RECOVERY_FLAG)) return
      if(recoveryTimer) window.clearTimeout(recoveryTimer)
      recoveryTimer=window.setTimeout(()=>{
        if(!authUiLooksStuck()) return
        sessionStorage.setItem(RECOVERY_FLAG,'1')
        window.location.reload()
      },1800)
    }

    supabase.auth.getSession().then(({data})=>recoverIfNeeded(Boolean(data.session)))
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{
      recoverIfNeeded(Boolean(session))
    })

    const onFocus=()=>{
      supabase.auth.getSession().then(({data})=>recoverIfNeeded(Boolean(data.session)))
    }

    window.addEventListener('focus',onFocus)
    window.addEventListener('pageshow',onFocus)

    return ()=>{
      subscription.unsubscribe()
      if(recoveryTimer) window.clearTimeout(recoveryTimer)
      window.removeEventListener('focus',onFocus)
      window.removeEventListener('pageshow',onFocus)
    }
  },[])

  return null
}
