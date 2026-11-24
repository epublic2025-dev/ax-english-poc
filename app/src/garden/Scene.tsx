import type { ReactNode } from 'react'
import { Buddy } from './Buddy'

// 작은 정원 풍경: 햇살 · 구름 · 언덕 · 자라는 식물 (시작 · 로그인 · 가입 화면 머리)
export function GardenScene({ tall = false }: { tall?: boolean }) {
  return (
    <svg viewBox="0 0 400 170" className={`block w-full ${tall ? 'h-[200px]' : 'h-[132px]'}`} preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs>
        <linearGradient id="hillBack" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#D6E8CB" />
          <stop offset="1" stopColor="#C4DDB5" />
        </linearGradient>
        <linearGradient id="hillFront" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#B4D6A0" />
          <stop offset="1" stopColor="#9CC888" />
        </linearGradient>
      </defs>
      <circle cx="338" cy="44" r="22" fill="#F7C98F" opacity=".85" />
      <circle cx="338" cy="44" r="34" fill="#F7C98F" opacity=".18" />
      <g fill="#FFFFFF" opacity=".9">
        <ellipse cx="78" cy="40" rx="26" ry="10" />
        <ellipse cx="98" cy="34" rx="18" ry="11" />
        <ellipse cx="238" cy="28" rx="20" ry="7" />
        <ellipse cx="252" cy="24" rx="12" ry="7" />
      </g>
      <path d="M0 118 C70 92 140 96 210 112 C280 128 340 104 400 96 L400 170 L0 170 Z" fill="url(#hillBack)" />
      <path d="M0 140 C80 118 170 122 240 136 C300 148 350 138 400 130 L400 170 L0 170 Z" fill="url(#hillFront)" />
      <g fontSize="22" textAnchor="middle">
        <text x="46" y="134">🌱</text>
        <text x="112" y="128">🌿</text>
        <text x="292" y="140">🌷</text>
        <text x="362" y="126">🌳</text>
      </g>
    </svg>
  )
}

// 로그인 · 가입 · 코드 화면 머리: 풍경 + 새싹이 + 말풍선
export function AuthHeader({ say, children }: { say: string; children?: ReactNode }) {
  return (
    <div className="-mx-[18px] -mt-[max(20px,env(safe-area-inset-top))]">
      <div className="relative">
        <GardenScene />
        <div className="absolute bottom-2 left-[calc(50%-60px)] flex items-end gap-1.5 drop-shadow-[0_2px_2px_rgb(30_51_40/0.18)]">
          <Buddy size={56} />
          <p className="m-0 mb-10 whitespace-nowrap rounded-[16px_16px_16px_4px] bg-sheet px-3 py-1.5 font-display text-[15px] shadow-[0_2px_0_var(--color-line)]">
            {say}
          </p>
        </div>
      </div>
      {children}
    </div>
  )
}
