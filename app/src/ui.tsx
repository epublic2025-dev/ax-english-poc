import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'

// 아래 탭 4개 (2_설계.md 4절)
const TAB_ICON = {
  home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  review: <><path d="M4 12a8 8 0 0 1 13.7-5.6L20 9" /><path d="M20 4v5h-5" /><path d="M20 12a8 8 0 0 1-13.7 5.6L4 15" /><path d="M4 20v-5h5" /></>,
  wrong: <><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z" /><path d="M5 17a3 3 0 0 1 3-3h11" /></>,
  me: <><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></>,
}
export function TabBar({ reviewCount = 0 }: { reviewCount?: number }) {
  const tabs = [
    { to: '/home', label: '홈', icon: TAB_ICON.home },
    { to: '/review', label: '복습', icon: TAB_ICON.review, dot: reviewCount },
    { to: '/wrong', label: '오답 노트', icon: TAB_ICON.wrong },
    { to: '/me', label: '마이', icon: TAB_ICON.me },
  ]
  return (
    <nav aria-label="아래 탭" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-sheet/95 backdrop-blur">
      <div className="mx-auto grid max-w-[440px] grid-cols-4 px-2 pb-[max(14px,env(safe-area-inset-bottom))] pt-2">
        {tabs.map((t) => (
          <NavLink key={t.to} to={t.to}
            className={({ isActive }) => `relative grid justify-items-center gap-0.5 py-1 text-[11.5px] no-underline ${isActive ? 'font-semibold text-leaf' : 'text-ink2'}`}>
            <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{t.icon}</svg>
            {t.label}
            {!!t.dot && <span className="absolute right-[calc(50%-24px)] top-0 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-bad px-1 text-[11px] text-white">{t.dot}</span>}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

// 화면 틀: 휴대폰 폭에 맞춘 한 줄 배치, 위는 아침 하늘빛 → 아래는 풀빛
export function Page({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className="min-h-dvh bg-[linear-gradient(180deg,#F6F8EF_0%,#F1F5EC_45%,#E8F0E1_100%)]">
      <main className={`mx-auto flex min-h-dvh w-full max-w-[440px] flex-col gap-4 px-[18px] pb-8 pt-[max(20px,env(safe-area-inset-top))] ${className}`}>
        {children}
      </main>
    </div>
  )
}

export function Title({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <header className="pt-2">
      <h1 className="m-0 font-display text-[27px] leading-tight tracking-tight">{children}</h1>
      {sub && <p className="mt-1.5 text-[15px] leading-relaxed text-ink2">{sub}</p>}
    </header>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-card bg-sheet p-4 shadow-card ${className}`}>{children}</section>
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'soft' | 'plain' }
export function Button({ variant = 'primary', className = '', ...rest }: BtnProps) {
  const look = {
    primary: 'bg-leaf text-white shadow-btn active:translate-y-[2px] active:shadow-none',
    soft: 'bg-leaf-bg text-leaf-ink',
    plain: 'bg-transparent text-leaf underline-offset-4 hover:underline',
  }[variant]
  return (
    <button
      className={`block w-full rounded-btn px-4 py-3.5 font-display text-lg transition disabled:cursor-default disabled:opacity-45 ${look} ${className}`}
      {...rest}
    />
  )
}

export function ButtonLink({ to, children, variant = 'primary' }: { to: string; children: ReactNode; variant?: 'primary' | 'soft' }) {
  const look = variant === 'primary' ? 'bg-leaf text-white shadow-btn' : 'bg-leaf-bg text-leaf-ink'
  return (
    <Link to={to} className={`block w-full rounded-btn px-4 py-3.5 text-center font-display text-lg no-underline ${look}`}>
      {children}
    </Link>
  )
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: ReactNode }
export function Field({ label, hint, id, ...rest }: FieldProps) {
  const fid = id ?? `f-${label}`
  return (
    <label htmlFor={fid} className="grid gap-1.5">
      <span className="text-[14px] font-medium text-ink">{label}</span>
      <input
        id={fid}
        className="w-full rounded-[14px] border border-line bg-white px-3.5 py-3 text-[16px] text-ink outline-none placeholder:text-ink2/60 focus:border-leaf"
        {...rest}
      />
      {hint && <span className="text-[13px] leading-snug text-ink2">{hint}</span>}
    </label>
  )
}

export function Notice({ kind = 'error', children }: { kind?: 'error' | 'info' | 'good'; children: ReactNode }) {
  if (!children) return null
  const look = { error: 'bg-bad-bg text-bad', info: 'bg-leaf-bg text-leaf-ink', good: 'bg-good-bg text-good' }[kind]
  return (
    <p role={kind === 'error' ? 'alert' : 'status'} className={`m-0 rounded-[14px] px-3.5 py-3 text-[14px] leading-snug ${look}`}>
      {children}
    </p>
  )
}

export function BackLink({ to, children = '← 뒤로' }: { to: string; children?: ReactNode }) {
  return (
    <Link to={to} className="self-start py-1 text-[14px] text-ink2 no-underline">
      {children}
    </Link>
  )
}

export function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center bg-paper">
      <p className="font-display text-xl text-leaf">🌱 단어정원</p>
    </div>
  )
}
