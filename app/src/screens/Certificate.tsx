import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { Buddy } from '../garden/Buddy'
import { useAuth } from '../lib/auth'
import { authMessage } from '../lib/messages'
import { COURSES, supabase } from '../lib/supabase'
import { Button, Notice, Page, Splash } from '../ui'

// 15. 수료증 — 코스를 마치면 닉네임이 들어간 수료증 이미지를 저장 (리워드 R6)
export default function Certificate() {
  const { course = '' } = useParams()
  const nav = useNavigate()
  const { profile } = useAuth()
  const info = COURSES.find((c) => c.code === course)
  const [doneAt, setDoneAt] = useState<string | null | undefined>(undefined)
  const [words, setWords] = useState(0)
  const [error, setError] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!profile) return
    Promise.all([
      supabase.from('course_progress').select('completed_at').eq('user_id', profile.id).eq('course_code', course).maybeSingle(),
      supabase.from('item_memory').select('item_id', { count: 'exact', head: true }).eq('user_id', profile.id).like('item_id', `${course}-%`).gte('stage', 2),
    ]).then(([cp, mem]) => {
      if (cp.error) throw cp.error
      setDoneAt((cp.data as { completed_at: string | null } | null)?.completed_at ?? null)
      setWords(mem.count ?? 0)
    }).catch((e) => setError(authMessage(e)))
  }, [course, profile])

  const date = doneAt ? new Intl.DateTimeFormat('ko-KR', { dateStyle: 'long', timeZone: 'Asia/Seoul' }).format(new Date(doneAt)) : ''

  // 저장용 이미지 그리기 (1080 × 1350)
  useEffect(() => {
    const c = canvasRef.current
    if (!c || !doneAt || !profile || !info) return
    const g = c.getContext('2d')!
    const W = 1080, H = 1350
    const sky = g.createLinearGradient(0, 0, 0, H)
    sky.addColorStop(0, '#F6F8EF'); sky.addColorStop(0.6, '#F1F5EC'); sky.addColorStop(1, '#D9EACB')
    g.fillStyle = sky; g.fillRect(0, 0, W, H)
    g.strokeStyle = '#2F6B47'; g.lineWidth = 10; g.strokeRect(40, 40, W - 80, H - 80)
    g.strokeStyle = '#D3DFCC'; g.lineWidth = 3; g.strokeRect(62, 62, W - 124, H - 124)
    g.fillStyle = '#B4D6A0'
    g.beginPath(); g.moveTo(65, 1150); g.bezierCurveTo(300, 1060, 700, 1080, 1015, 1130); g.lineTo(1015, 1285); g.lineTo(65, 1285); g.fill()
    g.textAlign = 'center'
    g.font = '96px sans-serif'; g.fillText('🌳', W / 2, 260)
    g.fillStyle = '#234F35'; g.font = '84px "Gowun Dodum", sans-serif'; g.fillText('수 료 증', W / 2, 400)
    g.fillStyle = '#56675B'; g.font = '36px "IBM Plex Sans KR", sans-serif'; g.fillText('CERTIFICATE · 단어정원', W / 2, 460)
    g.fillStyle = '#1E3328'; g.font = '76px "Gowun Dodum", sans-serif'; g.fillText(`${profile.nickname} 님`, W / 2, 620)
    g.font = '40px "IBM Plex Sans KR", sans-serif'; g.fillStyle = '#1E3328'
    g.fillText(`${info.emoji} ${info.name} 코스의 모든 레벨을 마쳤어요.`, W / 2, 730)
    g.fillText(`정원에서 단어 ${words}개가 자랐어요.`, W / 2, 795)
    g.fillStyle = '#56675B'; g.font = '36px "IBM Plex Sans KR", sans-serif'; g.fillText(date, W / 2, 900)
    g.font = '64px sans-serif'; g.fillText('🌱 🌿 🌷 🌳', W / 2, 1215)
  }, [doneAt, profile, info, words, date])

  if (!info) return <Navigate to="/home" replace />
  if (doneAt === undefined) return error ? <Page><Notice>{error}</Notice></Page> : <Splash />

  if (!doneAt) {
    return (
      <Page>
        <div className="mt-10 grid justify-items-center gap-3 text-center">
          <Buddy size={72} />
          <h1 className="m-0 font-display text-[26px]">아직 수료 전이에요</h1>
          <p className="m-0 text-[15px] text-ink2">{info.name} 코스의 마지막 레벨 시험을 통과하면 수료증을 받을 수 있어요.</p>
        </div>
        <div className="mt-auto"><Button onClick={() => nav('/home')}>홈으로</Button></div>
      </Page>
    )
  }

  function save() {
    const url = canvasRef.current?.toDataURL('image/png')
    if (!url) return
    const a = document.createElement('a')
    a.href = url
    a.download = `단어정원_수료증_${info!.name}.png`
    a.click()
  }

  return (
    <Page>
      <h1 className="m-0 pt-2 text-center font-display text-[24px]">수료증 🎓</h1>
      <canvas ref={canvasRef} width={1080} height={1350} className="w-full rounded-[18px] shadow-card" aria-label={`${profile?.nickname}님의 ${info.name} 코스 수료증`} />
      <div className="mt-auto grid gap-2.5">
        <Button onClick={save}>이미지로 저장</Button>
        <Button variant="soft" onClick={() => nav('/home')}>홈으로</Button>
      </div>
    </Page>
  )
}
