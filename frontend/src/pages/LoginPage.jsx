import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
export default function LoginPage() {
  const { login } = useAuth(); const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState(''); const [loading, setLoading] = useState(false)
  const submit = async e => {
    e.preventDefault(); setError(''); setLoading(true)
    try { await login(form.username, form.password); navigate('/punch') }
    catch { setError('Invalid username or password') }
    finally { setLoading(false) }
  }
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-800">AttendAI</h1>
          <p className="text-gray-400 text-sm mt-1">Sign in to your account</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          {[['username','Username','text','admin'],['password','Password','password','••••••••']].map(([k,l,t,ph]) => (
            <div key={k}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{l}</label>
              <input type={t} placeholder={ph} required className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" value={form[k]} onChange={e => setForm(p => ({...p,[k]:e.target.value}))} />
            </div>
          ))}
          {error && <p className="text-red-500 text-xs text-center">{error}</p>}
          <button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg text-sm disabled:opacity-60">
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
        <p className="text-center text-xs text-gray-400 mt-4">Default: admin / Admin@123</p>
      </div>
    </div>
  )
}
