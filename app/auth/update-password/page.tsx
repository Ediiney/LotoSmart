'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

export default function UpdatePasswordPage() {
  const router = useRouter()
  const [tokenHash, setTokenHash] = useState('')
  const [verified, setVerified] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setTokenHash(params.get('token_hash') || '')
    supabase.auth.getSession().then(({ data }) => { if (data.session) setVerified(true) })
  }, [])

  async function verifyRecovery() {
    if (!tokenHash || busy) return
    setBusy(true); setMsg('')
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' })
    setBusy(false)
    if (error || !data.session) { setMsg('Este link não é mais válido. Solicite uma nova recuperação de senha.'); return }
    setVerified(true)
  }

  async function updatePassword() {
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) { setMsg('Use pelo menos 8 caracteres, com letra e número.'); return }
    if (password !== confirm) { setMsg('As senhas não conferem.'); return }
    setBusy(true); setMsg('')
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) { setMsg(error.message); return }
    setMsg('Senha alterada com sucesso.')
    setTimeout(() => router.replace('/'), 900)
  }

  return <main className="confirmPage"><section className="confirmCard"><p className="eyebrow">LOTOSMART</p><h1>Nova senha</h1>{!verified ? <><p>Confirme a recuperação para liberar a criação da nova senha.</p><button className="cta" disabled={!tokenHash || busy} onClick={verifyRecovery}>{busy?'Validando…':'Confirmar recuperação'}</button></> : <><p>Crie uma nova senha para sua conta.</p><input className="text" type="password" autoComplete="new-password" placeholder="Nova senha" value={password} onChange={e=>setPassword(e.target.value)} /><input className="text" type="password" autoComplete="new-password" placeholder="Confirme a nova senha" value={confirm} onChange={e=>setConfirm(e.target.value)} /><button className="cta" disabled={busy} onClick={updatePassword}>{busy?'Salvando…':'Salvar nova senha'}</button></>}{msg&&<p className="note">{msg}</p>}<a className="backLink" href="/">Voltar ao LotoSmart</a></section></main>
}
