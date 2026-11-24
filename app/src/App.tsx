import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import CourseSelect from './screens/CourseSelect'
import Home from './screens/Home'
import Login from './screens/Login'
import AdminItems from './screens/admin/AdminItems'
import AdminReports from './screens/admin/AdminReports'
import AdminStats from './screens/admin/AdminStats'
import Certificate from './screens/Certificate'
import Exam from './screens/Exam'
import Lesson from './screens/Lesson'
import My from './screens/My'
import Review from './screens/Review'
import WrongNote from './screens/WrongNote'
import Placement from './screens/Placement'
import Reset from './screens/Reset'
import Signup from './screens/Signup'
import Start from './screens/Start'
import Verify from './screens/Verify'
import { Splash } from './ui'

// 로그인한 사람만. 코스를 아직 안 골랐으면 코스 고르기로.
function RequireAuth({ children }: { children: ReactNode }) {
  const { session, profile, loading } = useAuth()
  const loc = useLocation()
  if (loading) return <Splash />
  if (!session) return <Navigate to="/login" replace />
  if (profile && !profile.current_course && loc.pathname !== '/course') return <Navigate to="/course" replace />
  return <>{children}</>
}

// 로그인하지 않은 사람만 (로그인했으면 홈으로)
function GuestOnly({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) return <Splash />
  if (session) return <Navigate to="/home" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<GuestOnly><Start /></GuestOnly>} />
          <Route path="/signup" element={<GuestOnly><Signup /></GuestOnly>} />
          <Route path="/verify" element={<Verify />} />
          <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
          <Route path="/reset" element={<Reset />} />
          <Route path="/course" element={<RequireAuth><CourseSelect /></RequireAuth>} />
          <Route path="/placement" element={<RequireAuth><Placement /></RequireAuth>} />
          <Route path="/home" element={<RequireAuth><Home /></RequireAuth>} />
          <Route path="/lesson/:id" element={<RequireAuth><Lesson /></RequireAuth>} />
          <Route path="/review" element={<RequireAuth><Review /></RequireAuth>} />
          <Route path="/wrong" element={<RequireAuth><WrongNote /></RequireAuth>} />
          <Route path="/exam/:levelId" element={<RequireAuth><Exam /></RequireAuth>} />
          <Route path="/me" element={<RequireAuth><My /></RequireAuth>} />
          <Route path="/certificate/:course" element={<RequireAuth><Certificate /></RequireAuth>} />
          <Route path="/admin" element={<RequireAuth><AdminStats /></RequireAuth>} />
          <Route path="/admin/items" element={<RequireAuth><AdminItems /></RequireAuth>} />
          <Route path="/admin/reports" element={<RequireAuth><AdminReports /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
