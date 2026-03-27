import React, { createContext, useContext, useState, useCallback } from 'react'
import api from '../api/client'
const Ctx = createContext(null)
export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('token'))
  const [user, setUser] = useState(() => { try { return JSON.parse(localStorage.getItem('user')) } catch { return null } })
  const login = useCallback(async (username, password) => {
    const fd = new URLSearchParams()
    fd.append('username', username); fd.append('password', password)
    const res = await api.post('/auth/login', fd, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
    localStorage.setItem('token', res.data.access_token)
    localStorage.setItem('user', JSON.stringify({ username: res.data.username, role: res.data.role }))
    setToken(res.data.access_token); setUser({ username: res.data.username, role: res.data.role })
    return res.data
  }, [])
  const logout = useCallback(() => {
    localStorage.removeItem('token'); localStorage.removeItem('user'); setToken(null); setUser(null)
  }, [])
  return <Ctx.Provider value={{ token, user, login, logout }}>{children}</Ctx.Provider>
}
export const useAuth = () => useContext(Ctx)
