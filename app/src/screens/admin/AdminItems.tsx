import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Emo } from '../../garden/Emo'
import { useAuth } from '../../lib/auth'
import { authMessage } from '../../lib/messages'
import { COURSES, supabase, type Course } from '../../lib/supabase'
import { Notice } from '../../ui'
import { AdminLayout } from './AdminLayout'

type Row = {
  id: string; lesson_id: string; word: string; pos: string; meaning_ko: string; example_en: string; example_ko: string
  emoji: string | null; hidden: boolean; audio_stale: boolean; updated_at: string
}
const COLS = 'id, lesson_id, word, pos, meaning_ko, example_en, example_ko, emoji, hidden, audio_stale, updated_at'

// 17. 콘텐츠 편집 — 추가 · 수정 · 숨김, 음성 다시 만들기 목록, CSV 내보내기 (기획 Q11 (b))
export default function AdminItems() {
  const { session } = useAuth()
  const [params, setParams] = useSearchParams()
  const [course, setCourse] = useState<Course>((params.get('course') as Course) ?? 'E')
  const [level, setLevel] = useState(0) // 0 = 모두
  const [lesson, setLesson] = useState(0)
  const [q, setQ] = useState('')
  const [onlyStale, setOnlyStale] = useState(false)
  const [rows, setRows] = useState<Row[]>([])
  const [edit, setEdit] = useState<Row | null>(null)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.from('items').select(COLS).like('id', `${course}-%`).order('id')
    if (err) return setError(authMessage(err))
    setRows(data as Row[])
  }, [course])
  useEffect(() => { load() }, [load])

  // 신고 화면에서 넘어온 단어 바로 열기 (?edit=E-1-2-05)
  useEffect(() => {
    const id = params.get('edit')
    if (!id || rows.length === 0) return
    const r = rows.find((x) => x.id === id)
    if (r) setEdit(r)
  }, [params, rows])

  const shown = useMemo(() => rows.filter((r) => {
    const [, lv, ls] = r.id.split('-').map(Number)
    if (level && lv !== level) return false
    if (lesson && ls !== lesson) return false
    if (onlyStale && !r.audio_stale) return false
    const t = q.trim().toLowerCase()
    return !t || r.word.toLowerCase().includes(t) || r.meaning_ko.includes(t) || r.id.toLowerCase().includes(t)
  }), [rows, level, lesson, onlyStale, q])

  async function save(r: Row, isNew: boolean) {
    setError(''); setMsg('')
    const body = { word: r.word.trim(), pos: r.pos.trim(), meaning_ko: r.meaning_ko.trim(), example_en: r.example_en.trim(), example_ko: r.example_ko.trim(), emoji: r.emoji?.trim() || null, hidden: r.hidden, updated_by: session?.user.id }
    if (!body.word || !body.meaning_ko || !body.example_en || !body.example_ko) return setError('단어 · 뜻 · 예문 · 번역은 꼭 채워 주세요.')
    if (!new RegExp(`(^|[^A-Za-z])${body.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z])`, 'i').test(body.example_en)) {
      return setError('예문 안에 단어가 그 모양 그대로 들어 있어야 해요 (빈칸 채우기 · 문장 조립용).')
    }
    const res = isNew
      ? await supabase.from('items').insert({ ...body, id: r.id, lesson_id: r.lesson_id, audio_word: `${r.id}_w.mp3`, audio_sentence: `${r.id}_s.mp3`, audio_stale: true })
      : await supabase.from('items').update(body).eq('id', r.id)
    if (res.error) return setError(authMessage(res.error))
    setMsg(isNew ? `${r.id} 를 추가했어요. 음성은 "다시 만들기 필요"로 표시돼요.` : `${r.id} 를 저장했어요.`)
    setEdit(null)
    if (params.get('edit')) { params.delete('edit'); setParams(params, { replace: true }) }
    load()
  }

  function addNew() {
    if (!level || !lesson) return setError('추가할 레벨과 레슨을 먼저 골라 주세요.')
    const lid = `${course}-${level}-${lesson}`
    const nums = rows.filter((r) => r.lesson_id === lid).map((r) => Number(r.id.split('-')[3]))
    const id = `${lid}-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(2, '0')}`
    setEdit({ id, lesson_id: lid, word: '', pos: '명', meaning_ko: '', example_en: '', example_ko: '', emoji: null, hidden: false, audio_stale: true, updated_at: '' })
  }

  function exportCsv() {
    const head = ['id', 'course', 'level', 'lesson', 'word', 'pos', 'meaning_ko', 'example_en', 'example_ko', 'emoji', 'hidden', 'audio_stale']
    const esc = (v: unknown) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
    const lines = rows.map((r) => { const [c, lv, ls] = r.id.split('-'); return [r.id, c, lv, ls, r.word, r.pos, r.meaning_ko, r.example_en, r.example_ko, r.emoji ?? '', r.hidden, r.audio_stale].map(esc).join(',') })
    const blob = new Blob(['﻿' + [head.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `words_${course}_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  const isNew = edit ? !rows.some((r) => r.id === edit.id) : false
  const sel = 'rounded-[12px] border border-line bg-white px-3 py-2 text-[14px]'
  return (
    <AdminLayout title="콘텐츠 편집">
      <div className="flex flex-wrap items-center gap-2">
        <select className={sel} value={course} onChange={(e) => { setCourse(e.target.value as Course); setLevel(0); setLesson(0) }}>
          {COURSES.map((c) => <option key={c.code} value={c.code}>{c.emoji} {c.name}</option>)}
        </select>
        <select className={sel} value={level} onChange={(e) => { setLevel(Number(e.target.value)); setLesson(0) }}>
          <option value={0}>모든 레벨</option>{[1, 2, 3].map((n) => <option key={n} value={n}>{n}레벨</option>)}
        </select>
        <select className={sel} value={lesson} onChange={(e) => setLesson(Number(e.target.value))} disabled={!level}>
          <option value={0}>모든 레슨</option>{[1, 2, 3].map((n) => <option key={n} value={n}>레슨 {n}</option>)}
        </select>
        <input className={`${sel} min-w-0 flex-1`} placeholder="단어 · 뜻 · id 찾기" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="flex items-center gap-1.5 text-[14px]"><input type="checkbox" checked={onlyStale} onChange={(e) => setOnlyStale(e.target.checked)} className="accent-[#2F6B47]" />음성 다시 만들기 필요만</label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={addNew} className="rounded-[12px] bg-leaf px-4 py-2 text-[14px] text-white">+ 이 레슨에 단어 추가</button>
        <button type="button" onClick={exportCsv} className="rounded-[12px] bg-leaf-bg px-4 py-2 text-[14px] text-leaf-ink">CSV 내보내기 ({rows.length}개)</button>
      </div>
      <Notice kind="good">{msg}</Notice>
      <Notice>{error}</Notice>

      <div className="overflow-x-auto rounded-[18px] bg-sheet shadow-[0_2px_0_var(--color-line)]">
        <table className="w-full min-w-[640px] text-left text-[14px]">
          <thead className="text-[12.5px] text-ink2"><tr>{['id', '단어', '뜻', '예문', '상태', ''].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} className={`border-t border-line ${r.hidden ? 'opacity-50' : ''}`}>
                <td className="px-3 py-2 font-mono text-[12.5px] text-ink2">{r.id}</td>
                <td className="px-3 py-2"><span className="flex items-center gap-1.5">{r.emoji && <Emo ch={r.emoji} size={20} />}<b className="font-display font-normal">{r.word}</b></span></td>
                <td className="px-3 py-2">{r.meaning_ko}</td>
                <td className="max-w-[260px] truncate px-3 py-2 text-ink2" title={r.example_en}>{r.example_en}</td>
                <td className="px-3 py-2 text-[12px]">{r.hidden && <span className="mr-1 rounded bg-line px-1.5">숨김</span>}{r.audio_stale && <span className="rounded bg-bad-bg px-1.5 text-bad">음성</span>}</td>
                <td className="px-3 py-2 text-right"><button type="button" onClick={() => setEdit({ ...r })} className="text-leaf">고치기</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {edit && (
        <div className="fixed inset-0 z-50 grid items-end bg-black/30 sm:place-items-center" onClick={() => setEdit(null)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); save(edit, isNew) }}
            className="grid max-h-[92dvh] w-full max-w-[560px] gap-3 overflow-y-auto rounded-t-[22px] bg-sheet p-5 sm:rounded-[22px]">
            <p className="m-0 font-display text-[20px]">{isNew ? '단어 추가' : '단어 고치기'} · <span className="font-mono text-[15px] text-ink2">{edit.id}</span></p>
            {([['word', '단어 (영어)'], ['pos', '품사 (명 · 동 · 형 · 부)'], ['meaning_ko', '뜻 (한글)'], ['example_en', '예문 (영어, 단어가 그대로 들어가게)'], ['example_ko', '예문 번역'], ['emoji', '그림 이모지 (초등만, 비우면 그림 문제 제외)']] as const)
              .filter(([k]) => k !== 'emoji' || course === 'E')
              .map(([k, label]) => (
                <label key={k} className="grid gap-1 text-[14px]">
                  <span className="text-ink2">{label}</span>
                  <input value={(edit[k] as string | null) ?? ''} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })}
                    className="rounded-[12px] border border-line bg-white px-3 py-2 text-[16px] outline-none focus:border-leaf" />
                </label>
              ))}
            {edit.emoji && <div className="flex items-center gap-2 text-[13px] text-ink2"><Emo ch={edit.emoji} size={36} /> 앱에 보이는 그림</div>}
            <label className="flex items-center gap-2 text-[14px]"><input type="checkbox" checked={edit.hidden} onChange={(e) => setEdit({ ...edit, hidden: e.target.checked })} className="size-4 accent-[#2F6B47]" />숨김 (학습자에게 안 보임 · 지우지 않고 기록은 남음)</label>
            <p className="m-0 text-[12.5px] text-ink2">영어 단어나 예문을 고치면 "음성 다시 만들기 필요"로 표시되고, 그동안은 브라우저 음성으로 읽어요. PC 에서 <code>scripts/tts_generate.py --ids {edit.id}</code> → <code>scripts/upload_audio.py {edit.id}</code> 로 새 음성을 올려요.</p>
            <Notice>{error}</Notice>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setEdit(null)} className="rounded-[14px] bg-leaf-bg py-3 text-leaf-ink">닫기</button>
              <button type="submit" className="rounded-[14px] bg-leaf py-3 text-white">저장</button>
            </div>
          </form>
        </div>
      )}
    </AdminLayout>
  )
}
