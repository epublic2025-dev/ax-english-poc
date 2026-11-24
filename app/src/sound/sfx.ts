// 효과음 — 물방울 정원 (2_설계.md 5-3). 파일 없이 Web Audio 로 합성.
let ac: AudioContext | null = null
let master: GainNode | null = null

export function soundOn(): boolean {
  try {
    return localStorage.getItem('wg_sound') !== 'off'
  } catch {
    return true
  }
}
export function setSoundOn(on: boolean) {
  try {
    localStorage.setItem('wg_sound', on ? 'on' : 'off')
  } catch {
    /* 저장 못 해도 동작에는 문제없음 */
  }
}

function ctx(): AudioContext | null {
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  if (!ac) {
    ac = new AC()
    master = ac.createGain()
    master.gain.value = 0.9
    const comp = ac.createDynamicsCompressor()
    master.connect(comp).connect(ac.destination)
  }
  if (ac.state === 'suspended') void ac.resume()
  return ac
}

type Osc = { f: number; t?: number; dur?: number; type?: OscillatorType; vol?: number; attack?: number; to?: number; toTime?: number }
function osc(a: AudioContext, { f, t = 0, dur = 0.2, type = 'sine', vol = 0.15, attack = 0.004, to, toTime }: Osc) {
  const o = a.createOscillator()
  const g = a.createGain()
  const st = a.currentTime + 0.01 + t
  o.type = type
  o.frequency.setValueAtTime(f, st)
  if (to) o.frequency.exponentialRampToValueAtTime(to, st + (toTime ?? dur))
  g.gain.setValueAtTime(0.0001, st)
  g.gain.exponentialRampToValueAtTime(vol, st + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, st + dur)
  o.connect(g).connect(master!)
  o.start(st)
  o.stop(st + dur + 0.05)
}

type Noise = { t?: number; dur?: number; vol?: number; freq?: number; freqTo?: number; q?: number; swell?: boolean }
function noise(a: AudioContext, { t = 0, dur = 0.1, vol = 0.08, freq = 3000, freqTo, q = 1.2, swell = false }: Noise) {
  const len = Math.ceil(a.sampleRate * dur)
  const buf = a.createBuffer(1, len, a.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (swell ? Math.sin((Math.PI * i) / len) : 1 - i / len)
  const st = a.currentTime + 0.01 + t
  const src = a.createBufferSource()
  src.buffer = buf
  const bp = a.createBiquadFilter()
  bp.type = 'bandpass'
  bp.Q.value = q
  bp.frequency.setValueAtTime(freq, st)
  if (freqTo) bp.frequency.exponentialRampToValueAtTime(freqTo, st + dur)
  const g = a.createGain()
  g.gain.value = vol
  src.connect(bp).connect(g).connect(master!)
  src.start(st)
}

const semi = (f: number, n: number) => f * Math.pow(2, n / 12)
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21]
const lift = (s: number) => PENTA[Math.max(0, Math.min(s, PENTA.length) - 1)]
function bell(a: AudioContext, f: number, t: number, vol = 0.08) {
  osc(a, { f, t, dur: 1.1, vol })
  osc(a, { f: f * 2.76, t, dur: 0.4, vol: vol * 0.25 })
}

function play(fn: (a: AudioContext) => void) {
  if (!soundOn()) return
  try {
    const a = ctx()
    if (a) fn(a)
  } catch {
    /* 소리를 못 내는 기기 */
  }
}

export const sfx = {
  tap: () => play((a) => osc(a, { f: 900, to: 1500, dur: 0.05, vol: 0.05 })),
  // 연속 정답일수록 음이 올라가고, 3 · 5 · 10번째는 한 번 더 반짝
  good: (streak = 1) =>
    play((a) => {
      const ring = (s: number, t0 = 0) => {
        const f = semi(700, lift(s))
        osc(a, { f, t: t0, to: f * 2.2, toTime: 0.05, dur: 0.18, vol: 0.2 })
        osc(a, { f: f * 3, t: t0 + 0.06, dur: 0.25, vol: 0.05 })
        noise(a, { t: t0 + 0.02, dur: 0.12, vol: 0.05, freq: 5000, q: 0.8 })
      }
      ring(streak)
      if ([3, 5, 10].includes(streak)) ring(streak + 3, 0.15)
    }),
  bad: () =>
    play((a) => {
      noise(a, { dur: 0.04, vol: 0.1, freq: 1500 })
      osc(a, { f: 520, to: 330, dur: 0.16, type: 'triangle', vol: 0.24 })
      osc(a, { f: 260, dur: 0.2, vol: 0.14 })
      noise(a, { t: 0.15, dur: 0.04, vol: 0.08, freq: 1100 })
      osc(a, { f: 392, to: 262, t: 0.15, dur: 0.24, type: 'triangle', vol: 0.2 })
    }),
  flip: () =>
    play((a) => {
      noise(a, { dur: 0.22, vol: 0.22, freq: 1200, freqTo: 6000, q: 0.9, swell: true })
      osc(a, { f: 1046.5, to: 1568, toTime: 0.04, t: 0.2, dur: 0.32, vol: 0.12 })
    }),
  swipe: () => play((a) => noise(a, { dur: 0.24, vol: 0.16, freq: 4500, freqTo: 900, q: 0.8, swell: true })),
  done: () =>
    play((a) => {
      ;[1318.5, 1568, 1760, 2093, 2349, 1760, 2093].forEach((f, i) => bell(a, f, i * 0.13))
      osc(a, { f: 261.6, dur: 1.6, vol: 0.06, attack: 0.3 })
      osc(a, { f: 392, dur: 1.6, vol: 0.05, attack: 0.3 })
    }),
}
