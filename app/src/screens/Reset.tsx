import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { authMessage } from '../lib/messages'
import { supabase } from '../lib/supabase'
import { AuthHeader } from '../garden/Scene'
import { BackLink, Button, Card, Field, Notice, Page, Title } from '../ui'

// 4-1. 비밀번호 찾기 — 6자리 코드 → 새 비밀번호
export default function Reset() {
  const nav = useNavigate()
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function sendCode(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim())
    setBusy(false)
    if (err) return setError(authMessage(err))
    setStep('code')
  }

  async function change(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 8) return setError('비밀번호는 8자 이상으로 정해 주세요.')
    setBusy(true)
    const { error: err } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'recovery' })
    if (err) {
      setBusy(false)
      return setError(authMessage(err))
    }
    const { error: err2 } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (err2) return setError(authMessage(err2))
    nav('/home', { replace: true })
  }

  return (
    <Page>
      <AuthHeader say="괜찮아요, 금방 찾아요" />
      <BackLink to="/login" />
      <Title sub={step === 'email' ? '가입한 이메일로 6자리 코드를 보내 드려요.' : '메일로 받은 코드와 새 비밀번호를 입력해 주세요.'}>
        비밀번호 찾기
      </Title>
      {step === 'email' ? (
        <form onSubmit={sendCode} className="grid gap-4">
          <Card>
            <Field label="이메일" type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Card>
          <Notice>{error}</Notice>
          <Button type="submit" disabled={busy}>{busy ? '보내는 중…' : '코드 받기'}</Button>
        </form>
      ) : (
        <form onSubmit={change} className="grid gap-4">
          <Card className="grid gap-4">
            <Field
              label="6자리 코드"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={8}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className="tracking-[0.4em]"
            />
            <Field label="새 비밀번호" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} hint="8자 이상" />
          </Card>
          <Notice>{error}</Notice>
          <Button type="submit" disabled={busy || code.length < 6}>{busy ? '바꾸는 중…' : '비밀번호 바꾸기'}</Button>
          <Button type="button" variant="plain" onClick={() => setStep('email')}>코드를 다시 받을래요</Button>
        </form>
      )}
    </Page>
  )
}
