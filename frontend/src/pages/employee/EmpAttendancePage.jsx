import { useState, useEffect } from 'react'
import { employeePanelApi } from '../../api/client'

const SC = {
  present:  'bg-green-100 text-green-700',
  late:     'bg-yellow-100 text-yellow-700',
  half_day: 'bg-orange-100 text-orange-700',
  absent:   'bg-red-100 text-red-700',
}

function fmt(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function PhotoThumb({ path, label, onClick }) {
  if (!path) return <span className="text-gray-300 text-xs">—</span>
  return (
    <button type="button" onClick={onClick} className="block">
      <img src={`/${path}`} alt={label} className="w-10 h-10 rounded-lg object-cover border border-gray-100 hover:opacity-80 transition hover:ring-2 hover:ring-indigo-400" />
    </button>
  )
}

export default function EmpAttendancePage() {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [lightbox, setLightbox] = useState(null)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const LIMIT = 30

  const load = async (p = 0) => {
    setLoading(true)
    try {
      const r = await employeePanelApi.attendance({ skip: p * LIMIT, limit: LIMIT + 1 })
      const data = r.data
      setHasMore(data.length > LIMIT)
      setRecords(data.slice(0, LIMIT))
      setPage(p)
    } finally { setLoading(false) }
  }

  useEffect(() => { load(0) }, [])

  const summary = {
    present: records.filter(r => r.status === 'present').length,
    late:    records.filter(r => r.status === 'late').length,
    half_day:records.filter(r => r.status === 'half_day').length,
    absent:  records.filter(r => r.status === 'absent').length,
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-5">My Attendance</h2>

      {/* Summary strip */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[['Present', summary.present, 'bg-green-50 text-green-700'], ['Late', summary.late, 'bg-yellow-50 text-yellow-700'], ['Half Day', summary.half_day, 'bg-orange-50 text-orange-700'], ['Absent', summary.absent, 'bg-red-50 text-red-700']].map(([l, n, c]) => (
          <div key={l} className={`${c} rounded-2xl p-4 text-center`}>
            <div className="text-2xl font-semibold">{n}</div>
            <div className="text-xs font-medium mt-0.5">{l}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm min-w-[680px]">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {['Date', 'Punch In', 'Punch Out', 'Hours', 'Status', 'In Photo', 'Out Photo'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan={7} className="text-center py-10 text-gray-400 text-sm">Loading…</td></tr>
            ) : records.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-10 text-gray-400 text-sm">No attendance records yet</td></tr>
            ) : records.map(row => (
              <tr key={row.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">{row.date}</td>
                <td className="px-4 py-3 font-mono text-xs text-green-600">{fmt(row.punch_in_time)}</td>
                <td className="px-4 py-3 font-mono text-xs text-orange-600">{fmt(row.punch_out_time)}</td>
                <td className="px-4 py-3 text-gray-600">{row.working_hours ? `${row.working_hours}h` : '—'}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full capitalize font-medium ${SC[row.status] || 'bg-gray-100 text-gray-600'}`}>
                    {row.status?.replace('_', ' ') || '—'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <PhotoThumb path={row.punch_in_image} label="Punch In" onClick={() => setLightbox(row.punch_in_image)} />
                </td>
                <td className="px-4 py-3">
                  <PhotoThumb path={row.punch_out_image} label="Punch Out" onClick={() => setLightbox(row.punch_out_image)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {(page > 0 || hasMore) && (
        <div className="flex justify-center gap-3 mt-4">
          <button disabled={page === 0} onClick={() => load(page - 1)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">← Previous</button>
          <span className="px-4 py-2 text-sm text-gray-500">Page {page + 1}</span>
          <button disabled={!hasMore} onClick={() => load(page + 1)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">Next →</button>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <div className="relative max-w-lg w-full" onClick={e => e.stopPropagation()}>
            <img src={`/${lightbox}`} alt="Punch photo" className="w-full rounded-2xl shadow-2xl" />
            <button onClick={() => setLightbox(null)} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
