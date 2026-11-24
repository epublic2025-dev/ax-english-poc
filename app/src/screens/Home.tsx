import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { courseMap, homeData, type HomeData, type Lesson, type Level } from '../lib/data'
import { authMessage } from '../lib/messages'
import { COURSES } from '../lib/supabase'
import { Card, Notice, Page, Splash, TabBar } from '../ui'

const GARDEN = [
  { ch: '🌱', name: '새싹', days: '1일' },
  { ch: '🌿', name: '잎', days: '3일' },
  { ch: '🌷', name: '꽃', days: '7일' },
  { ch: '🌳', name: '나무', days: '14일' },
]

// 7. 홈 — 내 단어 정원 · 복습 먼저 · 다음 레슨 · 하루 목표 · 연속 학습 (2_설계.md 4절)
export default function Home() {
  const { session, profile } = useAuth()
  const course = profile?.current_course
  const info = COURSES.find((c) => c.code === course)
  const [data, setData] = useState<HomeData | null>(null)
  const [map, setMap] = useState<{ levels: Level[]; lessons: Lesson[] } | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!course || !session) return
    Promise.all([homeData(session.user.id, course), courseMap(course)])
      .then(([d, m]) => { setData(d); setMap(m) })
      .catch((e) => setError(authMessage(e)))
  }, [course, session])

  if (error) return <Page><Notice>{error}</Notice></Page>
  if (!data || !map || !profile) return <Splash />
  if (!data.progress?.placement_done) return <Navigate to="/placement" replace />

  const lvNo = data.progress.current_level
  const level = map.levels.find((l) => l.level_no === lvNo)
  const lessons = map.lessons.filter((l) => l.level_id === level?.id)
  const next = lessons.find((l) => !data.passed.has(l.id))
  const goal = profile.daily_goal
  const pct = Math.min(100, Math.round((data.xpToday / goal) * 100))
  const trees = data.garden[3] + data.garden[4]

  return (
    <Page className="pb-28">
      <header className="flex items-end justify-between gap-3 pt-2">
        <div>
          <p className="m-0 text-[13px] text-ink2">{info?.emoji} {info?.name} · {lvNo}레벨 {level?.name}</p>
          <h1 className="m-0 mt-0.5 font-display text-[26px] leading-tight">{profile.nickname}님,<br />오늘 할 일이에요</h1>
        </div>
        <div className="flex items-baseline gap-0.5 rounded-full bg-sheet px-3 py-1.5 shadow-[0_2px_0_var(--color-line)]" title="연속 학습일">
          <span className="self-center text-[18px]">🔥</span>
          <b className="font-display text-[21px]">{data.streak}</b>
          <small className="text-[12px] text-ink2">일</small>
        </div>
      </header>

      <Card>
        <div className="mb-2 flex justify-between text-[14px]">
          <span>오늘 목표</span>
          <b className="font-semibold">{data.xpToday} / {goal} XP {pct >= 100 && '✅'}</b>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-[#E4ECDD]">
          <div className="h-full rounded-full bg-[linear-gradient(90deg,#7DB36B,var(--color-leaf))]" style={{ width: `${pct}%` }} />
        </div>
      </Card>

      <Card>
        <h2 className="m-0 font-display text-[19px]">내 단어 정원</h2>
        <p className="mb-3 mt-1 text-[14px] text-ink2">
          {data.garden.some((n) => n > 0) ? '복습할수록 단어가 자라요. 나무가 되면 완전히 외운 단어예요.' : '레슨을 하면 정원에 첫 새싹이 돋아요.'}
        </p>
        <div className="grid grid-cols-4 gap-1.5 text-center">
          {GARDEN.map((g, k) => (
            <div key={g.name} className="grid gap-0.5 rounded-[14px] bg-paper px-0.5 py-2">
              <span className="text-[26px] leading-tight">{g.ch}</span>
              <b className="font-display text-[18px]">{k === 3 ? trees : data.garden[k]}</b>
              <span className="text-[11.5px] text-ink2">{g.name} · {g.days}</span>
            </div>
          ))}
        </div>
      </Card>

      {data.reviewDue > 0 && (
        <Card>
          <h2 className="m-0 font-display text-[19px]">먼저 복습해요</h2>
          <p className="mb-3 mt-1 text-[14px] text-ink2">오늘 다시 볼 단어 {data.reviewDue}개가 있어요.</p>
          <Link to="/review" className="block w-full rounded-btn bg-leaf px-4 py-3.5 text-center font-display text-lg text-white no-underline shadow-btn">
            복습 {data.reviewDue}개 시작
          </Link>
        </Card>
      )}

      <Card>
        {next ? (
          <>
            <p className="m-0 text-[13px] text-ink2">다음 레슨 · 레슨 {next.lesson_no}</p>
            <p className="m-0 mt-0.5 font-display text-[22px]">{next.topic}</p>
            <p className="mb-3 mt-1 text-[14px] text-ink2">10단어 · 약 5분</p>
            <Link to={`/lesson/${next.id}`} className="block w-full rounded-btn bg-leaf px-4 py-3.5 text-center font-display text-lg text-white no-underline shadow-btn">
              레슨 시작
            </Link>
          </>
        ) : (
          <>
            <p className="m-0 font-display text-[20px]">레슨 3개를 모두 통과했어요! 🎉</p>
            <p className="mb-3 mt-1 text-[14px] text-ink2">레벨 시험(15문제)에서 80점이 넘으면 다음 레벨이 열려요.</p>
            {data.progress.completed_at ? (
              <Link to={`/certificate/${course}`} className="block w-full rounded-btn bg-leaf px-4 py-3.5 text-center font-display text-lg text-white no-underline shadow-btn">
                🎓 코스 완료 · 수료증 받기
              </Link>
            ) : (
              <Link to={`/exam/${level?.id}`} className="block w-full rounded-btn bg-leaf px-4 py-3.5 text-center font-display text-lg text-white no-underline shadow-btn">
                레벨 시험 보기
              </Link>
            )}
          </>
        )}
      </Card>

      <Card>
        <h2 className="m-0 mb-3 font-display text-[19px]">{lvNo}레벨 · {level?.name}</h2>
        <div className="flex items-start">
          {lessons.map((l) => {
            const passed = data.passed.has(l.id)
            const now = next?.id === l.id
            return (
              <div key={l.id} className="flex flex-1 items-start">
                <Link to={`/lesson/${l.id}`} className="grid w-[60px] justify-items-center gap-1 text-center text-[11.5px] text-ink2 no-underline">
                  <span className={`grid size-11 place-items-center rounded-full border-2 font-display text-[16px] ${
                    passed ? 'border-leaf bg-leaf text-white' : now ? 'border-leaf bg-sheet text-leaf shadow-[0_0_0_4px_var(--color-leaf-bg)]' : 'border-line bg-sheet text-ink2'}`}>
                    {passed ? '✓' : l.lesson_no}
                  </span>
                  {l.topic}
                </Link>
                <span className="mt-[22px] h-0.5 flex-1 bg-line" />
              </div>
            )
          })}
          <div className="grid w-[60px] justify-items-center gap-1 text-center text-[11.5px] text-ink2">
            {next ? (
              <span className="grid size-11 place-items-center rounded-full border-2 border-line bg-sheet">🔒</span>
            ) : (
              <Link to={`/exam/${level?.id}`} className="grid size-11 place-items-center rounded-full border-2 border-leaf bg-sheet no-underline">🏁</Link>
            )}
            레벨 시험
          </div>
        </div>
      </Card>

      <p className="m-0 text-center text-[12.5px] text-ink2">최고 연속 {data.bestStreak}일</p>
      <TabBar reviewCount={data.reviewDue} />
    </Page>
  )
}
