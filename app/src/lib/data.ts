import { supabase, type Course } from './supabase'

export type Item = {
  id: string
  lesson_id: string
  word: string
  pos: string
  meaning_ko: string
  example_en: string
  example_ko: string
  emoji: string | null
  audio_word: string
  audio_sentence: string
  audio_version: number
  audio_stale: boolean
}
export type Level = { id: string; level_no: number; name: string }
export type Lesson = { id: string; level_id: string; lesson_no: number; topic: string }

const itemCache = new Map<Course, Item[]>()

export async function itemsForCourse(course: Course): Promise<Item[]> {
  const hit = itemCache.get(course)
  if (hit) return hit
  const { data, error } = await supabase
    .from('items')
    .select('id, lesson_id, word, pos, meaning_ko, example_en, example_ko, emoji, audio_word, audio_sentence, audio_version, audio_stale')
    .like('id', `${course}-%`)
    .order('id')
  if (error) throw error
  const items = (data ?? []) as Item[]
  itemCache.set(course, items)
  return items
}

export const levelOf = (id: string) => Number(id.split('-')[1])
export const lessonOf = (id: string) => id.split('-').slice(0, 3).join('-')

export async function courseMap(course: Course): Promise<{ levels: Level[]; lessons: Lesson[] }> {
  const [lv, ls] = await Promise.all([
    supabase.from('levels').select('id, level_no, name').eq('course_code', course).order('level_no'),
    supabase.from('lessons').select('id, level_id, lesson_no, topic').like('id', `${course}-%`).order('id'),
  ])
  if (lv.error) throw lv.error
  if (ls.error) throw ls.error
  return { levels: lv.data as Level[], lessons: ls.data as Lesson[] }
}

// 한국 날짜의 0시 (XP · 하루 목표 계산용)
export function kstMidnightISO() {
  const d = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date())
  return `${d}T00:00:00+09:00`
}

export type HomeData = {
  progress: { start_level: number; current_level: number; placement_done: boolean; completed_at: string | null } | null
  passed: Set<string>
  garden: [number, number, number, number, number] // 새싹 1 · 잎 2 · 꽃 3 · 나무 4 · 졸업 5
  reviewDue: number
  xpToday: number
  streak: number
  bestStreak: number
}

export async function homeData(userId: string, course: Course): Promise<HomeData> {
  const [cp, lp, mem, xp, st, rq] = await Promise.all([
    supabase.from('course_progress').select('start_level, current_level, placement_done, completed_at')
      .eq('user_id', userId).eq('course_code', course).maybeSingle(),
    supabase.from('lesson_progress').select('lesson_id, passed_at').like('lesson_id', `${course}-%`),
    supabase.from('item_memory').select('stage').like('item_id', `${course}-%`),
    supabase.from('xp_events').select('amount').gte('created_at', kstMidnightISO()),
    supabase.from('streaks').select('current, best, last_active_date').maybeSingle(),
    supabase.rpc('get_review_queue', { p_course: course, p_limit: 100 }),
  ])
  for (const r of [cp, lp, mem, xp, st, rq]) if (r.error) throw r.error

  const garden: HomeData['garden'] = [0, 0, 0, 0, 0]
  for (const m of (mem.data ?? []) as { stage: number }[]) if (m.stage >= 1) garden[m.stage - 1] += 1

  // 연속 학습: 마지막 학습일이 그제보다 오래됐으면 끊긴 것으로 보여 준다
  const s = st.data as { current: number; best: number; last_active_date: string | null } | null
  let streak = s?.current ?? 0
  if (s?.last_active_date) {
    const today = new Date(kstMidnightISO())
    const last = new Date(`${s.last_active_date}T00:00:00+09:00`)
    if ((today.getTime() - last.getTime()) / 86400000 > 2) streak = 0
  }

  return {
    progress: cp.data as HomeData['progress'],
    passed: new Set(((lp.data ?? []) as { lesson_id: string; passed_at: string | null }[]).filter((r) => r.passed_at).map((r) => r.lesson_id)),
    garden,
    reviewDue: (rq.data ?? []).length,
    xpToday: ((xp.data ?? []) as { amount: number }[]).reduce((a, b) => a + b.amount, 0),
    streak,
    bestStreak: s?.best ?? 0,
  }
}
