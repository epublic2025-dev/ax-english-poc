// 새싹이 — 단어정원 캐릭터 (2_설계.md 6-1)
export function Buddy({ size = 58, className = '' }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 60 66" width={size} height={size * 1.1} className={className} aria-hidden="true">
      <path d="M30 18 C22 4 9 5 7 14 C17 13 24 15 30 21 Z" fill="#6FBF5B" />
      <path d="M30 18 C38 4 51 5 53 14 C43 13 36 15 30 21 Z" fill="#4FA34A" />
      <ellipse cx="30" cy="43" rx="23" ry="21" fill="#B5E29A" stroke="#6FA85C" strokeWidth="1.6" />
      <circle cx="22" cy="41" r="3.2" fill="#1E3328" />
      <circle cx="38" cy="41" r="3.2" fill="#1E3328" />
      <path d="M24 50 Q30 55 36 50" stroke="#1E3328" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <circle cx="16" cy="47" r="3.4" fill="#F4A79D" opacity=".75" />
      <circle cx="44" cy="47" r="3.4" fill="#F4A79D" opacity=".75" />
    </svg>
  )
}
