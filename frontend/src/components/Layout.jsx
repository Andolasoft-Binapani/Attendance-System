import { useState, useRef, useEffect } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const nav = [
  { to:'/punch',      label:'Punch In/Out', d:'M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M4 8a2 2 0 012-2h9a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2V8z' },
  { to:'/employees',  label:'Employees',    d:'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
  { to:'/attendance', label:'Attendance',   d:'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
  { to:'/settings',  label:'Settings',     d:'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z' },
]

const NOTIFICATIONS = [
  { id:1, title:'New employee registered', desc:'John Doe was added to Engineering.', time:'2 min ago', read:false },
  { id:2, title:'Attendance exported',     desc:'March report CSV is ready to download.', time:'1 hr ago',  read:false },
  { id:3, title:'Late punch-in detected',  desc:'Alice arrived 22 min late today.', time:'3 hr ago',  read:true  },
]

function useClickOutside(ref, handler) {
  useEffect(() => {
    const listener = e => { if (ref.current && !ref.current.contains(e.target)) handler() }
    document.addEventListener('mousedown', listener)
    return () => document.removeEventListener('mousedown', listener)
  }, [ref, handler])
}

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [notifications, setNotifications] = useState(NOTIFICATIONS)
  const [notifOpen, setNotifOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)

  const notifRef = useRef(null)
  const profileRef = useRef(null)
  useClickOutside(notifRef,   () => setNotifOpen(false))
  useClickOutside(profileRef, () => setProfileOpen(false))

  const unread = notifications.filter(n => !n.read).length

  const markAllRead = () => setNotifications(ns => ns.map(n => ({...n, read:true})))
  const markRead = id => setNotifications(ns => ns.map(n => n.id === id ? {...n, read:true} : n))

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Top Header */}
      <header className="h-14 bg-white border-b border-gray-100 flex items-center px-4 gap-4 z-20 flex-shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-2 w-48 flex-shrink-0">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
          </div>
          <div><p className="text-sm font-semibold text-gray-800">AttendAI</p><p className="text-xs text-gray-400">Face Attendance</p></div>
        </div>

        {/* Search */}
        <div className="flex-1 max-w-md relative">
          <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input type="search" placeholder="Search employees, records…" value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white" />
        </div>

        <div className="ml-auto flex items-center gap-1">
          {/* Notifications */}
          <div ref={notifRef} className="relative">
            <button onClick={() => { setNotifOpen(v => !v); setProfileOpen(false) }} className="relative p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
              {unread > 0 && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">{unread}</span>
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 mt-1 w-80 bg-white rounded-xl shadow-lg border border-gray-100 z-30 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <span className="text-sm font-semibold text-gray-800">Notifications</span>
                  {unread > 0 && (
                    <button onClick={markAllRead} className="text-xs text-indigo-600 hover:underline">Mark all read</button>
                  )}
                </div>
                <ul className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
                  {notifications.length === 0 && (
                    <li className="px-4 py-6 text-center text-sm text-gray-400">No notifications</li>
                  )}
                  {notifications.map(n => (
                    <li key={n.id}>
                      <button type="button" onClick={() => markRead(n.id)} className={`w-full flex gap-3 px-4 py-3 hover:bg-gray-50 transition text-left ${n.read ? '' : 'bg-indigo-50/40'}`}>
                        <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${n.read ? 'bg-transparent' : 'bg-indigo-500'}`} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm leading-tight ${n.read ? 'text-gray-700' : 'font-semibold text-gray-800'}`}>{n.title}</p>
                          <p className="text-xs text-gray-400 mt-0.5 truncate">{n.desc}</p>
                          <p className="text-xs text-gray-300 mt-1">{n.time}</p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="border-t border-gray-100 px-4 py-2.5 text-center">
                  <button className="text-xs text-indigo-600 hover:underline">View all notifications</button>
                </div>
              </div>
            )}
          </div>

          {/* Profile dropdown */}
          <div ref={profileRef} className="relative">
            <button onClick={() => { setProfileOpen(v => !v); setNotifOpen(false) }} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 transition">
              <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 text-xs flex items-center justify-center font-semibold">{user?.username?.[0]?.toUpperCase()}</div>
              <div className="text-left hidden sm:block">
                <p className="text-xs font-medium text-gray-700 leading-tight">{user?.username}</p>
                <p className="text-xs text-gray-400 capitalize leading-tight">{user?.role}</p>
              </div>
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>

            {profileOpen && (
              <div className="absolute right-0 mt-1 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-30">
                <div className="px-3 py-2 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-800">{user?.username}</p>
                  <p className="text-xs text-gray-400 capitalize">{user?.role}</p>
                </div>
                <button onClick={() => { navigate('/profile'); setProfileOpen(false) }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  My Profile
                </button>
                <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-48 bg-white border-r border-gray-100 flex flex-col flex-shrink-0">
          <nav className="flex-1 p-3 space-y-1">
            {nav.map(n => (
              <NavLink key={n.to} to={n.to} className={({isActive}) => `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${isActive?'bg-indigo-50 text-indigo-700 font-medium':'text-gray-600 hover:bg-gray-50'}`}>
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={n.d} /></svg>
                {n.label}
              </NavLink>
            ))}
          </nav>
        </aside>
        <main className="flex-1 overflow-auto"><Outlet /></main>
      </div>
    </div>
  )
}
