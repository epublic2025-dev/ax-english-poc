import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { itemsForCourse, lessonOf, levelOf, type Item } from '../lib/data'
import { authMessage } from '../lib/messages'
import { buildLesson, type AnswerRec } from '../lib/quiz'
import { supabase, type Course } from '../lib/supabase'
import { Runner } from '../quiz/Runner'
import { sfx } from '../sound/sfx'
import { canListen, sayItem } from '../sound/voice'
import { SpeakBtn } from '../quiz/Questions'
import { Button, Card, Notice, Page, Splash } from '../ui'

type LessonResult = {
  score: number; passed: boolean; correct: number; wrong: number; skipped: number; xp: number
  wrong_items: string[]; streak: number; new_badges: string[]; ask_fit: boolean; level_exam_open: boolean
}
const BADGE_NAME: Record<string, string> = {
  first_lesson: '첫 레슨 통과', streak_7: '7일 연속', level_pass: '레벨 통과', tree_10: '나무 10그루', wrong_30: '오답 30개 정복',
  perfect_10: '만점 10번', speak_50: '말하기 50번', review_100: '복습 100문제', streak_30: '30일 연속', course_done: '코스 완료',
}

// 9 · 10. 레슨 문제 풀기 → 결과
export default function Lesson() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const { profile } = useAuth()
  const course = id.split('-')[0] as Course
  const [items, setItems] = useState<Item[] | null>(null)
  const [round, setRound] = useState(0)
  const [result, setResult] = useState<LessonResult | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    itemsForCourse(course).then(setItems).catch((e) => setError(authMessage(e)))
  }, [course])

  // 다른 레슨으로 바로 넘어가면 결과 화면을 지우고 새로 시작
  useEffect(() => {
    setResult(null)
    setError('')
    setRound((n) => n + 1)
  }, [id])

  const questions = useMemo(() => {
    if (!items) return []
    const lessonItems = items.filter((it) => lessonOf(it.id) === id)
    const pool = items.filter((it) => levelOf(it.id) === levelOf(id))
    return buildLesson(lessonItems, pool, { course, canSpeak: canListen() })
  }, [items, id, course, round]) // eslint-disable-line react-hooks/exhaustive-deps

  async function finish(answers: AnswerRec[]) {
    setSaving(true)
    const { data, error: err } = await supabase.rpc('submit_lesson', { p_lesson_id: id, p_answers: answers })
    setSaving(false)
    if (err) return setError(authMessage(err))
    setResult(data as LessonResult)
  }

  if (error) return <Page><Notice>{error}</Notice><Button variant="soft" onClick={() => nav('/home')}>홈으로</Button></Page>
  if (!items || saving) return <Splash />
  if (result) {
    return (
      <ResultView r={result} items={items} course={profile?.current_course ?? course}
        onAgain={() => { setResult(null); setRound((n) => n + 1) }} onHome={() => nav('/home', { replace: true })} />
    )
  }
  if (questions.length === 0) return <Page><Notice>이 레슨에 단어가 없어요.</Notice></Page>
  return <Runner key={round} questions={questions} mode="lesson" junior={course === 'E'} onDone={finish} onExit={() => nav('/home')} />
}

function ResultView({ r, items, onAgain, onHome }: { r: LessonResult; items: Item[]; course: Course; onAgain: () => void; onHome: () => void }) {
  const [fit, setFit] = useState<string | null>(null)
  const [shown, setShown] = useState({ score: 0, xp: 0 })
  const wrong = r.wrong_items.map((wid) => items.find((it) => it.id === wid)).filter(Boolean) as Item[]

  useEffect(() => {
    if (r.passed) sfx.done()
    const start = performance.now()
    let raf = 0
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / 800)
      const e = 1 - Math.pow(1 - k, 3)
      setShown({ score: Math.round(r.score * e), xp: Math.round(r.xp * e) })
      if (k < 1) raf = requestAnimationFrame(step)
    }
    const t = setTimeout(() => { raf = requestAnimationFrame(step) }, 300)
    return () => { clearTimeout(t); cancelAnimationFrame(raf) }
  }, [r])

  async function sendFit(v: 'easy' | 'right' | 'hard') {
    setFit(v)
    await supabase.rpc('submit_fit', { p_fit: v })
  }

  return (
    <Page className="text-center">
      {r.passed && <Petals />}
      {r.new_badges.length > 0 && (
        <div className="toast fixed inset-x-4 top-4 z-50 mx-auto flex max-w-[400px] items-center gap-2.5 rounded-btn bg-ink px-4 py-3 text-left text-[14px] text-paper">
          🏅 배지를 받았어요: <b>{r.new_badges.map((b) => BADGE_NAME[b] ?? b).join(', ')}</b>
        </div>
      )}
      <div className="mt-4 grid h-[120px] place-items-center">
        {r.passed
          ? <div className="bloom" aria-hidden="true"><span className="b1">🌱</span><span className="b2">🌷</span></div>
          : <span className="text-[64px]" aria-hidden="true">🌱</span>}
      </div>
      <div>
        <h1 className="m-0 font-display text-[30px]">{r.passed ? '레슨 통과!' : '조금만 더!'}</h1>
        <p className="m-0 mt-1 text-[14px] text-ink2">{r.passed ? '단어들이 정원에 심어졌어요' : '80점이 넘으면 통과예요. 틀린 단어는 정원에 새싹으로 심었어요'}</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          { v: `${shown.score}`, s: '점' },
          { v: `+${shown.xp}`, s: 'XP' },
          { v: `🔥${r.streak}`, s: '일 연속' },
        ].map((x) => (
          <div key={x.s} className="grid gap-0.5 rounded-card bg-sheet px-1 py-3 shadow-[0_2px_0_var(--color-line)]">
            <b className="font-display text-[26px]">{x.v}</b>
            <span className="text-[12.5px] text-ink2">{x.s}</span>
          </div>
        ))}
      </div>

      {wrong.length > 0 && (
        <Card className="text-left">
          <h2 className="m-0 font-display text-[18px]">새싹으로 심은 단어 · 내일 다시 봐요</h2>
          <ul className="m-0 mt-2 grid list-none gap-1.5 p-0">
            {wrong.map((it) => (
              <li key={it.id} className="flex items-center gap-2.5 text-[15px]">
                <SpeakBtn label={`${it.word} 듣기`} onClick={() => sayItem(it, 'w')} />
                <b className="font-display text-[17px]">{it.word}</b>
                <span className="text-ink2">{it.meaning_ko}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {r.ask_fit && (
        <Card>
          <h2 className="m-0 font-display text-[18px]">시작 레벨이 적당했나요?</h2>
          <p className="mb-3 mt-1 text-[13px] text-ink2">첫 레슨을 마친 뒤 한 번만 물어봐요.</p>
          {fit ? (
            <p className="m-0 text-[14px] text-good">고마워요! 레벨 테스트를 다듬는 데 쓸게요.</p>
          ) : (
            <div className="flex flex-wrap justify-center gap-2">
              {([['easy', '쉬웠어요'], ['right', '적당해요'], ['hard', '어려웠어요']] as const).map(([v, t]) => (
                <button key={v} type="button" onClick={() => sendFit(v)} className="rounded-full border border-line bg-paper px-4 py-2 text-[15px]">{t}</button>
              ))}
            </div>
          )}
        </Card>
      )}

      <div className="mt-auto grid gap-2.5">
        {r.passed ? (
          <>
            <Button onClick={onHome}>계속</Button>
            <Button variant="soft" onClick={onAgain}>한 번 더 풀기 (XP 절반)</Button>
          </>
        ) : (
          <>
            <Button onClick={onAgain}>다시 해 보기</Button>
            <Button variant="soft" onClick={onHome}>홈으로</Button>
          </>
        )}
      </div>
    </Page>
  )
}

function Petals() {
  const [list] = useState(() =>
    Array.from({ length: 36 }, (_, i) => ({
      left: Math.random() * 100,
      color: ['#E86F5C', '#F2A65A', '#F7C6C0', '#FFFFFF'][i % 4],
      dur: 1.8 + Math.random() * 1.6,
      delay: 0.7 + Math.random() * 0.5,
      dx: (Math.random() - 0.5) * 160,
      rot: Math.random() * 720 - 360,
    })),
  )
  return (
    <div aria-hidden="true">
      {list.map((p, i) => (
        <i key={i} className="petal" style={{ left: `${p.left}%`, background: p.color, animationDuration: `${p.dur}s`, animationDelay: `${p.delay}s`, ['--dx' as string]: `${p.dx}px`, ['--rot' as string]: `${p.rot}deg` }} />
      ))}
    </div>
  )
}
