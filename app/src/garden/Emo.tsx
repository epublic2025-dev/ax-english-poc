import { useState } from 'react'

// Twemoji 그림 (CC BY 4.0, © Twitter · jdecked/twemoji) — 기기마다 모양이 같게 그림 파일로 보여 준다
const BASE = 'https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/svg/'

export function twemojiUrl(ch: string) {
  const s = ch.includes('‍') ? ch : ch.replace(/️/g, '')
  return `${BASE}${[...s].map((c) => c.codePointAt(0)!.toString(16)).join('-')}.svg`
}

export function Emo({ ch, size = 64, label }: { ch: string; size?: number; label?: string }) {
  const [broken, setBroken] = useState(false)
  if (broken) return <span style={{ fontSize: size * 0.9, lineHeight: 1 }} role="img" aria-label={label}>{ch}</span>
  return (
    <img src={twemojiUrl(ch)} width={size} height={size} alt={label ?? ''} draggable={false}
      onError={() => setBroken(true)} className="pointer-events-none select-none" />
  )
}
