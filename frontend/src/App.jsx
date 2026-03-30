import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import EmployeeLayout from './components/EmployeeLayout'
import LoginPage from './pages/LoginPage'
import EmployeePage from './pages/EmployeePage'
import PunchPage from './pages/PunchPage'
import AttendancePage from './pages/AttendancePage'
import ProfilePage from './pages/ProfilePage'
import EmpPunchPage from './pages/employee/EmpPunchPage'
import EmpAttendancePage from './pages/employee/EmpAttendancePage'
import EmpProfilePage from './pages/employee/EmpProfilePage'
import KioskPage from './pages/KioskPage'
import SettingsPage from './pages/SettingsPage'

function PrivateAdmin({ children }) {
  const { token, user } = useAuth()
  if (!token) return <Navigate to="/login" replace />
  if (user?.role === 'employee') return <Navigate to="/emp/punch" replace />
  return children
}

function PrivateEmployee({ children }) {
  const { token, user } = useAuth()
  if (!token) return <Navigate to="/login" replace />
  if (user?.role !== 'employee') return <Navigate to="/punch" replace />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/kiosk" element={<KioskPage />} />

          {/* Admin / HR */}
          <Route path="/" element={<PrivateAdmin><Layout /></PrivateAdmin>}>
            <Route index element={<Navigate to="/punch" replace />} />
            <Route path="punch" element={<PunchPage />} />
            <Route path="employees" element={<EmployeePage />} />
            <Route path="attendance" element={<AttendancePage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>

          {/* Employee portal */}
          <Route path="/emp" element={<PrivateEmployee><EmployeeLayout /></PrivateEmployee>}>
            <Route index element={<Navigate to="/emp/punch" replace />} />
            <Route path="punch" element={<EmpPunchPage />} />
            <Route path="attendance" element={<EmpAttendancePage />} />
            <Route path="profile" element={<EmpProfilePage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
