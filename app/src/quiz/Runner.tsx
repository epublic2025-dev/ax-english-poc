import { useCallback, useState } from 'react'
import { authMessage } from '../lib/messages'
import { grade, type AnswerRec, type Question, type Result } from '../lib/quiz'
import { supabase } from '../lib/supabase'
import { sfx } from '../sound/sfx'
import { sayItem } from '../sound/voice'
import { BlankQ, BuildQ, CardQ, ListenQ, MeaningQ, SpeakBtn, SpeakQ, WriteQ, type Answered, type QProps } from './Questions'
import { ButterflyQ, MatchQ, PicQ, SeedQ } from './Junior'
import { Buddy } from '../garden/Buddy'
import type { Item } from '../lib/data'

type Mode = 'lesson' | 'review' | 'placement' | 'exam'
type Fx = { id: number; kind: 'leaf' | 'xp' | 'rain'; x: number; y: number; ch?: string; dx?: number; dy?: number; rot?: number; xp?: number }
let fxSeq = 0

const VIEW: Partial<Record<Question['type'], (p: QProps) => React.JSX.Element>> = {
  meaning: MeaningQ, listen: ListenQ, blank: BlankQ, build: BuildQ, write: WriteQ, speak: SpeakQ, card: CardQ,
  pic: PicQ, butterfly: ButterflyQ, seed: SeedQ, match: MatchQ,
}

// 주니어(초등): 새싹이 말 · 자라는 화분 (2_설계.md 6-1)
const GOOD_MSG = ['와, 맞았어!', '최고야! 쑥쑥 자란다!', '정말 잘했어!', '척척박사네!']
const BAD_MSG = ['괜찮아, 다시 해 보자!', '아깝다! 정답 소리를 들어 봐', '틀려도 괜찮아, 기억하면 돼!']
const PLANT = ['🌰', '🌱', '🌿', '🪴', '🌷']
let msgTurn = 0

// 문제를 차례로 내고, 효과 · 소리 · 결과 안내를 보여 준 뒤 답 묶음을 돌려준다
export function Runner({ questions, mode, onDone, onExit, allowDontKnow = false, junior = false }: {
  questions: Question[]
  mode: Mode
  onDone: (answers: AnswerRec[]) => void
  onExit: () => void
  allowDontKnow?: boolean
  junior?: boolean
}) {
  const [say, setSay] = useState<{ text: string; mood: 'happy' | 'sad' | '' }>({ text: '하나씩 천천히 해 보자!', mood: '' })
  const [i, setI] = useState(0)
  const [answers, setAnswers] = useState<AnswerRec[]>([])
  const [answered, setAnswered] = useState<Answered>(null)
  const [streak, setStreak] = useState(0)
  const [fx, setFx] = useState<Fx[]>([])
  const [reporting, setReporting] = useState(false)
  const [quitAsk, setQuitAsk] = useState(false)
  const reveal = mode === 'lesson' || mode === 'review'
  const q = questions[i]

  const addFx = useCallback((items: Omit<Fx, 'id'>[], ms: number) => {
    const withId = items.map((f) => ({ ...f, id: ++fxSeq }))
    setFx((cur) => [...cur, ...withId])
    setTimeout(() => setFx((cur) => cur.filter((f) => !withId.includes(f))), ms)
  }, [])

  function celebrate(el: HTMLElement | null) {
    const r = el?.getBoundingClientRect()
    const x = r ? r.left + r.width / 2 : window.innerWidth / 2
    const y = r ? r.top + r.height / 2 : window.innerHeight / 2
    addFx(['🍃', '🌱', '🍃', '🌿', '🍃'].map((ch, k) => ({ kind: 'leaf' as const, ch, x: x - 10, y: y - 12, dx: (k - 2) * 34, dy: -50 - (k % 2) * 30, rot: (k - 2) * 40 })), 850)
    addFx([{ kind: 'xp', x, y: y - 20 }], 950)
  }

  function next(list: AnswerRec[]) {
    setAnswered(null)
    if (i + 1 >= questions.length) onDone(list)
    else setI(i + 1)
  }

  // 맞았을 때 연속 정답 · 주니어 물방울(5개마다 비 + 보너스)
  function goodStreak(by = 1) {
    const before = streak
    const s = streak + by
    setStreak(s)
    if (junior) {
      if (Math.floor(s / 5) > Math.floor(before / 5)) {
        addFx([{ kind: 'rain', x: 0, y: 0 }], 1900)
        setSay({ text: '물방울 5개! 비가 내려요 🌧 보너스 +20 XP', mood: 'happy' })
      } else {
        setSay({ text: GOOD_MSG[msgTurn++ % GOOD_MSG.length], mood: 'happy' })
      }
    }
    return s
  }
  function badStreak() {
    setStreak(0)
    if (junior) setSay({ text: BAD_MSG[msgTurn++ % BAD_MSG.length], mood: 'sad' })
  }

  // 짝 맞추기: 한 문제에서 단어 여러 개를 기록
  function onMany(recs: { item: Item; value: string }[], el: HTMLElement | null) {
    if (answered) return
    const add: AnswerRec[] = recs.map((r) => ({ item_id: r.item.id, qtype: 'match', answer: r.value }))
    const list = [...answers, ...add]
    setAnswers(list)
    const okCount = recs.filter((r) => r.value === r.item.id).length
    setAnswered({ value: '', ok: okCount === recs.length, result: okCount === recs.length ? 'correct' : 'wrong' })
    if (okCount > 0) { goodStreak(okCount); celebrate(el) } else badStreak()
    if (junior && okCount === recs.length) setSay({ text: '모두 짝을 찾았어! 꽃이 활짝 🌷', mood: 'happy' })
    setTimeout(() => next(list), 900)
  }

  function onAnswer(value: string, el: HTMLElement | null, forced?: Result) {
    if (answered) return
    const result: Result = forced ?? (grade(q, value) ? 'correct' : 'wrong')
    const rec: AnswerRec = { item_id: q.item.id, qtype: q.type, answer: value }
    if (q.type === 'speak' || q.type === 'seed') rec.result = result
    if (q.type === 'card') rec.grade = Number(value)
    const list = [...answers, rec]
    setAnswers(list)
    if (q.type === 'card') {
      // 카드는 스스로 채점: 안내창 없이 옆으로 넘김
      setAnswered({ value, ok: result === 'correct', result })
      if (result === 'correct') sfx.good(goodStreak())
      else { badStreak(); sfx.bad() }
      setTimeout(sfx.swipe, 160)
      setTimeout(() => next(list), 450)
      return
    }
    if (!reveal) {
      sfx.tap()
      setAnswered({ value, ok: result === 'correct', result })
      setTimeout(() => next(list), 220)
      return
    }
    setAnswered({ value, ok: result === 'correct', result })
    if (result === 'correct') {
      sfx.good(goodStreak())
      celebrate(el)
    } else if (result === 'wrong') {
      badStreak()
      sfx.bad()
      setTimeout(() => sayItem(q.item, q.type === 'build' ? 's' : 'w'), 520) // 틀리면 정답 발음
    } else {
      sfx.tap()
    }
  }

  function dontKnow() {
    if (answered) return
    const list = [...answers, { item_id: q.item.id, qtype: q.type, answer: '', dont_know: true }]
    setAnswers(list)
    sfx.tap()
    next(list)
  }

  const View = VIEW[q.type]
  const done = i + (answered ? 1 : 0)
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col gap-3.5 px-[18px] pb-36 pt-[max(14px,env(safe-area-inset-top))]">
      <div className="flex items-center gap-2.5">
        <button type="button" aria-label="그만하기" className="grid size-9 place-items-center text-[20px] text-ink2"
          onClick={() => (answers.length === 0 ? onExit() : setQuitAsk(true))}>✕</button>
        {junior && <span key={PLANT[Math.min(4, Math.floor((done / questions.length) * 5))]} className="anim-bump text-[26px] leading-none" aria-hidden="true">{PLANT[Math.min(4, Math.floor((done / questions.length) * 5))]}</span>}
        <div className="h-3 flex-1 overflow-hidden rounded-full bg-[#E4ECDD]">
          <div className="h-full rounded-full bg-[linear-gradient(90deg,#7DB36B,var(--color-leaf))] transition-[width] duration-300" style={{ width: `${(done / questions.length) * 100}%` }} />
        </div>
        {junior ? (
          <span className="flex gap-1" title="연속 정답 물방울" aria-label={`연속 정답 ${streak}`}>
            {[0, 1, 2, 3, 4].map((k) => (
              <i key={k} className={`block size-3 -rotate-45 rounded-[50%_0_50%_50%] transition-colors ${k < (streak === 0 ? 0 : streak % 5 || 5) ? 'bg-drop' : 'bg-[#DCE8F3]'}`} />
            ))}
          </span>
        ) : (
          reveal && streak >= 2 && <span key={streak} className="anim-bump whitespace-nowrap text-[13px] font-bold text-bad">🔥 연속 {streak}</span>
        )}
      </div>

      {View ? <View key={q.key} q={q} answered={answered} reveal={reveal} onAnswer={onAnswer} onMany={onMany} /> : <p>이 유형은 준비 중이에요.</p>}

      {junior && reveal && (
        <div className="mt-auto flex items-end gap-2">
          <span key={`${say.mood}-${say.text}`} className={say.mood === 'happy' ? 'buddy-hop' : say.mood === 'sad' ? 'buddy-droop' : ''}>
            <Buddy size={54} />
          </span>
          <p className="m-0 mb-5 rounded-[16px_16px_16px_4px] bg-sheet px-3 py-2 font-display text-[16px] leading-snug shadow-[0_2px_0_var(--color-line)]">{say.text}</p>
        </div>
      )}

      {allowDontKnow && !answered && (
        <button type="button" onClick={dontKnow} className="self-center rounded-full border border-line bg-sheet px-5 py-2 text-[15px] text-ink2">
          모르겠어요
        </button>
      )}

      {/* 결과 안내 (아래에서 올라옴) */}
      {answered && reveal && q.type !== 'card' && q.type !== 'match' && (
        <div className={`anim-sheet fixed inset-x-0 bottom-0 z-40 border-t-[3px] ${answered.ok ? 'border-good bg-good-bg' : answered.result === 'skipped' ? 'border-line bg-sheet' : 'border-bad bg-bad-bg'}`}>
          <div className="mx-auto grid max-w-[440px] gap-2 px-[18px] pb-[max(20px,env(safe-area-inset-bottom))] pt-4">
            <div className="flex items-center justify-between">
              <p className={`m-0 font-display text-[21px] ${answered.ok ? 'text-good' : answered.result === 'skipped' ? 'text-ink2' : 'text-bad'}`}>
                {answered.ok ? '맞았어요!' : answered.result === 'skipped' ? '다음에 말해 봐요' : q.type === 'meaning' ? `정답은 “${q.item.meaning_ko}”` : `정답은 “${q.item.word}”`}
              </p>
              <button type="button" onClick={() => setReporting(true)} className="text-[13px] text-ink2">🚩 오류 신고</button>
            </div>
            <p className="m-0 flex items-center gap-2 font-display text-[17px] leading-snug">
              <SpeakBtn label="예문 듣기" onClick={() => sayItem(q.item, 's')} />
              <span>{q.item.example_en}</span>
            </p>
            <p className="m-0 text-[14px] text-ink2">{q.item.example_ko}</p>
            <button type="button" autoFocus onClick={() => next(answers)}
              className={`mt-1 rounded-btn px-4 py-3.5 font-display text-lg text-white ${answered.ok ? 'bg-good' : answered.result === 'skipped' ? 'bg-leaf' : 'bg-bad'}`}>
              계속
            </button>
          </div>
        </div>
      )}

      {reporting && <ReportSheet q={q} onClose={() => setReporting(false)} />}

      {/* ✕ 그만하기 확인 (브라우저 확인창 대신 앱 안에서 그림) */}
      {quitAsk && (
        <div className="fixed inset-0 z-50 grid items-end bg-black/30" onClick={() => setQuitAsk(false)}>
          <div role="dialog" aria-modal="true" aria-label="그만하기 확인" onClick={(e) => e.stopPropagation()}
            className="anim-sheet mx-auto grid w-full max-w-[440px] gap-3 rounded-t-[22px] bg-sheet p-5 pb-[max(20px,env(safe-area-inset-bottom))]">
            <p className="m-0 font-display text-[21px]">그만할까요?</p>
            <p className="m-0 text-[15px] leading-relaxed text-ink2">
              {questions.length - answers.length}문제 남았어요. 지금 그만하면 {mode === 'placement' ? '레벨 테스트를 처음부터 다시 봐야 해요.' : '지금까지 푼 문제는 저장되지 않아요.'}
            </p>
            <button type="button" autoFocus onClick={() => setQuitAsk(false)} className="rounded-btn bg-leaf px-4 py-3.5 font-display text-lg text-white shadow-btn">
              계속 풀기
            </button>
            <button type="button" onClick={onExit} className="rounded-btn bg-bad-bg px-4 py-3.5 font-display text-lg text-bad">
              그만하기
            </button>
          </div>
        </div>
      )}

      {fx.map((f) =>
        f.kind === 'rain' ? (
          <div key={f.id} className="pointer-events-none fixed inset-0 z-[55] overflow-hidden" aria-hidden="true">
            {Array.from({ length: 46 }, (_, k) => (
              <i key={k} className="rain-drop" style={{ left: `${(k * 37) % 100}%`, animationDuration: `${0.6 + ((k * 13) % 50) / 100}s`, animationDelay: `${((k * 7) % 60) / 100}s` }} />
            ))}
          </div>
        ) : f.kind === 'leaf' ? (
          <span key={f.id} className="fx-leaf" style={{ left: f.x, top: f.y, ['--dx' as string]: `${f.dx}px`, ['--dy' as string]: `${f.dy}px`, ['--rot' as string]: `${f.rot}deg` }}>{f.ch}</span>
        ) : (
          <span key={f.id} className="fx-xp" style={{ left: f.x, top: f.y }}>+10 XP</span>
        ),
      )}
    </div>
  )
}

function ReportSheet({ q, onClose }: { q: Question; onClose: () => void }) {
  const [msg, setMsg] = useState('')
  const [state, setState] = useState<'' | 'sending' | 'sent' | string>('')
  async function send() {
    setState('sending')
    const { error } = await supabase.rpc('report_item', { p_item_id: q.item.id, p_qtype: q.type, p_message: msg })
    setState(error ? authMessage(error) : 'sent')
  }
  return (
    <div className="fixed inset-0 z-50 grid items-end bg-black/30" onClick={onClose}>
      <div className="mx-auto grid w-full max-w-[440px] gap-3 rounded-t-[22px] bg-sheet p-5" onClick={(e) => e.stopPropagation()}>
        <p className="m-0 font-display text-[20px]">이 문제에 오류가 있어요</p>
        <p className="m-0 text-[14px] text-ink2">{q.item.word} · {q.item.meaning_ko} · {q.item.example_en}</p>
        {state === 'sent' ? (
          <>
            <p className="m-0 rounded-[14px] bg-good-bg px-3.5 py-3 text-[14px] text-good">고마워요! 관리자가 확인하고 고칠게요.</p>
            <button type="button" onClick={onClose} className="rounded-btn bg-leaf px-4 py-3 font-display text-lg text-white">닫기</button>
          </>
        ) : (
          <>
            <textarea value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={500} rows={3} placeholder="무엇이 이상한지 짧게 적어 주세요 (선택)"
              className="rounded-[14px] border border-line bg-white p-3 text-[15px] outline-none focus:border-leaf" />
            {state && state !== 'sending' && <p className="m-0 text-[14px] text-bad">{state}</p>}
            <button type="button" onClick={send} disabled={state === 'sending'} className="rounded-btn bg-leaf px-4 py-3 font-display text-lg text-white disabled:opacity-50">보내기</button>
          </>
        )}
      </div>
    </div>
  )
}
