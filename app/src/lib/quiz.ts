import type { Item } from './data'
import type { Course } from './supabase'

// 문제 유형 (2_설계.md 6-2) — 기본 7가지 + 주니어 4가지
export type QType = 'meaning' | 'listen' | 'blank' | 'build' | 'write' | 'speak' | 'card' | 'pic' | 'match' | 'seed' | 'butterfly'

export type Question = {
  key: string
  type: QType
  item: Item
  options?: string[] // meaning: 한글 뜻 / listen · blank: 영어 단어
  blanked?: string // blank: 빈칸 문장
  tiles?: string[] // build: 단어 블록 (섞임 + 함정 2개)
  picks?: Item[] // pic · butterfly: 보기 단어 4개 / match: 오른쪽 그림 순서
  group?: Item[] // match: 짝을 지을 단어 (최대 5개)
  letters?: string[] // seed: 알파벳 씨앗 (섞임 + 함정 2개)
}

export type Result = 'correct' | 'wrong' | 'skipped'
export type AnswerRec = {
  item_id: string
  qtype: QType
  answer?: string
  result?: Result
  grade?: number
  dont_know?: boolean
}

// DB 의 private.norm_en 과 같은 규칙
export function normEn(s: string) {
  return s
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9' -]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function shuffle<T>(a: T[]): T[] {
  const b = [...a]
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[b[i], b[j]] = [b[j], b[i]]
  }
  return b
}

function pickDistinct(values: string[], exclude: string, n: number): string[] {
  const seen = new Set([exclude])
  const out: string[] = []
  for (const v of shuffle(values)) {
    if (seen.has(v)) continue
    seen.add(v)
    out.push(v)
    if (out.length === n) break
  }
  return out
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
export function blankOut(sentence: string, word: string) {
  const re = new RegExp(`(^|[^A-Za-z])${escapeRe(word)}(?![A-Za-z])`, 'i')
  return sentence.replace(re, (_m, pre: string) => `${pre}_____`)
}

let seq = 0
// 보기는 같은 레슨 → 같은 레벨 → 코스 순서로 고른다 (헷갈리는 보기가 비슷한 수준에서 나오게)
export function makeQuestion(type: QType, item: Item, pool: Item[]): Question {
  const key = `${type}-${item.id}-${++seq}`
  const lessonId = item.id.split('-').slice(0, 3).join('-')
  const levelId = item.id.split('-').slice(0, 2).join('-')
  const others = pool.filter((p) => p.id !== item.id)
  const near = [
    ...others.filter((o) => o.id.startsWith(lessonId)),
    ...others.filter((o) => o.id.startsWith(levelId) && !o.id.startsWith(lessonId)),
    ...others.filter((o) => !o.id.startsWith(levelId)),
  ]
  const fromNear = (field: 'meaning_ko' | 'word', answer: string) => {
    const lesson = pickDistinct(near.slice(0, 9).map((o) => o[field]), answer, 3)
    if (lesson.length === 3) return lesson
    return [...lesson, ...pickDistinct(near.map((o) => o[field]), answer, 3).filter((v) => !lesson.includes(v))].slice(0, 3)
  }

  switch (type) {
    case 'meaning':
      return { key, type, item, options: shuffle([item.meaning_ko, ...fromNear('meaning_ko', item.meaning_ko)]) }
    case 'listen':
      return { key, type, item, options: shuffle([item.word, ...fromNear('word', item.word)]) }
    case 'blank':
      return { key, type, item, blanked: blankOut(item.example_en, item.word), options: shuffle([item.word, ...fromNear('word', item.word)]) }
    case 'build': {
      const words = item.example_en.split(/\s+/)
      const have = new Set(words.map(normEn))
      const extras = pickDistinct(near.map((o) => o.word).filter((w) => !w.includes(' ') && !have.has(normEn(w))), '', 2)
      return { key, type, item, tiles: shuffle([...words, ...extras]) }
    }
    case 'pic': {
      // 그림이 겹치지 않는 보기 3개 (같은 레슨 → 같은 레벨)
      const seen = new Set([item.emoji])
      const picks: Item[] = []
      for (const o of [...shuffle(near.filter((n) => n.id.startsWith(lessonId))), ...shuffle(near.filter((n) => !n.id.startsWith(lessonId)))]) {
        if (!o.emoji || seen.has(o.emoji)) continue
        seen.add(o.emoji)
        picks.push(o)
        if (picks.length === 3) break
      }
      return { key, type, item, picks: shuffle([item, ...picks]) }
    }
    case 'butterfly': {
      const words = new Set([normEn(item.word)])
      const picks: Item[] = []
      for (const o of near) {
        if (words.has(normEn(o.word))) continue
        words.add(normEn(o.word))
        picks.push(o)
        if (picks.length === 3) break
      }
      return { key, type, item, picks: shuffle([item, ...picks]) }
    }
    case 'seed': {
      const have = new Set(item.word.toLowerCase())
      const extras = shuffle([...'aeiourstlnmdcbp'].filter((c) => !have.has(c))).slice(0, 2)
      return { key, type, item, letters: shuffle([...item.word.toLowerCase(), ...extras]) }
    }
    default:
      return { key, type, item }
  }
}

// 짝 맞추기: 그림 있는 단어 4~5개를 한 문제로
export function makeMatch(group: Item[]): Question {
  return { key: `match-${group.map((g) => g.id).join('+')}-${++seq}`, type: 'match', item: group[0], group, picks: shuffle(group) }
}

// 철자 씨앗으로 낼 수 있는 단어: 알파벳만, 9글자 이하
export const seedable = (it: Item) => /^[A-Za-z]{2,9}$/.test(it.word)

// 화면에서 바로 채점 (DB 가 제출 때 다시 채점한다)
export function grade(q: Question, value: string): boolean {
  switch (q.type) {
    case 'meaning':
      return value.trim() === q.item.meaning_ko
    case 'listen':
    case 'blank':
    case 'write':
      return normEn(value) === normEn(q.item.word)
    case 'build':
      return normEn(value) === normEn(q.item.example_en)
    case 'pic':
    case 'match':
    case 'butterfly':
      return value === q.item.id
    default:
      return false
  }
}

// ── 한 사이클씩 도는 문제 순서 ──
// 한 사이클 = 모든 유형을 한 번씩, 늘 같은 차례로. 'new' 칸은 새 단어를 처음 만나는 자리(보기가 있는 유형),
// 'seen' 칸은 앞에서 본 단어를 떠올리는 자리(조립 · 쓰기 · 말하기).
type Slot = { type: QType; take: 'new' | 'seen' }
export function lessonCycle(course: Course, canSpeak: boolean): Slot[] {
  return [
    { type: 'meaning', take: 'new' },
    { type: 'listen', take: 'new' },
    { type: 'build', take: 'seen' },
    { type: 'blank', take: 'new' },
    { type: course === 'E' ? 'listen' : 'write', take: 'seen' }, // 초등은 쓰기 대신 (철자 씨앗은 다음 단계)
    { type: canSpeak ? 'speak' : 'listen', take: 'seen' },
  ]
}

// 주니어(초등) 사이클 (2_설계.md 6-2 · 6-3): 1레벨은 그림 · 듣기 위주, 2~3레벨은 읽기 · 쓰기를 더한다
export function juniorCycle(level: number, canSpeak: boolean, round: number): Slot[] {
  const speakOr: QType = canSpeak ? 'speak' : 'listen'
  if (level <= 1) {
    return [
      { type: 'pic', take: 'new' },
      { type: 'listen', take: 'new' },
      { type: 'seed', take: 'seen' },
      { type: 'meaning', take: 'new' },
      { type: 'pic', take: 'seen' },
      { type: speakOr, take: 'seen' },
    ]
  }
  return [
    { type: 'pic', take: 'new' },
    { type: 'listen', take: 'new' },
    { type: 'seed', take: 'seen' },
    { type: 'blank', take: 'new' },
    { type: 'butterfly', take: 'seen' },
    { type: round % 2 === 0 ? 'build' : speakOr, take: 'seen' }, // 조립과 말하기를 번갈아
  ]
}

// 단어에 맞지 않는 주니어 유형은 바꿔 낸다 (그림이 없거나, 씨앗으로 쓰기 어려운 단어)
function fitType(t: QType, it: Item): QType {
  if ((t === 'pic' || t === 'butterfly') && !it.emoji) return t === 'pic' ? 'meaning' : 'listen'
  if (t === 'seed' && !seedable(it)) return 'listen'
  return t
}

// 레슨 문제 만들기 (2_설계.md 6-3)
//   뜻 → 듣기 → 조립 → 빈칸 → 쓰기 → 말하기 를 한 사이클로 되풀이한다.
//   사이클마다 새 단어 3개를 만나고, 앞에서 만난 단어 3개를 떠올린다 → 10단어면 4번째 사이클 첫 칸에서 끝 (19문제).
//   초등은 주니어 사이클 + 두 번째 사이클 뒤에 짝 맞추기 한 번.
export function buildLesson(items: Item[], pool: Item[], opts: { course: Course; canSpeak: boolean }): Question[] {
  const fresh = shuffle(items)
  const seen: Item[] = []
  const asked = new Map<string, number>() // 떠올리기 칸에 나온 횟수 (고르게 돌리기)
  const junior = opts.course === 'E'
  const level = items[0] ? Number(items[0].id.split('-')[1]) : 1
  const out: Question[] = []
  let k = 0
  let matched = false
  while (fresh.length > 0) {
    const cycle = junior ? juniorCycle(level, opts.canSpeak, Math.floor(k / 6)) : lessonCycle(opts.course, opts.canSpeak)
    // 초등: 두 사이클을 마치면 그때까지 만난 그림 단어로 짝 맞추기
    if (junior && !matched && k === 12) {
      matched = true
      const withPic = seen.filter((s) => s.emoji)
      if (withPic.length >= 4) out.push(makeMatch(shuffle(withPic).slice(0, 5)))
    }
    const slot = cycle[k % cycle.length]
    k += 1
    let it: Item | undefined
    if (slot.take === 'new') {
      it = fresh.shift()
      if (it) seen.push(it)
    } else {
      // 앞에서 본 단어 중 덜 떠올린 것, 방금 나온 단어는 피해서
      const last = out.at(-1)?.item.id
      it = [...seen]
        .filter((s) => s.id !== last)
        .sort((a, b) => (asked.get(a.id) ?? 0) - (asked.get(b.id) ?? 0) || seen.indexOf(a) - seen.indexOf(b))[0]
      if (it) asked.set(it.id, (asked.get(it.id) ?? 0) + 1)
    }
    if (it) out.push(makeQuestion(junior ? fitType(slot.type, it) : slot.type, it, pool))
  }
  return out
}

// 레벨 테스트 한 묶음 = 한 사이클 (5문제): 뜻 → 듣기 → 조립 → 빈칸 → 쓰기
//   알아보기부터 문장 만들기 · 직접 떠올리기까지 보므로, 단어만 알아봐서는 4개를 넘기 어렵다.
export function buildPlacementBlock(levelItems: Item[], pool: Item[], course: Course): Question[] {
  const order: QType[] = ['meaning', 'listen', 'build', 'blank', course === 'E' ? 'listen' : 'write']
  return shuffle(levelItems)
    .slice(0, 5)
    .map((it, i) => makeQuestion(order[i], it, pool))
}
