import { Buddy } from '../garden/Buddy'
import { GardenScene } from '../garden/Scene'
import { ButtonLink, Page } from '../ui'

const GROW = [
  { ch: '🌱', t: '새싹', d: '1일' },
  { ch: '🌿', t: '잎', d: '3일' },
  { ch: '🌷', t: '꽃', d: '7일' },
  { ch: '🌳', t: '나무', d: '14일' },
]

// 1. 시작
export default function Start() {
  return (
    <Page className="justify-between">
      <div className="-mx-[18px] -mt-[max(20px,env(safe-area-inset-top))]">
        <div className="relative">
          <GardenScene tall />
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 drop-shadow-[0_3px_3px_rgb(30_51_40/0.18)]">
            <Buddy size={96} />
          </div>
        </div>
      </div>

      <div className="text-center">
        <h1 className="m-0 font-display text-[44px] leading-none text-leaf-ink">단어정원</h1>
        <p className="mt-3 text-[16px] leading-relaxed text-ink2">매일 조금씩, 영어 단어가 자라는 정원</p>
      </div>

      <section className="rounded-card bg-sheet p-4 shadow-card">
        <p className="m-0 text-center text-[14px] text-ink2">외운 단어는 복습할수록 자라요</p>
        <div className="mt-3 flex items-center justify-between">
          {GROW.map((g, i) => (
            <div key={g.t} className="flex items-center">
              <div className="grid w-[58px] justify-items-center gap-0.5">
                <span className="text-[30px] leading-none">{g.ch}</span>
                <span className="font-display text-[15px]">{g.t}</span>
                <span className="text-[11.5px] text-ink2">{g.d}</span>
              </div>
              {i < GROW.length - 1 && <span className="text-[14px] text-line">→</span>}
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { ch: '🔊', t: '원어민 발음' },
          { ch: '🎙', t: '말하기 연습' },
          { ch: '🧒🎒🧑', t: '코스 3개' },
        ].map((f) => (
          <div key={f.t} className="grid gap-1 rounded-[18px] bg-sheet/70 px-1 py-2.5 shadow-[0_2px_0_var(--color-line)]">
            <span className="text-[20px] leading-none">{f.ch}</span>
            <span className="text-[13px] text-ink2">{f.t}</span>
          </div>
        ))}
      </div>

      <div className="grid gap-2.5">
        <ButtonLink to="/signup">시작하기</ButtonLink>
        <ButtonLink to="/login" variant="soft">이미 계정이 있어요</ButtonLink>
      </div>
    </Page>
  )
}
