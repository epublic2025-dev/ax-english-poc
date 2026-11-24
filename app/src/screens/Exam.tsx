import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Buddy } from '../garden/Buddy'
import { useAuth } from '../lib/auth'
import { itemsForCourse, levelOf, type Item } from '../lib/data'
import { authMessage } from '../lib/messages'
import { makeQuestion, shuffle, type AnswerRec, type QType, type Question } from '../lib/quiz'
import { supabase, type Course } from '../lib/supabase'
import { Runner } from '../quiz/Runner'
import { sfx } from '../sound/sfx'
import { Button, Card, Notice, Page, Splash, Title } from '../ui'

type ExamResult = { score: number; passed: boolean; xp: number; current_level: number; course_completed: boolean; streak: number }

// 12. 레벨 시험 — 그 레벨 30단어 중 15문제, 80점 이상이면 다음 레벨 (정답은 끝나고 한 번에)
export default function Exam() {
  const { levelId = '' } = useParams()
  const nav = useNavigate()
  const { refreshProfile } = useAuth()
  const course = levelId.split('-')[0] as Course
  const lv = Number(levelId.split('-')[1])
  const [items, setItems] = useState<Item[] | null>(null)
  const [questions, setQuestions] = useState<Question[] | null>(null)
  const [result, setResult] = useState<ExamResult | null>(null)
  const [error, setError] = useState('')

  useEffect(() => { itemsForCourse(course).then(setItems).catch((e) => setError(authMessage(e))) }, [course])

  function start() {
    if (!items) return
    const level = items.filter((it) => levelOf(it.id) === lv)
    const types: QType[] = ['meaning', 'listen', 'blank', 'build', course === 'E' ? 'meaning' : 'write']
    setQuestions(shuffle(level).slice(0, 15).map((it, i) => makeQuestion(types[i % types.length], it, level)))
  }

  async function finish(answers: AnswerRec[]) {
    setQuestions(null)
    const { data, error: err } = await supabase.rpc('submit_level_exam', { p_level_id: levelId, p_answers: answers })
    if (err) return setError(authMessage(err))
    const r = data as ExamResult
    setResult(r)
    if (r.passed) sfx.done()
    await refreshProfile()
  }

  if (!items) return error ? <Page><Notice>{error}</Notice></Page> : <Splash />
  if (questions) return <Runner questions={questions} mode="exam" onDone={finish} onExit={() => setQuestions(null)} />

  if (result) {
    return (
      <Page className="text-center">
        <div className="mt-8 text-[72px]" aria-hidden="true">{result.course_completed ? '🎓' : result.passed ? '🌳' : '🌱'}</div>
        <Title sub={result.course_completed ? '코스의 모든 레벨을 통과했어요!' : result.passed ? `${result.current_level}레벨이 열렸어요` : '80점이 넘으면 통과예요. 레슨을 복습하고 다시 도전해요.'}>
          {result.passed ? `${result.score}점 · 통과!` : `${result.score}점`}
        </Title>
        <p className="m-0 text-[15px] text-ink2">+{result.xp} XP · 🔥 {result.streak}일 연속</p>
        <div className="mt-auto grid gap-2.5">
          {result.course_completed && <Button onClick={() => nav(`/certificate/${course}`)}>수료증 받기</Button>}
          <Button variant={result.course_completed ? 'soft' : 'primary'} onClick={() => nav('/home', { replace: true })}>홈으로</Button>
        </div>
      </Page>
    )
  }

  return (
    <Page>
      <Title sub="15문제 · 80점 이상이면 다음 레벨이 열려요">{lv}레벨 시험</Title>
      <Card className="flex items-center gap-3">
        <Buddy size={52} />
        <p className="m-0 text-[15px] leading-relaxed">시험 중에는 정답을 바로 알려 주지 않아요. 끝나고 점수로 알려 줄게요. 천천히 풀어요!</p>
      </Card>
      <Notice>{error}</Notice>
      <div className="mt-auto grid gap-2.5">
        <Button onClick={start}>시험 시작</Button>
        <Button variant="soft" onClick={() => nav('/home')}>다음에 할게요</Button>
      </div>
    </Page>
  )
}
