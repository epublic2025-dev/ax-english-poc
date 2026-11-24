import type { ReactNode } from 'react'
import { Navigate, NavLink, Link } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { Splash } from '../../ui'

// 관리자 화면 공통 틀 (PC 에서도 보기 좋게 넓게) — 관리자 계정만
export function AdminLayout({ title, children }: { title: string; children: ReactNode }) {
  const { profile, loading } = useAuth()
  if (loading) return <Splash />
  if (!profile?.is_admin) return <Navigate to="/home" replace />
  const tab = ({ isActive }: { isActive: boolean }) =>
    `rounded-full px-4 py-1.5 text-[14px] no-underline ${isActive ? 'bg-leaf text-white' : 'bg-sheet text-ink2 shadow-[0_1px_0_var(--color-line)]'}`
  return (
    <div className="min-h-dvh bg-paper">
      <main className="mx-auto grid w-full max-w-[920px] gap-4 px-[18px] pb-16 pt-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="m-0 font-display text-[26px]">🌱 관리자 · {title}</h1>
          <Link to="/me" className="text-[14px] text-ink2">← 마이로</Link>
        </header>
        <nav className="flex flex-wrap gap-2">
          <NavLink to="/admin" end className={tab}>현황</NavLink>
          <NavLink to="/admin/items" className={tab}>콘텐츠 편집</NavLink>
          <NavLink to="/admin/reports" className={tab}>오류 신고</NavLink>
        </nav>
        {children}
      </main>
    </div>
  )
}

export function Stat({ label, value, sub, good }: { label: string; value: ReactNode; sub?: ReactNode; good?: boolean | null }) {
  return (
    <div className="grid gap-0.5 rounded-[18px] bg-sheet p-3.5 shadow-[0_2px_0_var(--color-line)]">
      <span className="text-[13px] text-ink2">{label}</span>
      <b className={`font-display text-[26px] font-normal ${good === true ? 'text-good' : good === false ? 'text-bad' : ''}`}>{value}</b>
      {sub && <span className="text-[12px] text-ink2">{sub}</span>}
    </div>
  )
}
