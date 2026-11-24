import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Question, Result } from '../lib/quiz'
import { sfx } from '../sound/sfx'
import { canListen, listenOnce, markSpeechBlocked, sayItem, speechErrorMessage } from '../sound/voice'
import { normEn } from '../lib/quiz'

export type Answered = { value: string; ok: boolean; result: Result } | null
export type QProps = {
  q: Question
  answered: Answered
  reveal: boolean // 답을 낸 뒤 정답 표시 (레벨 테스트 · 시험은 안 보여 줌)
  onAnswer: (value: string, el: HTMLElement | null, forced?: Result) => void
}

export function Hint({ children }: { children: ReactNode }) {
  return <p className="m-0 mt-1 text-[15px] font-semibold text-ink2">{children}</p>
}

export function SpeakBtn({ onClick, big = false, label = '듣기' }: { onClick: () => void; big?: boolean; label?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={
        big
          ? 'mx-auto grid size-[92px] place-items-center rounded-full bg-leaf text-[38px] text-white shadow-btn active:translate-y-[2px] active:shadow-none'
          : 'grid size-10 shrink-0 place-items-center rounded-full border border-line bg-paper text-[18px]'
      }
    >
      🔊
    </button>
  )
}

function WordCard({ children, onSay }: { children: ReactNode; onSay?: () => void }) {
  return (
    <div className="relative grid justify-items-center gap-1.5 rounded-card bg-sheet px-4 pb-6 pt-7 text-center shadow-card">
      {onSay && <div className="absolute right-2.5 top-2.5"><SpeakBtn onClick={onSay} /></div>}
      {children}
    </div>
  )
}

// 4지선다 공통
function Options({ options, correct, answered, reveal, onAnswer, english = false }: {
  options: string[]; correct: string; answered: Answered; reveal: boolean; english?: boolean
  onAnswer: QProps['onAnswer']
}) {
  return (
    <div className="grid gap-2.5">
      {options.map((o, i) => {
        const picked = answered?.value === o
        let look = 'bg-sheet shadow-[0_2px_0_var(--color-line)]'
        if (answered && reveal) {
          if (picked && answered.ok) look = 'bg-good-bg text-good shadow-[0_2px_0_var(--color-good)] anim-pop'
          else if (picked) look = 'bg-bad-bg text-bad shadow-[0_2px_0_var(--color-bad)] anim-shake'
          else if (o === correct) look = 'bg-sheet outline-2 outline-dashed outline-good'
        } else if (answered && picked) look = 'bg-leaf-bg'
        return (
          <button
            key={o}
            type="button"
            disabled={!!answered}
            onClick={(e) => onAnswer(o, e.currentTarget)}
            className={`flex items-center gap-3 rounded-btn px-3.5 py-3.5 text-left text-[19px] transition active:scale-[.99] ${english ? 'font-display' : 'font-display'} ${look}`}
          >
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-paper text-[13px] text-ink2">{i + 1}</span>
            <span>{o}</span>
          </button>
        )
      })}
    </div>
  )
}

export function MeaningQ({ q, answered, reveal, onAnswer }: QProps) {
  useEffect(() => { sayItem(q.item, 'w') }, [q.key]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <Hint>이 단어의 뜻을 고르세요</Hint>
      <WordCard onSay={() => sayItem(q.item, 'w')}>
        <div className="font-display text-[42px] leading-tight text-leaf-ink">{q.item.word}</div>
        <div className="text-[13px] text-ink2">{posName(q.item.pos)}</div>
      </WordCard>
      <Options options={q.options!} correct={q.item.meaning_ko} answered={answered} reveal={reveal} onAnswer={onAnswer} />
    </>
  )
}

export function ListenQ({ q, answered, reveal, onAnswer }: QProps) {
  useEffect(() => { sayItem(q.item, 'w') }, [q.key]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <Hint>잘 듣고 알맞은 단어를 고르세요</Hint>
      <div className="py-2"><SpeakBtn big label="다시 듣기" onClick={() => sayItem(q.item, 'w')} /></div>
      <Options options={q.options!} correct={q.item.word} answered={answered} reveal={reveal} onAnswer={onAnswer} english />
    </>
  )
}

export function BlankQ({ q, answered, reveal, onAnswer }: QProps) {
  const parts = q.blanked!.split('_____')
  const filled = answered && reveal ? q.item.word : null
  return (
    <>
      <Hint>빈칸에 들어갈 단어를 고르세요</Hint>
      <WordCard>
        <p className="m-0 font-display text-[22px] leading-relaxed">
          {parts[0]}
          <span className={`mx-1 inline-block min-w-16 border-b-2 px-1 ${filled ? 'border-good text-good' : 'border-ink2 text-transparent'}`}>
            {filled ?? '____'}
          </span>
          {parts[1]}
        </p>
        <p className="m-0 text-[14px] text-ink2">{q.item.example_ko}</p>
      </WordCard>
      <Options options={q.options!} correct={q.item.word} answered={answered} reveal={reveal} onAnswer={onAnswer} english />
    </>
  )
}

export function BuildQ({ q, answered, reveal, onAnswer }: QProps) {
  const [picked, setPicked] = useState<number[]>([])
  const lineRef = useRef<HTMLDivElement>(null)
  const tiles = q.tiles!
  const value = picked.map((i) => tiles[i]).join(' ')
  const tone = answered && reveal ? (answered.ok ? 'bg-good-bg text-good' : 'bg-bad-bg text-bad') : 'bg-sheet'
  return (
    <>
      <Hint>영어 문장으로 만들어 보세요</Hint>
      <WordCard onSay={answered ? () => sayItem(q.item, 's') : undefined}>
        <p className="m-0 font-display text-[21px] leading-relaxed">{q.item.example_ko}</p>
      </WordCard>
      <div
        ref={lineRef}
        className={`flex min-h-[104px] flex-wrap content-start gap-2 border-b-2 border-line py-2 ${answered && !answered.ok && reveal ? 'anim-shake' : ''}`}
        aria-label="내가 만든 문장"
      >
        {picked.map((ti, k) => (
          <button key={`${ti}-${k}`} type="button" disabled={!!answered}
            onClick={() => setPicked(picked.filter((_, x) => x !== k))}
            className={`rounded-[12px] px-3 py-2 font-display text-[18px] shadow-[0_2px_0_var(--color-line)] ${tone}`}>
            {tiles[ti]}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {tiles.map((t, ti) => (
          <button key={ti} type="button" disabled={!!answered}
            onClick={() => setPicked([...picked, ti])}
            className={`rounded-[12px] bg-sheet px-3 py-2 font-display text-[18px] shadow-[0_2px_0_var(--color-line)] ${picked.includes(ti) ? 'invisible' : ''}`}>
            {t}
          </button>
        ))}
      </div>
      {answered && reveal && !answered.ok && <p className="m-0 text-center font-display text-[17px] text-good">{q.item.example_en}</p>}
      {!answered && (
        <button type="button" disabled={picked.length === 0}
          onClick={() => onAnswer(value, lineRef.current)}
          className="rounded-btn bg-leaf px-4 py-3.5 font-display text-lg text-white shadow-btn disabled:opacity-40">
          확인
        </button>
      )}
    </>
  )
}

export function WriteQ({ q, answered, reveal, onAnswer }: QProps) {
  const [text, setText] = useState('')
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { ref.current?.focus() }, [q.key])
  const look = answered && reveal ? (answered.ok ? 'border-good bg-good-bg text-good' : 'border-bad bg-bad-bg text-bad anim-shake') : 'border-line bg-white'
  return (
    <>
      <Hint>영어 단어로 써 보세요</Hint>
      <WordCard>
        <div className="font-display text-[34px] leading-tight">{q.item.meaning_ko}</div>
        <div className="text-[13px] text-ink2">{posName(q.item.pos)} · 첫 글자 <b>{q.item.word[0]}</b> · {q.item.word.length}글자</div>
      </WordCard>
      <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) onAnswer(text, ref.current) }} className="grid gap-2.5">
        <input ref={ref} value={text} onChange={(e) => setText(e.target.value)} disabled={!!answered}
          autoCapitalize="off" autoCorrect="off" spellCheck={false} autoComplete="off" lang="en"
          className={`w-full rounded-btn border-2 px-4 py-3.5 text-center font-display text-[24px] outline-none focus:border-leaf ${look}`} />
        {answered && reveal && !answered.ok && <p className="m-0 text-center font-display text-[18px] text-good">정답: {q.item.word}</p>}
        {!answered && (
          <button type="submit" disabled={!text.trim()} className="rounded-btn bg-leaf px-4 py-3.5 font-display text-lg text-white shadow-btn disabled:opacity-40">확인</button>
        )}
      </form>
    </>
  )
}

const MIC_NOTE_KEY = 'wg_mic_note'
export function SpeakQ({ q, answered, onAnswer }: QProps) {
  const [tries, setTries] = useState(0)
  const [heard, setHeard] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<{ text: string; blocked: boolean } | null>(
    canListen() ? null : speechErrorMessage('unsupported'),
  )
  const [note, setNote] = useState(() => { try { return !localStorage.getItem(MIC_NOTE_KEY) } catch { return false } })
  const btn = useRef<HTMLButtonElement>(null)
  const target = normEn(q.item.word)

  async function talk() {
    if (note) { try { localStorage.setItem(MIC_NOTE_KEY, '1') } catch { /* 무시 */ } setNote(false) }
    setProblem(null)
    setBusy(true)
    let alts: string[] = []
    try {
      alts = await listenOnce()
    } catch (e) {
      setBusy(false)
      const p = speechErrorMessage((e as Error).message)
      if (p) {
        // 마이크 · 음성 인식이 막힌 경우: 오답으로 세지 않고, 이번 접속 동안 말하기 문제를 다른 유형으로 낸다
        setProblem(p)
        if (p.blocked && (e as Error).message !== 'not-allowed') markSpeechBlocked()
        return
      }
    }
    setBusy(false)
    if (alts.length === 0) {
      setHeard('')
      setProblem({ text: '잘 안 들렸어요. 버튼을 누른 뒤 조금 더 크게 말해 볼까요?', blocked: false })
      return // 소리가 안 들어온 건 기회로 세지 않음
    }
    const ok = alts.some((a) => ` ${normEn(a)} `.includes(` ${target} `))
    setHeard(alts[0])
    const n = tries + 1
    setTries(n)
    if (ok) onAnswer(alts[0], btn.current, 'correct')
    else if (n >= 3) onAnswer(alts[0], btn.current, 'wrong')
  }

  return (
    <>
      <Hint>소리 내어 말해 보세요</Hint>
      <WordCard onSay={() => sayItem(q.item, 'w')}>
        <div className="font-display text-[42px] leading-tight text-leaf-ink">{q.item.word}</div>
        <div className="text-[14px] text-ink2">{q.item.meaning_ko}</div>
      </WordCard>
      {note && <p className="m-0 rounded-[14px] bg-leaf-bg px-3.5 py-2.5 text-[13px] text-leaf-ink">🎙 음성은 글자로 바꾸는 데만 쓰이고 저장하지 않아요.</p>}
      {!answered && !(problem?.blocked && problem.text.includes('브라우저')) && (
        <button ref={btn} type="button" onClick={talk} disabled={busy}
          className={`mx-auto grid size-[92px] place-items-center rounded-full bg-leaf text-[38px] text-white shadow-btn ${busy ? 'anim-pulse' : ''}`}
          aria-label="눌러서 말하기">🎙</button>
      )}
      <p className="m-0 min-h-6 text-center text-[15px] text-ink2">
        {busy ? '듣고 있어요… 지금 말해 주세요 🎙'
          : heard ? <>이렇게 들렸어요: <b className="text-ink">{heard}</b>{!answered && ` (${tries}/3)`}</>
          : problem ? '' : '버튼을 누른 뒤 단어를 소리 내어 말해 주세요'}
      </p>
      {problem && !answered && (
        <p role="alert" className={`m-0 rounded-[14px] px-3.5 py-3 text-[14px] leading-snug ${problem.blocked ? 'bg-bad-bg text-bad' : 'bg-leaf-bg text-leaf-ink'}`}>
          {problem.text}
        </p>
      )}
      {!answered && (
        <button type="button" onClick={() => onAnswer('', null, 'skipped')}
          className={problem?.blocked
            ? 'rounded-btn bg-leaf px-4 py-3.5 font-display text-lg text-white shadow-btn'
            : 'self-center py-1.5 text-[14px] text-ink2 underline underline-offset-4'}>
          {problem?.blocked ? '건너뛰기 (틀린 걸로 세지 않아요)' : '지금은 말할 수 없어요'}
        </button>
      )}
    </>
  )
}

// 카드 복습: 떠올린 뒤 뒤집고, 스스로 다시 · 어려움 · 알맞음 · 쉬움 (기획 Q6 7번)
export function CardQ({ q, answered, onAnswer }: QProps & { onGrade?: never }) {
  const [flipped, setFlipped] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { sayItem(q.item, 'w') }, [q.key]) // eslint-disable-line react-hooks/exhaustive-deps
  function flip() {
    if (flipped) return
    setFlipped(true)
    sfx.flip()
  }
  const grades = [
    { g: 0, t: '다시', s: '1일 뒤', c: 'text-bad' },
    { g: 1, t: '어려움', s: '그대로', c: 'text-ink2' },
    { g: 2, t: '알맞음', s: '한 단계 ↑', c: 'text-leaf' },
    { g: 3, t: '쉬움', s: '두 단계 ↑', c: 'text-good' },
  ]
  return (
    <>
      <Hint>뜻을 떠올린 뒤 카드를 눌러 뒤집어 보세요</Hint>
      <div ref={ref} role="button" tabIndex={0} aria-label="카드 뒤집기" onClick={flip}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip() } }}
        className="h-[300px] cursor-pointer [perspective:1200px]">
        <div className={`relative size-full transition-[transform,opacity] duration-500 [transform-style:preserve-3d] ${flipped ? '[transform:rotateY(180deg)]' : ''} ${answered ? 'opacity-0 [transform:rotateY(180deg)_translateX(-120%)_rotate(8deg)]' : ''}`}>
          <div className="absolute inset-0 grid place-content-center justify-items-center gap-2 rounded-card bg-sheet p-5 text-center shadow-card [backface-visibility:hidden]">
            <div className="font-display text-[44px] leading-tight text-leaf-ink">{q.item.word}</div>
            <p className="m-0 text-[13px] text-ink2">눌러서 뒤집기</p>
          </div>
          <div className="absolute inset-0 grid place-content-center justify-items-center gap-2.5 rounded-card bg-sheet p-5 text-center shadow-card [backface-visibility:hidden] [transform:rotateY(180deg)]">
            <div className="font-display text-[30px]">{q.item.meaning_ko}</div>
            <p className="m-0 font-display text-[17px] leading-snug">{q.item.example_en}</p>
            <p className="m-0 text-[14px] text-ink2">{q.item.example_ko}</p>
          </div>
        </div>
      </div>
      <button type="button" onClick={() => sayItem(q.item, flipped ? 's' : 'w')} className="rounded-btn bg-leaf-bg px-4 py-3 font-display text-[17px] text-leaf-ink">
        🔊 {flipped ? '예문 듣기' : '단어 듣기'}
      </button>
      {flipped && !answered && (
        <div className="grid grid-cols-4 gap-2">
          {grades.map((x) => (
            <button key={x.g} type="button" onClick={() => onAnswer(String(x.g), ref.current, x.g === 0 ? 'wrong' : 'correct')}
              className={`grid gap-0.5 rounded-btn bg-sheet px-1 py-2.5 font-display text-[16px] shadow-[0_2px_0_var(--color-line)] ${x.c}`}>
              {x.t}<small className="font-body text-[11.5px] text-ink2">{x.s}</small>
            </button>
          ))}
        </div>
      )}
    </>
  )
}

export function posName(pos: string) {
  return ({ 명: '명사', 동: '동사', 형: '형용사', 부: '부사' } as Record<string, string>)[pos] ?? pos
}
