import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authMessage } from '../lib/messages'
import { supabase } from '../lib/supabase'
import { AuthHeader } from '../garden/Scene'
import { BackLink, Button, Card, Field, Notice, Page, Title } from '../ui'
import { VERIFY_EMAIL_KEY } from './Signup'

// 4. 로그인 — 이메일 + 비밀번호 (코드는 가입 때만)
export default function Login() {
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (err) {
      if (/Email not confirmed/i.test(err.message)) {
        // 인증을 못 끝낸 계정: 코드를 다시 보내고 코드 화면으로
        await supabase.auth.resend({ type: 'signup', email: email.trim() })
        sessionStorage.setItem(VERIFY_EMAIL_KEY, email.trim())
        return nav('/verify', { state: { email: email.trim() } })
      }
      return setError(authMessage(err))
    }
    nav('/home', { replace: true })
  }

  return (
    <Page>
      <AuthHeader say="다시 만나서 반가워요!" />
      <BackLink to="/" />
      <Title sub="정원이 기다리고 있어요. 이메일과 비밀번호로 들어와요.">로그인</Title>
      <form onSubmit={submit} className="grid gap-4">
        <Card className="grid gap-4">
          <Field label="이메일" type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Field label="비밀번호" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Card>
        <Notice>{error}</Notice>
        <Button type="submit" disabled={busy}>{busy ? '들어가는 중…' : '로그인'}</Button>
        <div className="flex justify-between text-[14px]">
          <Link to="/reset" className="text-leaf">비밀번호를 잊었어요</Link>
          <Link to="/signup" className="text-leaf">처음이에요 · 가입하기</Link>
        </div>
      </form>
    </Page>
  )
}
