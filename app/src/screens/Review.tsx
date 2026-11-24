import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Buddy } from '../garden/Buddy'
import { useAuth } from '../lib/auth'
import { itemsForCourse, lessonOf, type Item } from '../lib/data'
import { authMessage } from '../lib/messages'
import { makeQuestion, shuffle, type AnswerRec, type Question } from '../lib/quiz'
import { supabase } from '../lib/supabase'
import { Runner } from '../quiz/Runner'
import { sfx } from '../sound/sfx'
import { Button, Card, Notice, Page, Splash, TabBar, Title } from '../ui'

type ReviewResult = { correct: number; wrong: number; xp: number; graduated: number; streak: number; wrong_items: string[]; new_badges: string[] }

// 11. 복습 — 오늘 복습할 단어 (오답 노트에서 고른 단어도 여기서 푼다)
export default function Review() {
  const nav = useNavigate()
  const loc = useLocation() as { state?: { ids?: string[] } }
  const picked = loc.state?.ids
  const { profile } = useAuth()
  const course = profile?.current_course
  const [due, setDue] = useState<Item[] | null>(null)
  const [pool, setPool] = useState<Item[]>([])
  const [questions, setQuestions] = useState<Question[] | null>(null)
  const [result, setResult] = useState<ReviewResult | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!course) return
    ;(async () => {
      const all = await itemsForCourse(course)
      setPool(all)
      if (picked?.length) {
        setDue(all.filter((it) => picked.includes(it.id)))
        return
      }
      const { data, error: err } = await supabase.rpc('get_review_queue', { p_course: course, p_limit: 20 })
      if (err) throw err
      const rows = (data ?? []) as (Omit<Item, 'id' | 'lesson_id'> & { item_id: string })[]
      setDue(rows.map((r) => ({ ...r, id: r.item_id, lesson_id: lessonOf(r.item_id) })))
    })().catch((e) => setError(authMessage(e)))
  }, [course, picked])

  function start() {
    if (!due) return
    // 카드 복습 위주, 세 개마다 하나는 문제로 확인 (초등은 그림이 있으면 그림 듣고 고르기)
    const check = (it: Item, i: number) => (course === 'E' && it.emoji ? 'pic' : i % 2 ? 'listen' : 'meaning')
    setQuestions(shuffle(due).map((it, i) => makeQuestion(i % 3 === 2 ? check(it, i) : 'card', it, pool)))
  }

  async function finish(answers: AnswerRec[]) {
    setQuestions(null)
    const { data, error: err } = await supabase.rpc('submit_review', { p_answers: answers })
    if (err) return setError(authMessage(err))
    setResult(data as ReviewResult)
    sfx.done()
  }

  if (error) return <Page><Notice>{error}</Notice><TabBar /></Page>
  if (!due) return <Splash />
  if (questions) return <Runner questions={questions} mode="review" junior={course === 'E'} onDone={finish} onExit={() => setQuestions(null)} />

  if (result) {
    return (
      <Page className="pb-28 text-center">
        <div className="mt-6 text-[64px]" aria-hidden="true">{result.graduated > 0 ? '🌳' : '🌿'}</div>
        <Title sub={`맞힌 단어는 한 단계 자랐어요${result.graduated ? ` · 졸업한 나무 ${result.graduated}그루` : ''}`}>복습 끝!</Title>
        <div className="grid grid-cols-3 gap-2">
          {[{ v: `${result.correct}`, s: '맞힘' }, { v: `+${result.xp}`, s: 'XP' }, { v: `🔥${result.streak}`, s: '일 연속' }].map((x) => (
            <div key={x.s} className="grid rounded-card bg-sheet py-3 shadow-[0_2px_0_var(--color-line)]">
              <b className="font-display text-[26px]">{x.v}</b><span className="text-[12.5px] text-ink2">{x.s}</span>
            </div>
          ))}
        </div>
        {result.wrong > 0 && <Notice kind="info">틀린 {result.wrong}개는 새싹으로 돌아가 내일 다시 나와요.</Notice>}
        <div className="mt-auto"><Button onClick={() => nav('/home')}>홈으로</Button></div>
        <TabBar />
      </Page>
    )
  }

  return (
    <Page className="pb-28">
      <Title sub={picked ? '오답 노트에서 고른 단어를 다시 풀어요.' : '잊기 전에 다시 보면 오래 기억해요.'}>{picked ? '골라서 다시 풀기' : '오늘의 복습'}</Title>
      {due.length === 0 ? (
        <Card className="flex items-center gap-3">
          <Buddy size={52} />
          <p className="m-0 text-[15px] leading-relaxed">오늘 복습할 단어가 없어요 🎉<br />새 레슨을 하면 내일 복습할 단어가 생겨요.</p>
        </Card>
      ) : (
        <>
          <Card>
            <p className="m-0 font-display text-[22px]">{due.length}개 단어</p>
            <p className="mb-0 mt-1 text-[14px] text-ink2">카드를 뒤집어 뜻을 확인하고, 얼마나 잘 기억했는지 골라 주세요. 맞힌 단어는 정원에서 한 단계 자라요.</p>
          </Card>
          <div className="flex flex-wrap gap-1.5">
            {due.slice(0, 20).map((it) => <span key={it.id} className="rounded-full bg-sheet px-3 py-1 font-display text-[15px] shadow-[0_1px_0_var(--color-line)]">{it.word}</span>)}
          </div>
          <div className="mt-auto"><Button onClick={start}>복습 시작</Button></div>
        </>
      )}
      <TabBar reviewCount={picked ? 0 : due.length} />
    </Page>
  )
}
