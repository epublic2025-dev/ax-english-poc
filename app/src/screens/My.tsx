import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { authMessage } from '../lib/messages'
import { COURSES, supabase, type Course } from '../lib/supabase'
import { setSoundOn, soundOn } from '../sound/sfx'
import { Button, Card, Notice, Page, TabBar, Title } from '../ui'

type Badge = { code: string; name: string; description: string; earned: boolean }
type Week = { xp: number; answered: number; correctRate: number | null; flowers: number }

// 14. 마이 — 닉네임 · 코스 · 하루 목표 · 효과음 · 배지 · 주간 리포트 · 레벨 테스트 다시 보기
export default function My() {
  const nav = useNavigate()
  const { session, profile, refreshProfile, signOut } = useAuth()
  const [nick, setNick] = useState(profile?.nickname ?? '')
  const [badges, setBadges] = useState<Badge[]>([])
  const [week, setWeek] = useState<Week | null>(null)
  const [sound, setSound] = useState(soundOn())
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!session) return
    const since = new Date(Date.now() - 7 * 86400000).toISOString()
    Promise.all([
      supabase.from('badges').select('code, name, description, sort').order('sort'),
      supabase.from('user_badges').select('badge_code'),
      supabase.from('xp_events').select('amount').gte('created_at', since),
      supabase.from('attempts').select('result').gte('created_at', since),
      supabase.from('item_memory').select('stage').gte('stage', 3),
    ]).then(([b, ub, xp, at, mem]) => {
      const got = new Set(((ub.data ?? []) as { badge_code: string }[]).map((x) => x.badge_code))
      setBadges(((b.data ?? []) as Omit<Badge, 'earned'>[]).map((x) => ({ ...x, earned: got.has(x.code) })))
      const res = ((at.data ?? []) as { result: string }[]).filter((x) => x.result !== 'skipped')
      setWeek({
        xp: ((xp.data ?? []) as { amount: number }[]).reduce((s, x) => s + x.amount, 0),
        answered: res.length,
        correctRate: res.length ? Math.round((100 * res.filter((x) => x.result === 'correct').length) / res.length) : null,
        flowers: (mem.data ?? []).length,
      })
    }).catch((e) => setError(authMessage(e)))
  }, [session])

  async function save(patch: Partial<{ nickname: string; current_course: Course; daily_goal: number }>, done = '저장했어요') {
    if (!profile) return
    setError('')
    setMsg('')
    const { error: err } = await supabase.from('profiles').update(patch).eq('id', profile.id)
    if (err) return setError(authMessage(err))
    await refreshProfile()
    setMsg(done)
  }

  async function changeCourse(c: Course) {
    if (!profile || c === profile.current_course) return
    await save({ current_course: c }, '코스를 바꿨어요')
    const { data } = await supabase.from('course_progress').select('placement_done').eq('course_code', c).maybeSingle()
    nav(data?.placement_done ? '/home' : '/placement')
  }

  if (!profile) return null
  return (
    <Page className="pb-28">
      <Title sub={profile.is_minor ? '보호자 계정으로 가입했어요' : undefined}>마이</Title>

      <Card className="grid gap-3">
        <label className="grid gap-1.5">
          <span className="text-[14px] font-medium">닉네임</span>
          <div className="flex gap-2">
            <input value={nick} maxLength={20} onChange={(e) => setNick(e.target.value)}
              className="min-w-0 flex-1 rounded-[14px] border border-line bg-white px-3.5 py-2.5 text-[16px] outline-none focus:border-leaf" />
            <button type="button" disabled={!nick.trim() || nick.trim() === profile.nickname}
              onClick={() => save({ nickname: nick.trim() })} className="rounded-[14px] bg-leaf px-4 font-display text-white disabled:opacity-40">저장</button>
          </div>
        </label>
        <div className="grid gap-1.5">
          <span className="text-[14px] font-medium">코스</span>
          <div className="grid grid-cols-3 gap-2">
            {COURSES.map((c) => (
              <button key={c.code} type="button" onClick={() => changeCourse(c.code)}
                className={`rounded-[14px] border-2 py-2 font-display text-[16px] ${profile.current_course === c.code ? 'border-leaf bg-leaf-bg' : 'border-transparent bg-paper'}`}>
                {c.emoji} {c.name}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-1.5">
          <span className="text-[14px] font-medium">하루 목표</span>
          <div className="grid grid-cols-3 gap-2">
            {([[30, '가볍게'], [60, '보통'], [100, '열심히']] as const).map(([g, t]) => (
              <button key={g} type="button" onClick={() => save({ daily_goal: g }, '하루 목표를 바꿨어요')}
                className={`grid rounded-[14px] border-2 py-2 ${profile.daily_goal === g ? 'border-leaf bg-leaf-bg' : 'border-transparent bg-paper'}`}>
                <span className="font-display text-[16px]">{t}</span><span className="text-[12px] text-ink2">{g} XP</span>
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-center justify-between text-[15px]">
          효과음
          <input type="checkbox" checked={sound} onChange={(e) => { setSound(e.target.checked); setSoundOn(e.target.checked) }} className="size-5 accent-[#2F6B47]" />
        </label>
      </Card>
      <Notice kind="good">{msg}</Notice>
      <Notice>{error}</Notice>

      <Card>
        <h2 className="m-0 font-display text-[19px]">이번 주 리포트</h2>
        {week ? (
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            {[
              { v: `${week.xp}`, s: 'XP' },
              { v: week.correctRate === null ? '-' : `${week.correctRate}%`, s: `정답률 (${week.answered}문제)` },
              { v: `${week.flowers}`, s: '꽃 이상 단어' },
            ].map((x) => (
              <div key={x.s} className="grid rounded-[14px] bg-paper py-2.5"><b className="font-display text-[22px]">{x.v}</b><span className="text-[12px] text-ink2">{x.s}</span></div>
            ))}
          </div>
        ) : <p className="text-[14px] text-ink2">불러오는 중…</p>}
      </Card>

      <Card>
        <h2 className="m-0 font-display text-[19px]">배지 {badges.filter((b) => b.earned).length} / {badges.length}</h2>
        <div className="mt-3 grid grid-cols-5 gap-2 text-center">
          {badges.map((b) => (
            <div key={b.code} title={b.description} className={`grid gap-0.5 ${b.earned ? '' : 'opacity-35 grayscale'}`}>
              <span className="text-[28px]">🏅</span>
              <span className="text-[10.5px] leading-tight">{b.name}</span>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-2.5">
        <Button variant="soft" onClick={() => nav('/placement')}>레벨 테스트 다시 보기</Button>
        {profile.is_admin && <Button variant="soft" onClick={() => nav('/admin')}>관리자 화면</Button>}
        <Button variant="plain" onClick={signOut}>로그아웃</Button>
      </div>
      <TabBar />
    </Page>
  )
}
