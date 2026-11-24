import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !key) {
  throw new Error('VITE_SUPABASE_URL · VITE_SUPABASE_PUBLISHABLE_KEY 가 없어요. app/.env.local 을 확인해 주세요.')
}

// 공개 키(publishable)만 쓴다. 권한은 DB 의 RLS · 함수가 지킨다.
export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
})

export type Course = 'E' | 'M' | 'A'

export const COURSES: { code: Course; name: string; emoji: string; desc: string }[] = [
  { code: 'E', name: '초등', emoji: '🧒', desc: '그림과 소리로 쉬운 단어부터' },
  { code: 'M', name: '중고생', emoji: '🎒', desc: '교과서와 시험에 나오는 단어' },
  { code: 'A', name: '성인', emoji: '🧑', desc: '생활 · 여행 · 회화 표현' },
]

// 음성 파일 주소 (VITE_AUDIO_BASE 만 바꾸면 위치를 옮길 수 있다)
export function audioUrl(file: string, version = 1) {
  return `${import.meta.env.VITE_AUDIO_BASE}/${file}?v=${version}`
}
