import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Buddy } from '../garden/Buddy'
import { useAuth } from '../lib/auth'
import { courseMap, itemsForCourse, levelOf, type Item, type Level } from '../lib/data'
import { authMessage } from '../lib/messages'
import { buildPlacementBlock, grade, type AnswerRec, type Question } from '../lib/quiz'
import { COURSES, supabase } from '../lib/supabase'
import { Runner } from '../quiz/Runner'
import { sfx } from '../sound/sfx'
import { Button, Card, Notice, Page, Splash, Title } from '../ui'

type Phase = 'intro' | 'block1' | 'block2' | 'saving' | 'result'

// 6. 레벨 테스트 — 2레벨 5문제 → (4개 이상) 3레벨 5문제 / (3개 이하) 1레벨 5문제 (기획 3-5)
export default function Placement() {
  const nav = useNavigate()
  const { profile, refreshProfile } = useAuth()
  const course = profile?.current_course ?? null
  const info = COURSES.find((c) => c.code === course)
  const [items, setItems] = useState<Item[] | null>(null)
  const [levels, setLevels] = useState<Level[]>([])
  const [phase, setPhase] = useState<Phase>('intro')
  const [block, setBlock] = useState<Question[]>([])
  const [first, setFirst] = useState<AnswerRec[]>([])
  const [result, setResult] = useState<{ result_level: number; easy_course: boolean } | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!course) return
    Promise.all([itemsForCourse(course), courseMap(course)])
      .then(([it, map]) => { setItems(it); setLevels(map.levels) })
      .catch((e) => setError(authMessage(e)))
  }, [course])

  if (!course) return <Splash />
  const byLevel = (n: number) => (items ?? []).filter((it) => levelOf(it.id) === n)
  const levelName = (n: number) => levels.find((l) => l.level_no === n)?.name ?? ''

  function start() {
    if (!items) return
    setBlock(buildPlacementBlock(byLevel(2), items, course!))
    setPhase('block1')
  }

  function afterBlock1(ans: AnswerRec[]) {
    const correct = ans.filter((a) => !a.dont_know && grade(block.find((q) => q.item.id === a.item_id)!, a.answer ?? '')).length
    setFirst(ans)
    setBlock(buildPlacementBlock(byLevel(correct >= 4 ? 3 : 1), items!, course!))
    setPhase('block2')
  }

  async function afterBlock2(ans: AnswerRec[]) {
    setPhase('saving')
    const { data, error: err } = await supabase.rpc('submit_placement', { p_course: course, p_answers: [...first, ...ans] })
    if (err) { setError(authMessage(err)); setPhase('intro'); return }
    setResult(data as { result_level: number; easy_course: boolean })
    sfx.done()
    setPhase('result')
  }

  async function choose(level: number, skipped = false) {
    setError('')
    if (skipped || (result && level !== result.result_level)) {
      const { error: err } = await supabase.rpc('choose_start_level', { p_course: course, p_level: level, p_skipped: skipped })
      if (err) return setError(authMessage(err))
    }
    await refreshProfile()
    nav('/home', { replace: true })
  }

  if (phase === 'block1') return <Runner key="b1" questions={block} mode="placement" allowDontKnow onDone={afterBlock1} onExit={() => setPhase('intro')} />
  if (phase === 'block2') return <Runner key="b2" questions={block} mode="placement" allowDontKnow onDone={afterBlock2} onExit={() => setPhase('intro')} />
  if (phase === 'saving') return <Splash />

  if (phase === 'result' && result) {
    const n = result.result_level
    return (
      <Page className="justify-between">
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <div className="bloom" aria-hidden="true"><span className="b1">🌱</span><span className="b2">{['🌱', '🌿', '🌷'][n - 1]}</span></div>
          <h1 className="m-0 font-display text-[30px]">{n}레벨부터 시작해요</h1>
          <p className="m-0 text-[16px] text-ink2">{info?.emoji} {info?.name} · {levelName(n)}</p>
          {result.easy_course && (
            <Notice kind="info">이 코스가 쉬울 수 있어요. 마이에서 다른 코스로 바꿀 수도 있어요.</Notice>
          )}
        </div>
        <div className="grid gap-2.5">
          <Notice>{error}</Notice>
          <Button onClick={() => choose(n)}>{n}레벨로 시작</Button>
          {n > 1 && <Button variant="soft" onClick={() => choose(n - 1)}>한 단계 아래({n - 1}레벨)에서 시작</Button>}
        </div>
      </Page>
    )
  }

  return (
    <Page>
      <Title sub={`${info?.emoji ?? ''} ${info?.name ?? ''} 코스 · 10문제 · 1~2분`}>레벨 테스트</Title>
      <Card className="flex items-center gap-3">
        <Buddy size={56} />
        <p className="m-0 text-[15px] leading-relaxed">
          단어 뜻부터 문장 만들기, 영어로 쓰기까지 나와요. 아는 만큼만 풀고, 모르면 <b>모르겠어요</b>를 눌러 주세요. 찍어서 맞히면 너무 어려운 레벨부터 시작하게 돼요.
        </p>
      </Card>
      <Notice>{error}</Notice>
      <div className="mt-auto grid gap-2.5">
        <Button onClick={start} disabled={!items}>{items ? '테스트 시작' : '준비하는 중…'}</Button>
        <Button variant="soft" onClick={() => choose(1, true)}>건너뛰고 1레벨부터</Button>
      </div>
    </Page>
  )
}
