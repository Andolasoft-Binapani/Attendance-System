import React from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
const nav = [
  { to:'/punch',      label:'Punch In/Out', d:'M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M4 8a2 2 0 012-2h9a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2V8z' },
  { to:'/employees',  label:'Employees',    d:'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
  { to:'/attendance', label:'Attendance',   d:'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
]
export default function Layout() {
  const { user, logout } = useAuth(); const navigate = useNavigate()
  return (
    <div className="min-h-screen flex bg-gray-50">
      <aside className="w-56 bg-white border-r border-gray-100 flex flex-col">
        <div className="p-4 border-b border-gray-100 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
          </div>
          <div><p className="text-sm font-semibold text-gray-800">AttendAI</p><p className="text-xs text-gray-400">Face Attendance</p></div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {nav.map(n => (
            <NavLink key={n.to} to={n.to} className={({isActive}) => `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${isActive?'bg-indigo-50 text-indigo-700 font-medium':'text-gray-600 hover:bg-gray-50'}`}>
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={n.d} /></svg>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-gray-100">
          <div className="flex items-center gap-2 px-2">
            <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 text-xs flex items-center justify-center font-semibold">{user?.username?.[0]?.toUpperCase()}</div>
            <div className="flex-1 min-w-0"><p className="text-xs font-medium text-gray-700 truncate">{user?.username}</p><p className="text-xs text-gray-400 capitalize">{user?.role}</p></div>
            <button onClick={() => { logout(); navigate('/login') }} className="text-gray-400 hover:text-gray-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            </button>
          </div>
        </div>
      </aside>
      <main className="flex-1 overflow-auto"><Outlet /></main>
    </div>
  )
}
