import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function ProfilePage() {
  const { user } = useAuth()
  const [form, setForm] = useState({
    fullName: user?.username ?? '',
    email: '',
    phone: '',
    department: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [saved, setSaved] = useState(false)
  const [pwError, setPwError] = useState('')

  const handleInfo = e => {
    e.preventDefault()
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const handlePassword = e => {
    e.preventDefault()
    setPwError('')
    if (form.newPassword !== form.confirmPassword) {
      setPwError('New passwords do not match.')
      return
    }
    if (form.newPassword.length < 6) {
      setPwError('Password must be at least 6 characters.')
      return
    }
    setForm(p => ({ ...p, currentPassword: '', newPassword: '', confirmPassword: '' }))
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const EyeIcon = ({ visible, onClick }) => (
    <button type="button" onClick={onClick} className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600">
      {visible ? (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
      ) : (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
      )}
    </button>
  )

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h2 className="text-lg font-semibold text-gray-800 mb-6">My Profile</h2>

      {saved && (
        <div className="mb-4 flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-2.5 rounded-lg">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          Changes saved successfully.
        </div>
      )}

      {/* Avatar */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-4 flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-indigo-600 text-white text-2xl font-bold flex items-center justify-center flex-shrink-0">
          {user?.username?.[0]?.toUpperCase()}
        </div>
        <div>
          <p className="font-semibold text-gray-800 text-base">{user?.username}</p>
          <p className="text-sm text-gray-400 capitalize">{user?.role}</p>
        </div>
      </div>

      {/* Profile info */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Personal Information</h3>
        <form onSubmit={handleInfo} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="fullName" className="block text-xs font-medium text-gray-600 mb-1">Full Name</label>
              <input id="fullName" type="text" value={form.fullName} onChange={e => setForm(p => ({...p, fullName: e.target.value}))} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-gray-600 mb-1">Email</label>
              <input id="email" type="email" value={form.email} onChange={e => setForm(p => ({...p, email: e.target.value}))} placeholder="you@example.com" className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label htmlFor="phone" className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
              <input id="phone" type="tel" value={form.phone} onChange={e => setForm(p => ({...p, phone: e.target.value}))} placeholder="+1 000 000 0000" className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label htmlFor="department" className="block text-xs font-medium text-gray-600 mb-1">Department</label>
              <input id="department" type="text" value={form.department} onChange={e => setForm(p => ({...p, department: e.target.value}))} placeholder="e.g. Engineering" className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-5 py-2 rounded-lg transition">Save Changes</button>
          </div>
        </form>
      </div>

      {/* Change password */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Change Password</h3>
        <form onSubmit={handlePassword} className="space-y-4">
          <div>
            <label htmlFor="currentPassword" className="block text-xs font-medium text-gray-600 mb-1">Current Password</label>
            <div className="relative">
              <input id="currentPassword" type={showCurrent ? 'text' : 'password'} value={form.currentPassword} onChange={e => setForm(p => ({...p, currentPassword: e.target.value}))} required className="w-full border border-gray-200 rounded-lg px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <EyeIcon visible={showCurrent} onClick={() => setShowCurrent(v => !v)} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="newPassword" className="block text-xs font-medium text-gray-600 mb-1">New Password</label>
              <div className="relative">
                <input id="newPassword" type={showNew ? 'text' : 'password'} value={form.newPassword} onChange={e => setForm(p => ({...p, newPassword: e.target.value}))} required className="w-full border border-gray-200 rounded-lg px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <EyeIcon visible={showNew} onClick={() => setShowNew(v => !v)} />
              </div>
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-xs font-medium text-gray-600 mb-1">Confirm Password</label>
              <div className="relative">
                <input id="confirmPassword" type={showConfirm ? 'text' : 'password'} value={form.confirmPassword} onChange={e => setForm(p => ({...p, confirmPassword: e.target.value}))} required className="w-full border border-gray-200 rounded-lg px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <EyeIcon visible={showConfirm} onClick={() => setShowConfirm(v => !v)} />
              </div>
            </div>
          </div>
          {pwError && <p className="text-red-500 text-xs">{pwError}</p>}
          <div className="flex justify-end">
            <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-5 py-2 rounded-lg transition">Update Password</button>
          </div>
        </form>
      </div>
    </div>
  )
}
