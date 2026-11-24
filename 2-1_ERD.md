# 2단계 · 설계 — ERD (단어정원 DB)

> 설계 본문: [2_설계.md](2_설계.md) 3절 · 그림으로 보기: [mockups/erd.html](mockups/erd.html) (로컬 서버 `mockup` → `http://localhost:8767/mockups/erd.html`)
> 표기: **PK** 기본 키 · **FK** 다른 표를 가리킴 · **UK** 겹치면 안 됨 · `||--o{` 하나 : 여러 개 · `||--||` 하나 : 하나

## 1. 전체 그림

```mermaid
erDiagram
  auth_users ||--|| profiles : "가입하면 생김"
  profiles ||--|| streaks : "연속 학습"
  courses ||--o{ levels : "레벨 3개"
  levels ||--o{ lessons : "레슨 3개"
  lessons ||--o{ items : "단어 10개"
  courses ||--o{ profiles : "지금 코스"
  profiles ||--o{ course_progress : "코스별 진도"
  courses ||--o{ course_progress : ""
  profiles ||--o{ placement_tests : "레벨 테스트"
  courses ||--o{ placement_tests : ""
  profiles ||--o{ lesson_progress : "레슨 기록"
  lessons ||--o{ lesson_progress : ""
  profiles ||--o{ level_exams : "레벨 시험"
  levels ||--o{ level_exams : ""
  profiles ||--o{ item_memory : "단어별 기억"
  items ||--o{ item_memory : ""
  profiles ||--o{ attempts : "문제 답"
  items ||--o{ attempts : ""
  profiles ||--o{ xp_events : "XP"
  profiles ||--o{ user_badges : "받은 배지"
  badges ||--o{ user_badges : ""
  profiles ||--o{ reports : "오류 신고"
  items ||--o{ reports : ""

  auth_users {
    uuid id PK "Supabase 로그인 계정"
    text email "본인 또는 보호자 이메일"
  }

  courses {
    text code PK "E 초등 · M 중고생 · A 성인"
    text name
    int sort
  }
  levels {
    text id PK "E-1"
    text course_code FK
    int level_no "1~3, UK(course_code, level_no)"
    text name "나와 우리 집"
  }
  lessons {
    text id PK "E-1-2"
    text level_id FK
    int lesson_no "1~3, UK(level_id, lesson_no)"
    text topic "동물"
  }
  items {
    text id PK "E-1-2-05"
    text lesson_id FK
    text word "rabbit"
    text pos "명 · 동 · 형 · 부"
    text meaning_ko "토끼"
    text example_en
    text example_ko
    text emoji "초등만, 없으면 그림 문제 제외"
    text audio_word "E-1-2-05_w.mp3"
    text audio_sentence "E-1-2-05_s.mp3"
    int audio_version "파일 바꿀 때 +1"
    bool audio_stale "음성 다시 만들기 필요"
    bool hidden "숨김 (삭제 대신)"
    timestamptz updated_at
    uuid updated_by FK "고친 관리자"
  }

  profiles {
    uuid id PK "FK auth_users.id"
    text nickname
    bool is_minor "만 14세 미만 = 보호자 가입"
    timestamptz guardian_consent_at "보호자 동의 시각"
    text current_course FK
    int daily_goal "30 · 60 · 100"
    bool is_admin "본인이 못 바꿈"
    timestamptz created_at
  }
  course_progress {
    uuid user_id PK "FK"
    text course_code PK "FK"
    int start_level
    int current_level
    bool placement_done
    timestamptz completed_at "3레벨 시험 통과"
  }
  placement_tests {
    bigint id PK
    uuid user_id FK
    text course_code FK
    jsonb answers "10문제 답"
    int result_level "판정"
    int chosen_level "실제로 고른 레벨"
    bool skipped "건너뛰기"
    text fit "easy · right · hard (S4 설문)"
    timestamptz fit_at
    timestamptz created_at
  }

  lesson_progress {
    uuid user_id PK "FK"
    text lesson_id PK "FK"
    int best_score "0~100"
    int attempts
    timestamptz passed_at "80% 이상 처음 통과"
  }
  level_exams {
    bigint id PK
    uuid user_id FK
    text level_id FK
    int score
    bool passed "80% 이상"
    timestamptz created_at
  }
  item_memory {
    uuid user_id PK "FK"
    text item_id PK "FK"
    smallint stage "0 씨앗 1 새싹 2 잎 3 꽃 4 나무 5 졸업"
    date due_at "다음 복습일"
    int correct_streak
    int wrong_count
    bool ever_wrong "오답 노트"
    timestamptz last_seen_at
  }
  attempts {
    bigint id PK
    uuid user_id FK
    text item_id FK
    text qtype "meaning listen blank build write speak card pic match seed butterfly"
    text context "lesson · review · placement · exam"
    text result "correct · wrong · skipped"
    timestamptz created_at
  }

  xp_events {
    bigint id PK
    uuid user_id FK
    int amount
    text reason "answer lesson perfect review speak exam rain_bonus"
    timestamptz created_at
  }
  streaks {
    uuid user_id PK "FK"
    int current
    int best
    date last_active_date
    text protect_week "이번 주 보호 사용 (2026-W48)"
  }
  badges {
    text code PK "first_lesson"
    text name "첫 레슨 통과"
    text description
    int sort
  }
  user_badges {
    uuid user_id PK "FK"
    text badge_code PK "FK"
    timestamptz earned_at
  }
  reports {
    bigint id PK
    uuid user_id FK
    text item_id FK
    text qtype
    text message
    text status "open · fixed · rejected"
    timestamptz created_at
    timestamptz resolved_at
    uuid resolved_by FK "처리한 관리자"
  }
```

## 2. 묶음별 설명

| 묶음 | 테이블 | 누가 쓰나 | 권한 (RLS) |
|---|---|---|---|
| ① 콘텐츠 | `courses` · `levels` · `lessons` · `items` | 관리자 (편집 화면) | 로그인한 사람 읽기(숨김 단어는 관리자만), 쓰기는 관리자만 |
| ② 사용자 | `profiles` · `course_progress` · `placement_tests` | 가입 트리거 · DB 함수 | 본인 · 관리자 읽기. 본인은 닉네임 · 코스 · 하루 목표만 고침 |
| ③ 학습 기록 | `lesson_progress` · `level_exams` · `item_memory` · `attempts` | DB 함수만 | 본인 · 관리자 읽기, 직접 쓰기 없음 |
| ④ 리워드 · 신고 | `xp_events` · `streaks` · `badges` · `user_badges` · `reports` | DB 함수 · 신고 버튼 · 관리자 | 본인 · 관리자 읽기. 신고 만들기는 본인, 처리는 관리자 |

## 3. 키 · 규칙

| 규칙 | 내용 |
|---|---|
| 콘텐츠 id | 사람이 읽을 수 있는 글자 id (`E-1-2-05`) — CSV · 음성 파일 이름과 같음 |
| 사용자 기록 PK | 한 사람 × 한 대상은 한 줄 (`course_progress` · `lesson_progress` · `item_memory` · `user_badges` 는 두 칸을 합친 PK) |
| 쌓이는 기록 | `placement_tests` · `level_exams` · `attempts` · `xp_events` · `reports` 는 일련번호 PK, 지우지 않고 쌓음 |
| 단어 삭제 | 하지 않음 — `items.hidden = true` (학습 기록 보호) |
| 음성 주소 | `VITE_AUDIO_BASE` + `audio_word` + `?v=` + `audio_version` |
| 사용자 삭제 | `auth_users` 를 지우면 그 사람의 ②③④ 기록도 함께 지워짐 (on delete cascade) |
| 레슨 뒤 정원 | 다 맞힌 단어는 `stage` 2(잎, 3일 뒤), 틀린 단어는 1(새싹, 1일 뒤) — 이미 더 자란 단어는 그대로 |
| 관리자 확인 | `private.is_admin()` (앱 API에 드러나지 않는 스키마) |
| 실제 DB | 2026-11-24 `word-garden` 프로젝트에 적용 · 검사 완료 → [3-1_DB_구현.md](3-1_DB_구현.md) |
| 자주 찾는 칸 색인 | `item_memory(user_id, due_at)` 복습함 · `attempts(item_id)` 자주 틀리는 단어 · `attempts(user_id, created_at)` 주간 리포트 · `xp_events(user_id, created_at)` 하루 목표 |

## 4. 오늘 할 일이 만들어지는 흐름

```mermaid
flowchart LR
  A[레슨에서 틀림] --> B["item_memory<br/>stage 1 · due_at 내일"]
  B --> C["홈: 복습 N개<br/>get_review_queue"]
  C --> D{복습에서 맞힘?}
  D -- 예 --> E["stage +1<br/>3일 → 7일 → 14일"]
  D -- 아니오 --> B
  E --> F["stage 5 졸업 🌳✓"]
```
