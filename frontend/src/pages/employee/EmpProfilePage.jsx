import { useState, useEffect } from 'react'
import { employeePanelApi } from '../../api/client'

function InfoRow({ label, value }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 py-3 border-b border-gray-50 last:border-0">
      <span className="w-36 flex-shrink-0 text-xs font-medium text-gray-500">{label}</span>
      <span className="text-sm text-gray-800">{value || <span className="text-gray-300">—</span>}</span>
    </div>
  )
}

export default function EmpProfilePage() {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    employeePanelApi.me()
      .then(r => setProfile(r.data))
      .catch(() => setError('Could not load profile. Your account may not be linked to an employee record.'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Loading…</div>
  if (error) return <div className="max-w-lg mx-auto p-6 mt-10 bg-red-50 text-red-600 text-sm rounded-2xl border border-red-200">{error}</div>

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-6">My Profile</h2>

      {/* Profile card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-4">
        <div className="flex items-center gap-5 mb-6">
          {profile.image_path ? (
            <img src={`/${profile.image_path}`} alt={profile.name} className="w-20 h-20 rounded-full object-cover border-2 border-indigo-100" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-indigo-600 text-white text-3xl font-bold flex items-center justify-center flex-shrink-0">
              {profile.name?.[0]?.toUpperCase()}
            </div>
          )}
          <div>
            <h3 className="text-xl font-semibold text-gray-800">{profile.name}</h3>
            <p className="text-sm text-indigo-600 font-mono mt-0.5">{profile.employee_id}</p>
            {profile.designation && <p className="text-sm text-gray-500 mt-0.5">{profile.designation}</p>}
          </div>
        </div>

        <div>
          <InfoRow label="Department" value={profile.department} />
          <InfoRow label="Designation" value={profile.designation} />
          <InfoRow label="Email" value={profile.email} />
          <InfoRow label="Phone" value={profile.phone} />
          <InfoRow label="Joining Date" value={profile.joining_date} />
        </div>
      </div>

      <p className="text-xs text-gray-400 text-center">Contact HR to update your profile information.</p>
    </div>
  )
}
