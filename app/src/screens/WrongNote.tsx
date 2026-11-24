import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { itemsForCourse, type Item } from '../lib/data'
import { authMessage } from '../lib/messages'
import { supabase } from '../lib/supabase'
import { SpeakBtn } from '../quiz/Questions'
import { sayItem } from '../sound/voice'
import { Button, Card, Notice, Page, Splash, TabBar, Title } from '../ui'

const STAGE = ['🌰', '🌱', '🌿', '🌷', '🌳', '🌳']
type Row = { item: Item; stage: number; wrong_count: number }

// 13. 오답 노트 — 틀린 적 있는 단어, 골라서 다시 풀기
export default function WrongNote() {
  const nav = useNavigate()
  const { profile } = useAuth()
  const course = profile?.current_course
  const [rows, setRows] = useState<Row[] | null>(null)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')

  useEffect(() => {
    if (!course) return
    ;(async () => {
      const [items, mem] = await Promise.all([
        itemsForCourse(course),
        supabase.from('item_memory').select('item_id, stage, wrong_count').eq('ever_wrong', true).like('item_id', `${course}-%`),
      ])
      if (mem.error) throw mem.error
      const byId = new Map(items.map((it) => [it.id, it]))
      const list = ((mem.data ?? []) as { item_id: string; stage: number; wrong_count: number }[])
        .map((m) => ({ item: byId.get(m.item_id)!, stage: m.stage, wrong_count: m.wrong_count }))
        .filter((r) => r.item)
        .sort((a, b) => a.stage - b.stage || b.wrong_count - a.wrong_count)
      setRows(list)
    })().catch((e) => setError(authMessage(e)))
  }, [course])

  if (error) return <Page><Notice>{error}</Notice><TabBar /></Page>
  if (!rows) return <Splash />

  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const allOn = rows.length > 0 && sel.size === rows.length

  return (
    <Page className="pb-40">
      <Title sub="틀린 적 있는 단어예요. 정원 그림은 지금 얼마나 자랐는지 보여 줘요.">오답 노트</Title>
      {rows.length === 0 ? (
        <Card><p className="m-0 text-[15px]">아직 틀린 단어가 없어요. 멋져요! 🌷</p></Card>
      ) : (
        <>
          <button type="button" onClick={() => setSel(allOn ? new Set() : new Set(rows.map((r) => r.item.id)))} className="self-end text-[14px] text-leaf">
            {allOn ? '모두 풀기' : '모두 고르기'}
          </button>
          <ul className="m-0 grid list-none gap-2 p-0">
            {rows.map((r) => (
              <li key={r.item.id} className={`flex items-center gap-2.5 rounded-card px-3 py-2.5 shadow-[0_2px_0_var(--color-line)] ${sel.has(r.item.id) ? 'bg-leaf-bg' : 'bg-sheet'}`}>
                <input type="checkbox" checked={sel.has(r.item.id)} onChange={() => toggle(r.item.id)} aria-label={`${r.item.word} 고르기`} className="size-5 accent-[#2F6B47]" />
                <span className="text-[22px]" title="정원 단계">{STAGE[r.stage]}</span>
                <button type="button" onClick={() => toggle(r.item.id)} className="flex-1 text-left">
                  <b className="font-display text-[18px]">{r.item.word}</b> <span className="text-[14px] text-ink2">{r.item.meaning_ko}</span>
                  <span className="block text-[12px] text-ink2">틀린 횟수 {r.wrong_count}</span>
                </button>
                <SpeakBtn label={`${r.item.word} 듣기`} onClick={() => sayItem(r.item, 'w')} />
              </li>
            ))}
          </ul>
          <div className="fixed inset-x-0 bottom-[72px] z-20">
            <div className="mx-auto max-w-[440px] px-[18px]">
              <Button disabled={sel.size === 0} onClick={() => nav('/review', { state: { ids: [...sel] } })}>
                골라서 다시 풀기 {sel.size > 0 && `(${sel.size})`}
              </Button>
            </div>
          </div>
        </>
      )}
      <TabBar />
    </Page>
  )
}
