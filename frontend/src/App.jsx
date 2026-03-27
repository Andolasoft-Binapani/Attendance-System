import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import EmployeePage from './pages/EmployeePage'
import PunchPage from './pages/PunchPage'
import AttendancePage from './pages/AttendancePage'
function Private({ children }) {
  const { token } = useAuth()
  return token ? children : <Navigate to="/login" replace />
}
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<Private><Layout /></Private>}>
            <Route index element={<Navigate to="/punch" replace />} />
            <Route path="punch" element={<PunchPage />} />
            <Route path="employees" element={<EmployeePage />} />
            <Route path="attendance" element={<AttendancePage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
