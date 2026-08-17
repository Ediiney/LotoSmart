'use client'

import { useEffect } from 'react'

const RECOVERY_FLAG = 'lotosmart-auth-recovery-v1'

function hasSupabaseSession() {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key || !key.startsWith('sb-') || !key.endsWith('-auth-token')) continue
      const raw = localStorage.getItem(key)
      if (!raw) continue
      const parsed = JSON.parse(raw)
      if (parsed?.access_token && parsed?.user?.id) return true
    }
  } catch {
    return false
  }
  return false
}

function authUiLooksStuck() {
  const text = document.body?.innerText || ''
  return text.includes('Aguarde…') || text.includes('Aguarde...')
}

export default function AuthSessionRecovery() {
  useEffect(() => {
    let ticks = 0

    const timer = window.setInterval(() => {
      ticks += 1
      if (!hasSupabaseSession()) return
      if (!authUiLooksStuck()) return
      if (sessionStorage.getItem(RECOVERY_FLAG)) return
      if (ticks < 6) return

      sessionStorage.setItem(RECOVERY_FLAG, '1')
      window.location.reload()
    }, 500)

    const clearRecoveryFlag = () => {
      if (!authUiLooksStuck()) sessionStorage.removeItem(RECOVERY_FLAG)
    }

    window.addEventListener('focus', clearRecoveryFlag)
    document.addEventListener('visibilitychange', clearRecoveryFlag)

    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', clearRecoveryFlag)
      document.removeEventListener('visibilitychange', clearRecoveryFlag)
    }
  }, [])

  return null
}
