import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { authMessage } from '../../lib/messages'
import { supabase } from '../../lib/supabase'
import { Notice } from '../../ui'
import { AdminLayout } from './AdminLayout'

type Report = {
  id: number; item_id: string; qtype: string | null; message: string; status: 'open' | 'fixed' | 'rejected'; created_at: string
  items: { word: string; meaning_ko: string; example_en: string } | null
}
const STATUS = { open: '접수', fixed: '고침', rejected: '반려' } as const

// 18. 오류 신고 — 신고 목록 → 단어 고치기 → 처리 상태 (성공 기준 S5)
export default function AdminReports() {
  const { session } = useAuth()
  const [rows, setRows] = useState<Report[]>([])
  const [filter, setFilter] = useState<'open' | 'all'>('open')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    let query = supabase.from('reports').select('id, item_id, qtype, message, status, created_at, items(word, meaning_ko, example_en)').order('created_at', { ascending: false })
    if (filter === 'open') query = query.eq('status', 'open')
    const { data, error: err } = await query
    if (err) return setError(authMessage(err))
    setRows(data as unknown as Report[])
  }, [filter])
  useEffect(() => { load() }, [load])

  async function setStatus(id: number, status: 'fixed' | 'rejected' | 'open') {
    const { error: err } = await supabase.from('reports')
      .update({ status, resolved_at: status === 'open' ? null : new Date().toISOString(), resolved_by: status === 'open' ? null : session?.user.id })
      .eq('id', id)
    if (err) return setError(authMessage(err))
    load()
  }

  const fmt = (s: string) => new Intl.DateTimeFormat('ko-KR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Seoul' }).format(new Date(s))
  return (
    <AdminLayout title="오류 신고">
      <div className="flex gap-2">
        {(['open', 'all'] as const).map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)}
            className={`rounded-full px-4 py-1.5 text-[14px] ${filter === f ? 'bg-ink text-paper' : 'bg-sheet text-ink2'}`}>{f === 'open' ? '처리할 신고' : '전체'}</button>
        ))}
      </div>
      <Notice>{error}</Notice>
      {rows.length === 0 ? (
        <p className="m-0 rounded-[18px] bg-sheet p-4 text-[15px]">{filter === 'open' ? '처리할 신고가 없어요 🌷' : '신고가 없어요'}</p>
      ) : (
        <ul className="m-0 grid list-none gap-2.5 p-0">
          {rows.map((r) => (
            <li key={r.id} className="grid gap-2 rounded-[18px] bg-sheet p-4 shadow-[0_2px_0_var(--color-line)]">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="m-0"><b className="font-display text-[18px] font-normal">{r.items?.word}</b> <span className="text-[14px] text-ink2">{r.items?.meaning_ko} · {r.item_id}{r.qtype ? ` · ${r.qtype}` : ''}</span></p>
                <span className={`rounded-full px-2.5 py-0.5 text-[12.5px] ${r.status === 'open' ? 'bg-bad-bg text-bad' : r.status === 'fixed' ? 'bg-good-bg text-good' : 'bg-line text-ink2'}`}>{STATUS[r.status]}</span>
              </div>
              <p className="m-0 text-[14px] text-ink2">{r.items?.example_en}</p>
              <p className="m-0 text-[15px]">“{r.message || '(내용 없음)'}” <span className="text-[12.5px] text-ink2">· {fmt(r.created_at)}</span></p>
              <div className="flex flex-wrap gap-2">
                <Link to={`/admin/items?course=${r.item_id[0]}&edit=${r.item_id}`} className="rounded-[12px] bg-leaf-bg px-3 py-1.5 text-[14px] text-leaf-ink no-underline">단어 고치기</Link>
                {r.status === 'open' ? (
                  <>
                    <button type="button" onClick={() => setStatus(r.id, 'fixed')} className="rounded-[12px] bg-good px-3 py-1.5 text-[14px] text-white">고침으로 처리</button>
                    <button type="button" onClick={() => setStatus(r.id, 'rejected')} className="rounded-[12px] bg-line px-3 py-1.5 text-[14px]">반려</button>
                  </>
                ) : (
                  <button type="button" onClick={() => setStatus(r.id, 'open')} className="rounded-[12px] bg-line px-3 py-1.5 text-[14px]">다시 접수로</button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </AdminLayout>
  )
}
