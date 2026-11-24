import type { Item } from '../lib/data'
import { audioUrl } from '../lib/supabase'

// 예비 음성: 브라우저 내장 읽기 (파일이 없거나 "음성 다시 만들기 필요" 단어)
export function speak(text: string) {
  try {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'en-US'
    u.rate = 0.9
    window.speechSynthesis.speak(u)
  } catch {
    /* 읽기 기능이 없는 기기 */
  }
}

let current: HTMLAudioElement | null = null

// 단어(w) · 예문(s) 발음 재생
export function sayItem(item: Item, kind: 'w' | 's') {
  const text = kind === 'w' ? item.word : item.example_en
  if (item.audio_stale) return speak(text)
  try {
    current?.pause()
    current = new Audio(audioUrl(kind === 'w' ? item.audio_word : item.audio_sentence, item.audio_version))
    current.play().catch(() => speak(text))
  } catch {
    speak(text)
  }
}

// ── 말하기: 브라우저 내장 음성 인식 (기획 Q10) ──
type SR = {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  start: () => void
  abort: () => void
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}
function srClass(): (new () => SR) | null {
  const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}
// 이 기기에서 음성 인식이 막힌 걸 한 번 확인하면, 이번 접속 동안 말하기 대신 다른 유형으로 낸다
const BLOCK_KEY = 'wg_speech_blocked'
export function markSpeechBlocked() {
  try { sessionStorage.setItem(BLOCK_KEY, '1') } catch { /* 무시 */ }
}
export const canListen = () => {
  try { if (sessionStorage.getItem(BLOCK_KEY)) return false } catch { /* 무시 */ }
  return srClass() !== null
}

// 음성 인식 오류를 학습자에게 보여 줄 말로 (null = 그냥 잘 안 들림)
export function speechErrorMessage(code: string): { text: string; blocked: boolean } | null {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return { text: '마이크 사용이 막혀 있어요. 주소창 왼쪽의 🔒(사이트 설정)에서 마이크를 "허용"으로 바꾼 뒤 다시 눌러 주세요.', blocked: true }
    case 'audio-capture':
      return { text: '마이크를 찾을 수 없어요. 마이크가 연결돼 있는지 확인해 주세요.', blocked: true }
    case 'network':
    case 'language-not-supported':
    case 'unsupported':
      return { text: '이 브라우저에서는 음성 인식을 쓸 수 없어요. 휴대폰의 크롬이나 사파리에서 해 주세요.', blocked: true }
    default:
      return null
  }
}

// 한 번 듣고 후보 문장들을 돌려준다
export function listenOnce(timeoutMs = 7000): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const C = srClass()
    if (!C) return reject(new Error('unsupported'))
    const r = new C()
    r.lang = 'en-US'
    r.interimResults = false
    r.maxAlternatives = 5
    let done = false
    const finish = (v: string[] | Error) => {
      if (done) return
      done = true
      clearTimeout(timer)
      if (v instanceof Error) reject(v)
      else resolve(v)
    }
    const timer = setTimeout(() => {
      r.abort()
      finish([])
    }, timeoutMs)
    r.onresult = (e) => {
      const alts: string[] = []
      const res = e.results[0]
      for (let i = 0; i < res.length; i++) alts.push(res[i].transcript)
      finish(alts)
    }
    r.onerror = (e) => finish(e.error === 'no-speech' || e.error === 'aborted' ? [] : new Error(e.error))
    r.onend = () => finish([])
    try {
      r.start()
    } catch {
      finish(new Error('unsupported'))
    }
  })
}
