import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authMessage } from '../lib/messages'
import { supabase } from '../lib/supabase'
import { AuthHeader } from '../garden/Scene'
import { BackLink, Button, Card, Field, Notice, Page, Title } from '../ui'

export const VERIFY_EMAIL_KEY = 'wg_verify_email'

// 2. 가입 — 만 14세 미만은 보호자 이메일로 가입, 아이는 닉네임만 (기획 Q12)
export default function Signup() {
  const nav = useNavigate()
  const [minor, setMinor] = useState<boolean | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [nickname, setNickname] = useState('')
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (minor === null) return setError('나이를 먼저 골라 주세요.')
    if (password.length < 8) return setError('비밀번호는 8자 이상으로 정해 주세요.')
    if (password !== password2) return setError('비밀번호 두 칸이 서로 달라요.')
    const nick = nickname.trim()
    if (nick.length < 1 || nick.length > 20) return setError('닉네임은 1~20자로 정해 주세요.')
    if (minor && !consent) return setError('보호자 동의에 체크해 주세요.')

    setBusy(true)
    const { data, error: err } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { nickname: nick, is_minor: minor, guardian_consent: minor ? consent : false } },
    })
    setBusy(false)
    if (err) return setError(authMessage(err))
    // 이미 인증까지 끝난 이메일이면 Supabase 는 오류 없이 빈 계정을 돌려준다
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      return setError('이미 가입된 이메일이에요. 로그인해 주세요.')
    }
    if (data.session) return nav('/course')
    sessionStorage.setItem(VERIFY_EMAIL_KEY, email.trim())
    nav('/verify', { state: { email: email.trim() } })
  }

  return (
    <Page>
      <AuthHeader say="같이 정원을 가꿔요!" />
      <BackLink to="/" />
      <Title sub="가입할 때 한 번만 메일로 6자리 코드를 받아요.">가입하기</Title>

      <div className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label="나이">
        {[
          { v: false, t: '만 14세 이상', s: '본인 이메일로 가입' },
          { v: true, t: '만 14세 미만', s: '보호자가 가입해요' },
        ].map((o) => (
          <button
            key={String(o.v)}
            type="button"
            role="radio"
            aria-checked={minor === o.v}
            onClick={() => setMinor(o.v)}
            className={`rounded-card border-2 px-3 py-3.5 text-left transition ${
              minor === o.v ? 'border-leaf bg-leaf-bg' : 'border-transparent bg-sheet shadow-card'
            }`}
          >
            <span className="mb-1 block text-[26px] leading-none" aria-hidden="true">{o.v ? '🧒' : '🧑'}</span>
            <span className="block font-display text-[18px]">{o.t}</span>
            <span className="text-[13px] text-ink2">{o.s}</span>
          </button>
        ))}
      </div>

      {minor !== null && (
        <form onSubmit={submit} className="grid gap-4">
          <Card className="grid gap-4">
            {minor && (
              <Notice kind="info">보호자의 이메일로 가입하고, 아이는 닉네임만 정해요. 아이의 이름 · 생년월일 · 학교는 받지 않아요.</Notice>
            )}
            <Field
              label={minor ? '보호자 이메일' : '이메일'}
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Field
              label="비밀번호"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              hint="8자 이상"
            />
            <Field
              label="비밀번호 확인"
              type="password"
              autoComplete="new-password"
              required
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
            />
            <Field
              label={minor ? '아이 닉네임' : '닉네임'}
              autoComplete="nickname"
              required
              maxLength={20}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              hint="화면과 수료증에 보이는 이름이에요 (1~20자)"
            />
            {minor && (
              <label className="flex items-start gap-2.5 text-[14px] leading-snug">
                <input
                  type="checkbox"
                  className="mt-0.5 size-5 accent-[#2F6B47]"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                <span>저는 이 아이의 보호자이며, 아이가 단어정원을 사용하는 것과 이메일 · 닉네임을 저장하는 것에 동의합니다.</span>
              </label>
            )}
          </Card>
          <Notice>{error}</Notice>
          <Button type="submit" disabled={busy}>
            {busy ? '가입하는 중…' : '가입하고 코드 받기'}
          </Button>
          <p className="m-0 text-center text-[13px] text-ink2">
            받는 정보: 이메일 · 닉네임 · 코스 · 학습 기록 · <Link to="/login" className="text-leaf">이미 계정이 있어요</Link>
          </p>
        </form>
      )}
    </Page>
  )
}
