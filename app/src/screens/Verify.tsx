import { useEffect, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { authMessage } from '../lib/messages'
import { supabase } from '../lib/supabase'
import { AuthHeader } from '../garden/Scene'
import { BackLink, Button, Card, Field, Notice, Page, Title } from '../ui'
import { VERIFY_EMAIL_KEY } from './Signup'

// 3. 이메일 코드 — 가입할 때 한 번만 (기획 Q9)
export default function Verify() {
  const nav = useNavigate()
  const loc = useLocation() as { state?: { email?: string } }
  const [email, setEmail] = useState(loc.state?.email ?? sessionStorage.getItem(VERIFY_EMAIL_KEY) ?? '')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)
  const [wait, setWait] = useState(60)

  useEffect(() => {
    if (wait <= 0) return
    const t = setTimeout(() => setWait((w) => w - 1), 1000)
    return () => clearTimeout(t)
  }, [wait])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const { error: err } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'signup' })
    setBusy(false)
    if (err) return setError(authMessage(err))
    sessionStorage.removeItem(VERIFY_EMAIL_KEY)
    nav('/course', { replace: true })
  }

  async function resend() {
    setError('')
    setInfo('')
    const { error: err } = await supabase.auth.resend({ type: 'signup', email: email.trim() })
    if (err) return setError(authMessage(err))
    setInfo('새 코드를 보냈어요. 메일함(스팸함도)을 확인해 주세요.')
    setWait(60)
  }

  return (
    <Page>
      <AuthHeader say="메일함을 확인해 봐요 📬" />
      <BackLink to="/signup" />
      <Title sub={<>메일로 받은 <b>6자리 숫자</b>를 입력해 주세요. 메일이 안 보이면 스팸함도 확인해 주세요.</>}>
        이메일 확인
      </Title>
      <form onSubmit={submit} className="grid gap-4">
        <Card className="grid gap-4">
          <Field label="이메일" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Field
            label="6자리 코드"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={8}
            required
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            className="tracking-[0.4em]"
          />
        </Card>
        <Notice>{error}</Notice>
        <Notice kind="good">{info}</Notice>
        <Button type="submit" disabled={busy || code.length < 6}>
          {busy ? '확인하는 중…' : '확인'}
        </Button>
        <Button type="button" variant="plain" onClick={resend} disabled={wait > 0 || !email}>
          {wait > 0 ? `코드 다시 받기 (${wait}초 뒤)` : '코드 다시 받기'}
        </Button>
      </form>
    </Page>
  )
}
