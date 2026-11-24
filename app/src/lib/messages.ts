// Supabase 오류를 학습자가 이해할 수 있는 말로 바꾼다
export function authMessage(e: unknown): string {
  const m = (e as { message?: string } | null)?.message ?? String(e)
  if (/already registered|already been registered/i.test(m)) return '이미 가입된 이메일이에요. 로그인해 주세요.'
  if (/Invalid login credentials/i.test(m)) return '이메일 또는 비밀번호가 맞지 않아요.'
  if (/Email not confirmed/i.test(m)) return '이메일 인증이 아직 끝나지 않았어요.'
  if (/(token|otp).*(expired|invalid)|(expired|invalid).*(token|otp)/i.test(m)) {
    return '코드가 맞지 않거나 시간이 지났어요. 새 코드를 받아 주세요.'
  }
  if (/rate limit|too many|security purposes/i.test(m)) {
    return '잠시 뒤에 다시 해 주세요. 메일은 짧은 시간에 여러 번 보낼 수 없어요.'
  }
  if (/Password should be|password.*(short|characters)/i.test(m)) return '비밀번호는 8자 이상으로 정해 주세요.'
  if (/Unable to validate email|invalid.*email|email.*invalid/i.test(m)) return '이메일 주소를 다시 확인해 주세요.'
  if (/Database error saving new user/i.test(m)) return '가입 정보를 저장하지 못했어요. 닉네임과 보호자 동의를 확인해 주세요.'
  if (/Failed to fetch|NetworkError/i.test(m)) return '인터넷 연결을 확인해 주세요.'
  return `문제가 생겼어요: ${m}`
}
