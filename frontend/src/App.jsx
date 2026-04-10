import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { NotificationsProvider } from './context/NotificationsContext'
import Layout from './components/Layout'
import EmployeeLayout from './components/EmployeeLayout'
import LoginPage from './pages/LoginPage'
import EmployeePage from './pages/EmployeePage'
import AttendancePage from './pages/AttendancePage'
import ProfilePage from './pages/ProfilePage'
import NotificationsPage from './pages/NotificationsPage'
import EmpAttendancePage from './pages/employee/EmpAttendancePage'
import EmpProfilePage from './pages/employee/EmpProfilePage'
import KioskPage from './pages/KioskPage'
import SettingsPage from './pages/SettingsPage'

function PrivateAdmin({ children }) {
  const { token, user } = useAuth()
  if (!token) return <Navigate to="/login" replace />
  if (user?.role === 'employee') return <Navigate to="/emp/attendance" replace />
  return children
}

function PrivateEmployee({ children }) {
  const { token, user } = useAuth()
  if (!token) return <Navigate to="/login" replace />
  if (user?.role !== 'employee') return <Navigate to="/employees" replace />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <NotificationsProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/kiosk" element={<KioskPage />} />

          {/* Admin / HR */}
          <Route path="/" element={<PrivateAdmin><Layout /></PrivateAdmin>}>
            <Route index element={<Navigate to="/employees" replace />} />
            <Route path="employees" element={<EmployeePage />} />
            <Route path="attendance" element={<AttendancePage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="notifications" element={<NotificationsPage />} />
          </Route>

          {/* Employee portal */}
          <Route path="/emp" element={<PrivateEmployee><EmployeeLayout /></PrivateEmployee>}>
            <Route index element={<Navigate to="/emp/attendance" replace />} />
            <Route path="attendance" element={<EmpAttendancePage />} />
            <Route path="profile" element={<EmpProfilePage />} />
          </Route>
        </Routes>
      </BrowserRouter>
      </NotificationsProvider>
    </AuthProvider>
  )
}
