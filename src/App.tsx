import { useAuth } from '@/hooks/useAuth'
import AppLayout from '@/components/AppLayout'
import { Button } from '@/components/ui/button'
import { ShieldAlert } from 'lucide-react'
import { Routes, Route, useNavigate } from 'react-router'
import Dashboard from './pages/Dashboard'
import Exams from './pages/Exams'
import ExamDetails from './pages/ExamDetails'
import ExamRoom from './pages/ExamRoom'
import Results from './pages/Results'
import History from './pages/History'
import Analytics from './pages/Analytics'
import Profile from './pages/Profile'
import AdminHome from './pages/admin/AdminHome'
import AdminExam from './pages/admin/AdminExam'
import AdminAttempt from './pages/admin/AdminAttempt'
import Login from './pages/Login'
import NotFound from './pages/NotFound'

function AdminGate({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  const navigate = useNavigate()
  if (isLoading) return null
  if (!user || user.role !== 'admin') {
    return (
      <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 text-center">
        <ShieldAlert className="h-10 w-10 text-destructive" aria-hidden />
        <h1 className="text-xl">هذه الصفحة مخصصة للمسؤولين فقط</h1>
        <p className="text-sm text-muted-foreground">لا تملك صلاحية الوصول إلى لوحة الإدارة.</p>
        <Button variant="outline" onClick={() => navigate('/')}>العودة للرئيسية</Button>
      </div>
    )
  }
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/exams" element={<Exams />} />
        <Route path="/exams/:id" element={<ExamDetails />} />
        <Route path="/exam/:attemptId" element={<ExamRoom />} />
        <Route path="/results/:attemptId" element={<Results />} />
        <Route path="/history" element={<History />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/admin" element={<AdminGate><AdminHome /></AdminGate>} />
        <Route path="/admin/exams/:id" element={<AdminGate><AdminExam /></AdminGate>} />
        <Route path="/admin/attempts/:attemptId" element={<AdminGate><AdminAttempt /></AdminGate>} />
        <Route path="*" element={<NotFound />} />
      </Route>
      <Route path="/login" element={<Login />} />
    </Routes>
  )
}
