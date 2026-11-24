import { useEffect, useMemo, useRef, useState } from 'react'
import { Emo } from '../garden/Emo'
import type { Item } from '../lib/data'
import { sfx } from '../sound/sfx'
import { sayItem } from '../sound/voice'
import { Hint, SpeakBtn, type QProps } from './Questions'

// 주니어(초등) 문제 4가지 (2_설계.md 6-2)

// 🔊 그림 듣고 고르기: 자동 발음 → 그림 4장, 이름표는 답한 뒤
export function PicQ({ q, answered, reveal, onAnswer }: QProps) {
  useEffect(() => { sayItem(q.item, 'w') }, [q.key]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <Hint>잘 듣고 알맞은 그림을 눌러요</Hint>
      <div className="py-1"><SpeakBtn big label="다시 듣기" onClick={() => sayItem(q.item, 'w')} /></div>
      <div className="grid grid-cols-2 gap-3">
        {q.picks!.map((p) => {
          const picked = answered?.value === p.id
          let look = 'bg-sheet shadow-[0_3px_0_var(--color-line)]'
          if (answered && reveal) {
            if (picked && answered.ok) look = 'bg-good-bg shadow-[0_3px_0_var(--color-good)] anim-pop'
            else if (picked) look = 'bg-bad-bg shadow-[0_3px_0_var(--color-bad)] anim-shake'
            else if (p.id === q.item.id) look = 'bg-sheet outline-[3px] outline-dashed outline-good -outline-offset-[3px]'
          }
          return (
            <button key={p.id} type="button" disabled={!!answered} onClick={(e) => onAnswer(p.id, e.currentTarget)}
              className={`grid aspect-square place-content-center justify-items-center gap-1 rounded-[22px] ${look}`}>
              <Emo ch={p.emoji!} size={72} label={answered ? p.meaning_ko : '그림'} />
              <span className={`font-display text-[16px] ${answered ? '' : 'invisible'}`}>{p.meaning_ko}</span>
            </button>
          )
        })}
      </div>
    </>
  )
}

// 🦋 나비 잡기: 그림을 보고 그 영어 단어를 단 나비를 누른다 (2레벨~)
const FLIGHT = [
  { l: 4, t: 8, ax: 40, ay: 30, bx: 70, by: -5, cx: 20, cy: 40, d: 7 },
  { l: 52, t: 4, ax: -40, ay: 40, bx: -10, by: 70, cx: 30, cy: 30, d: 8.5 },
  { l: 8, t: 50, ax: 60, ay: -30, bx: 30, by: 30, cx: 80, cy: 0, d: 9 },
  { l: 54, t: 46, ax: -50, ay: -20, bx: -20, by: 40, cx: -60, cy: 10, d: 7.5 },
]
export function ButterflyQ({ q, answered, reveal, onAnswer }: QProps) {
  return (
    <>
      <Hint>이 그림의 영어 단어를 단 나비를 잡아요</Hint>
      <div className="flex items-center justify-center gap-3">
        <Emo ch={q.item.emoji!} size={58} label={q.item.meaning_ko} />
        <span className="font-display text-[26px]">{q.item.meaning_ko}</span>
      </div>
      <div className="relative h-[330px] overflow-hidden rounded-[22px] bg-[linear-gradient(180deg,#E6F2FA_0%,#EEF6E6_68%,#D6EAC8_100%)]">
        {q.picks!.map((p, i) => {
          const f = FLIGHT[i]
          const picked = answered?.value === p.id
          const isAnswer = p.id === q.item.id
          const caught = answered && reveal && isAnswer
          const gone = answered && picked && !answered.ok
          return (
            <button key={p.id} type="button" disabled={!!answered} onClick={(e) => onAnswer(p.id, e.currentTarget)}
              className={`bfly absolute grid justify-items-center p-1 transition-opacity duration-500 ${gone ? 'opacity-0' : ''} ${answered ? 'bfly-stop' : ''}`}
              style={{ left: `${f.l}%`, top: `${f.t}%`, ['--ax' as string]: `${f.ax}px`, ['--ay' as string]: `${f.ay}px`, ['--bx' as string]: `${f.bx}px`, ['--by' as string]: `${f.by}px`, ['--cx' as string]: `${f.cx}px`, ['--cy' as string]: `${f.cy}px`, animationDuration: `${f.d}s` }}>
              <span className={`wing block ${caught ? 'wing-stop' : ''}`}><Emo ch="🦋" size={40} /></span>
              <b className={`rounded-[10px] px-2.5 py-0.5 font-display text-[19px] font-normal ${caught ? 'bg-good text-white' : 'bg-white/90 text-ink'}`}>{p.word}</b>
            </button>
          )
        })}
        <div className="absolute inset-x-0 bottom-2 flex justify-center gap-3" aria-hidden="true">
          {['🌷', '🌼', '🌸', '🌷', '🌼', '🌸'].map((c, i) => <Emo key={i} ch={c} size={22} />)}
        </div>
      </div>
    </>
  )
}

// 🌰 철자 씨앗: 알파벳 씨앗을 순서대로 화분에 심는다 (두 번 틀리면 정답 씨앗이 반짝)
export function SeedQ({ q, answered, onAnswer }: QProps) {
  const word = q.item.word.toLowerCase()
  const [pos, setPos] = useState(0)
  const [used, setUsed] = useState<number[]>([])
  const [miss, setMiss] = useState(0)
  const [shake, setShake] = useState<number | null>(null)
  const potsRef = useRef<HTMLDivElement>(null)
  const letters = q.letters!

  function plant(i: number) {
    if (answered || used.includes(i)) return
    if (letters[i] === word[pos]) {
      sfx.tap()
      const nextUsed = [...used, i]
      setUsed(nextUsed)
      const np = pos + 1
      setPos(np)
      if (np === word.length) {
        sayItem(q.item, 'w')
        // 한 번까지 틀린 건 맞은 걸로 (아이들이 지치지 않게)
        setTimeout(() => onAnswer(q.item.word, potsRef.current, miss <= 1 ? 'correct' : 'wrong'), 250)
      }
    } else {
      setMiss((m) => m + 1)
      setShake(i)
      setTimeout(() => setShake(null), 420)
    }
  }
  const hintIndex = miss >= 2 ? letters.findIndex((c, i) => !used.includes(i) && c === word[pos]) : -1

  return (
    <>
      <Hint>씨앗을 순서대로 심어 영어 단어를 만들어요</Hint>
      <div className="flex items-center justify-center gap-4">
        {q.item.emoji ? <Emo ch={q.item.emoji} size={70} label={q.item.meaning_ko} /> : null}
        <div>
          <b className="block font-display text-[26px] font-normal">{q.item.meaning_ko}</b>
          <SpeakBtn label="듣기" onClick={() => sayItem(q.item, 'w')} />
        </div>
      </div>
      <div ref={potsRef} className="flex justify-center gap-1.5 pt-6">
        {[...word].map((c, i) => (
          <span key={i} className={`relative grid h-[50px] w-[40px] place-items-center rounded-[6px_6px_16px_16px] bg-[#C98C5A] pt-1.5 font-display text-[25px] text-white shadow-[inset_0_7px_0_#B07548] ${i < pos ? 'anim-bump' : ''}`}>
            {i < pos && <><span className="absolute -top-5 text-[16px]" aria-hidden="true">🌱</span>{c}</>}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap justify-center gap-2.5">
        {letters.map((c, i) => (
          <button key={i} type="button" onClick={() => plant(i)} disabled={!!answered}
            className={`size-[54px] rounded-[50%_50%_44%_44%] bg-[#8A5A3B] font-display text-[25px] text-[#FFF6E6] shadow-[0_3px_0_#6B4329] ${used.includes(i) ? 'invisible' : ''} ${shake === i ? 'anim-shake' : ''} ${hintIndex === i ? 'anim-pulse' : ''}`}>
            {c}
          </button>
        ))}
      </div>
      <p className="m-0 min-h-5 text-center text-[14px] text-ink2">{miss >= 2 && !answered ? '반짝이는 씨앗을 눌러 봐!' : miss === 1 && !answered ? '다른 씨앗을 골라 봐!' : ''}</p>
    </>
  )
}

// 🃏 짝 맞추기: 영어 4~5개 ↔ 그림. 영어를 누르면 발음, 맞으면 꽃이 핀다.
export function MatchQ({ q, answered, onMany }: QProps) {
  const group = q.group!
  const right = q.picks!
  const [sel, setSel] = useState<{ en?: Item; pic?: Item }>({})
  const [done, setDone] = useState<string[]>([])
  const [bad, setBad] = useState<string[]>([])
  const first = useRef(new Map<string, string>()) // 영어 단어별 처음 고른 그림 (채점용)
  const box = useRef<HTMLDivElement>(null)
  const finished = done.length === group.length

  const results = useMemo(() => group.map((g) => ({ item: g, value: first.current.get(g.id) ?? g.id })), [group, finished]) // eslint-disable-line react-hooks/exhaustive-deps

  function pick(side: 'en' | 'pic', it: Item) {
    if (answered || done.includes(it.id)) return
    if (side === 'en') sayItem(it, 'w')
    else sfx.tap()
    const next = { ...sel, [side]: it }
    setSel(next)
    if (!next.en || !next.pic) return
    if (!first.current.has(next.en.id)) first.current.set(next.en.id, next.pic.id)
    if (next.en.id === next.pic.id) {
      const nd = [...done, it.id]
      setDone(nd)
      sfx.good(nd.length)
      setSel({})
      if (nd.length === group.length) setTimeout(() => onMany?.(results.map((r) => ({ ...r, value: first.current.get(r.item.id) ?? r.item.id })), box.current), 450)
    } else {
      sfx.bad()
      setBad([next.en.id, next.pic.id])
      setTimeout(() => { setBad([]); setSel({}) }, 450)
    }
  }

  const cardLook = (id: string, side: 'en' | 'pic') =>
    done.includes(id) ? 'bg-good-bg text-good shadow-[0_3px_0_var(--color-good)] after:absolute after:-right-1 after:-top-2 after:content-["🌷"] after:text-[18px]'
      : bad.includes(id) && (side === 'en' ? sel.en?.id === id : sel.pic?.id === id) ? 'bg-bad-bg shadow-[0_3px_0_var(--color-bad)] anim-shake'
      : (side === 'en' ? sel.en?.id === id : sel.pic?.id === id) ? 'bg-leaf-bg shadow-[0_3px_0_var(--color-leaf)] -translate-y-0.5'
      : 'bg-sheet shadow-[0_3px_0_var(--color-line)]'

  return (
    <>
      <Hint>같은 뜻끼리 짝을 지어요</Hint>
      <div ref={box} className="grid grid-cols-2 gap-3">
        <div className="grid gap-2.5">
          {group.map((g) => (
            <button key={g.id} type="button" onClick={() => pick('en', g)} disabled={done.includes(g.id)}
              className={`relative min-h-[62px] rounded-[18px] font-display text-[21px] transition ${cardLook(g.id, 'en')}`}>{g.word}</button>
          ))}
        </div>
        <div className="grid gap-2.5">
          {right.map((g) => (
            <button key={g.id} type="button" onClick={() => pick('pic', g)} disabled={done.includes(g.id)} aria-label={g.meaning_ko}
              className={`relative grid min-h-[62px] place-items-center rounded-[18px] transition ${cardLook(g.id, 'pic')}`}>
              <Emo ch={g.emoji!} size={40} />
            </button>
          ))}
        </div>
      </div>
      <p className="m-0 text-center text-[14px] text-ink2">영어 단어를 누르면 소리도 나요</p>
    </>
  )
}
