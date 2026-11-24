import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { authMessage } from '../lib/messages'
import { COURSES, supabase, type Course } from '../lib/supabase'
import { Button, Notice, Page, Title } from '../ui'

// 5. 코스 고르기 (기획 Q2) — 마이에서 나중에 바꿀 수 있음
export default function CourseSelect() {
  const nav = useNavigate()
  const { profile, refreshProfile } = useAuth()
  const [pick, setPick] = useState<Course | null>(profile?.current_course ?? (profile?.is_minor ? 'E' : null))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function save() {
    if (!pick || !profile) return
    setBusy(true)
    setError('')
    const { error: err } = await supabase.from('profiles').update({ current_course: pick }).eq('id', profile.id)
    if (err) {
      setBusy(false)
      return setError(authMessage(err))
    }
    await refreshProfile()
    setBusy(false)
    nav('/placement', { replace: true })
  }

  return (
    <Page>
      <Title sub={`${profile?.nickname ?? ''}님, 어떤 코스로 시작할까요? 나중에 마이에서 바꿀 수 있어요.`}>코스 고르기</Title>
      <div className="grid gap-3" role="radiogroup" aria-label="코스">
        {COURSES.map((c) => (
          <button
            key={c.code}
            type="button"
            role="radio"
            aria-checked={pick === c.code}
            onClick={() => setPick(c.code)}
            className={`flex items-center gap-4 rounded-card border-2 p-4 text-left transition ${
              pick === c.code ? 'border-leaf bg-leaf-bg' : 'border-transparent bg-sheet shadow-card'
            }`}
          >
            <span className="text-[40px] leading-none" aria-hidden="true">{c.emoji}</span>
            <span>
              <span className="block font-display text-[22px]">{c.name}</span>
              <span className="text-[14px] text-ink2">{c.desc}</span>
            </span>
          </button>
        ))}
      </div>
      <Notice>{error}</Notice>
      <div className="mt-auto">
        <Button onClick={save} disabled={!pick || busy}>{busy ? '저장하는 중…' : '이 코스로 시작'}</Button>
      </div>
    </Page>
  )
}
