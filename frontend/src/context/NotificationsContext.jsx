import { createContext, useContext, useState } from 'react'

const NOTIFICATIONS = [
  { id:1, title:'New employee registered', desc:'John Doe was added to Engineering.', time:'2 min ago', type:'employee', read:false },
  { id:2, title:'Attendance exported',     desc:'March report CSV is ready to download.', time:'1 hr ago', type:'export', read:false },
  { id:3, title:'Late punch-in detected',  desc:'Alice arrived 22 min late today.', time:'3 hr ago', type:'late', read:true },
  { id:4, title:'New employee registered', desc:'Jane Smith was added to Marketing.', time:'5 hr ago', type:'employee', read:true },
  { id:5, title:'Holiday added',           desc:'Good Friday has been added to the holiday list.', time:'1 day ago', type:'settings', read:true },
  { id:6, title:'Late punch-in detected',  desc:'Bob arrived 10 min late today.', time:'1 day ago', type:'late', read:true },
]

const NotificationsContext = createContext(null)

export function NotificationsProvider({ children }) {
  const [notifications, setNotifications] = useState(NOTIFICATIONS)

  const markAllRead = () => setNotifications(ns => ns.map(n => ({ ...n, read: true })))
  const markRead = id => setNotifications(ns => ns.map(n => n.id === id ? { ...n, read: true } : n))
  const deleteNotification = id => setNotifications(ns => ns.filter(n => n.id !== id))
  const unread = notifications.filter(n => !n.read).length

  return (
    <NotificationsContext.Provider value={{ notifications, unread, markAllRead, markRead, deleteNotification }}>
      {children}
    </NotificationsContext.Provider>
  )
}

export function useNotifications() {
  return useContext(NotificationsContext)
}
