'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

export default function ConfirmAccess() {
  const router = useRouter()
  const [tokenHash, setTokenHash] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setTokenHash(params.get('token_hash') || '')
  }, [])
  async function confirm() {
    if (!tokenHash || busy) return
    setBusy(true); setMsg('')
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'email' })
    setBusy(false)
    if (error || !data.session) { setMsg('Este link não é mais válido. Solicite um novo acesso na página inicial.'); return }
    router.replace('/')
  }
  return <main className="confirmPage"><section className="confirmCard"><div className="brand">Loto<span>Smart</span></div><p className="eyebrow">ACESSO SEGURO</p><h1>Confirmar entrada</h1><p>Confirme abaixo para entrar no LotoSmart. O token só é utilizado neste momento.</p><button className="cta" disabled={!tokenHash || busy} onClick={confirm}>{busy ? 'Confirmando…' : 'Confirmar e entrar'}</button>{!tokenHash && <p className="note">Link incompleto. Solicite um novo acesso.</p>}{msg && <p className="note">{msg}</p>}<button className="ghost fullBtn" onClick={() => router.replace('/')}>Voltar</button></section></main>
}
