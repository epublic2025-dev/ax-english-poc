import { useEffect, useState } from 'react'
import { authMessage } from '../../lib/messages'
import { COURSES, supabase } from '../../lib/supabase'
import { Notice } from '../../ui'
import { AdminLayout, Stat } from './AdminLayout'

type Stats = {
  users: number; minors: number; active_7d: number
  by_course: Record<string, number>
  placement: { course: string; level: number; n: number }[]
  fit: Record<string, number>
  lesson_pass_rate: number | null; exam_pass_rate: number | null; relearn_rate: number | null
  top_wrong_items: { item_id: string; word: string; wrong: number }[]
  top_wrong_qtypes: { qtype: string; wrong_rate: number | null; n: number }[]
  open_reports: number; stale_audio: number
}
const QNAME: Record<string, string> = {
  meaning: '뜻 고르기', listen: '듣고 고르기', blank: '빈칸', build: '문장 조립', write: '쓰기', speak: '말하기', card: '카드',
  pic: '그림 고르기', match: '짝 맞추기', seed: '철자 씨앗', butterfly: '나비 잡기',
}

// 16. 관리자 현황 (성공 기준 S2 · S3 · S4 · S5)
export default function AdminStats() {
  const [s, setS] = useState<Stats | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    supabase.rpc('admin_stats').then(({ data, error: err }) => (err ? setError(authMessage(err)) : setS(data as Stats)))
  }, [])

  const fitTotal = s ? Object.values(s.fit).reduce((a, b) => a + b, 0) : 0
  const fitRight = s && fitTotal ? Math.round(((s.fit.right ?? 0) / fitTotal) * 100) : null
  const coursesOk = s ? COURSES.every((c) => (s.by_course[c.code] ?? 0) >= 2) : false

  return (
    <AdminLayout title="현황">
      <Notice>{error}</Notice>
      {!s ? <p className="text-ink2">불러오는 중…</p> : (
        <>
          <section className="grid gap-2">
            <h2 className="m-0 font-display text-[19px]">성공 기준</h2>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <Stat label="S2 실사용 (6명 · 코스마다 2명)" value={`${s.users}명`} sub={`최근 7일 활동 ${s.active_7d}명`} good={s.users >= 6 && coursesOk} />
              <Stat label="S3 복습 후 다시 맞힘" value={s.relearn_rate === null ? '-' : `${s.relearn_rate}%`} sub="목표 70% 이상" good={s.relearn_rate === null ? null : s.relearn_rate >= 70} />
              <Stat label="S4 시작 레벨 적당" value={fitRight === null ? '-' : `${fitRight}%`} sub={`응답 ${fitTotal}명 · 목표 70%`} good={fitRight === null ? null : fitRight >= 70} />
              <Stat label="S5 처리 안 한 신고" value={`${s.open_reports}건`} sub="모두 처리하면 통과" good={s.open_reports === 0} />
            </div>
          </section>

          <section className="grid gap-2">
            <h2 className="m-0 font-display text-[19px]">사용자 · 학습</h2>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {COURSES.map((c) => <Stat key={c.code} label={`${c.emoji} ${c.name}`} value={`${s.by_course[c.code] ?? 0}명`} />)}
              <Stat label="만 14세 미만 (보호자 가입)" value={`${s.minors}명`} />
              <Stat label="레슨 통과율" value={s.lesson_pass_rate === null ? '-' : `${s.lesson_pass_rate}%`} />
              <Stat label="레벨 시험 통과율" value={s.exam_pass_rate === null ? '-' : `${s.exam_pass_rate}%`} />
              <Stat label="음성 다시 만들 단어" value={`${s.stale_audio}개`} sub="scripts/tts_generate.py" good={s.stale_audio === 0} />
            </div>
          </section>

          <div className="grid gap-4 sm:grid-cols-2">
            <section className="rounded-[18px] bg-sheet p-4 shadow-[0_2px_0_var(--color-line)]">
              <h2 className="m-0 mb-2 font-display text-[18px]">레벨 테스트 판정</h2>
              {s.placement.length === 0 ? <p className="m-0 text-[14px] text-ink2">아직 없어요</p> : (
                <table className="w-full text-[14px]"><tbody>
                  {s.placement.map((p) => (
                    <tr key={`${p.course}-${p.level}`} className="border-t border-line"><td className="py-1.5">{COURSES.find((c) => c.code === p.course)?.name}</td><td>{p.level}레벨</td><td className="text-right">{p.n}명</td></tr>
                  ))}
                </tbody></table>
              )}
            </section>
            <section className="rounded-[18px] bg-sheet p-4 shadow-[0_2px_0_var(--color-line)]">
              <h2 className="m-0 mb-2 font-display text-[18px]">자주 틀리는 단어 Top 10</h2>
              {s.top_wrong_items.length === 0 ? <p className="m-0 text-[14px] text-ink2">아직 없어요</p> : (
                <ol className="m-0 grid gap-1 pl-5 text-[14px]">
                  {s.top_wrong_items.map((w) => <li key={w.item_id}><b className="font-display">{w.word}</b> <span className="text-ink2">· {w.item_id} · {w.wrong}번</span></li>)}
                </ol>
              )}
            </section>
            <section className="rounded-[18px] bg-sheet p-4 shadow-[0_2px_0_var(--color-line)] sm:col-span-2">
              <h2 className="m-0 mb-2 font-display text-[18px]">문제 유형별 오답률</h2>
              <div className="grid gap-1.5">
                {s.top_wrong_qtypes.map((t) => (
                  <div key={t.qtype} className="grid grid-cols-[100px_1fr_70px] items-center gap-2 text-[14px]">
                    <span>{QNAME[t.qtype] ?? t.qtype}</span>
                    <span className="h-2.5 overflow-hidden rounded-full bg-[#E4ECDD]"><span className="block h-full rounded-full bg-bad" style={{ width: `${t.wrong_rate ?? 0}%` }} /></span>
                    <span className="text-right text-ink2">{t.wrong_rate ?? 0}% · {t.n}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </>
      )}
    </AdminLayout>
  )
}
