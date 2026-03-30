import { useEffect, useState } from 'react'
import { attendanceApi, employeeApi } from '../api/client'

const SC = {
  present:  'bg-green-100 text-green-700',
  late:     'bg-yellow-100 text-yellow-700',
  half_day: 'bg-orange-100 text-orange-700',
  absent:   'bg-red-100 text-red-700',
}

function ImageThumb({ path, label, onOpen }) {
  if (!path) return <span className="text-gray-300">—</span>
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-8 h-8 rounded-lg overflow-hidden border border-gray-200 hover:opacity-80 hover:scale-110 transition focus:outline-none focus:ring-2 focus:ring-indigo-400"
      title={label}
    >
      <img src={`/${path}`} alt={label} className="w-full h-full object-cover" />
    </button>
  )
}
function Lightbox({ src, label, onClose }) {
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose() }
    globalThis.addEventListener('keydown', handler)
    return () => globalThis.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <dialog
      open
      aria-label="Image preview"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 w-full h-full max-w-none max-h-none border-0 m-0"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close preview"
        className="absolute inset-0 w-full h-full cursor-default"
        onClick={onClose}
      />

      {/* Content */}
      <div className="relative max-w-lg w-full z-10">
        <img src={src} alt={label} className="w-full rounded-2xl shadow-2xl object-contain max-h-[80vh]" />
        <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs text-center py-2 rounded-b-2xl">
          {label}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-3 -right-3 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg text-gray-700 hover:bg-gray-100 transition"
          aria-label="Close"
        >
          ✕
        </button>
      </div>
    </dialog>
  )
}
export default function AttendancePage() {
  const [logs, setLogs]           = useState([])
  const [departments, setDepartments] = useState([])
  const [loading, setLoading]     = useState(false)
  const [lightbox, setLightbox]   = useState(null)
  const [filters, setFilters]     = useState({
    start_date: '', end_date: '', employee_id: '', department_id: '', status: '',
  })

  const openLightbox = (path, label) => setLightbox({ src: `/${path}`, label })

  const load = async () => {
    setLoading(true)
    try {
      const p = Object.fromEntries(Object.entries(filters).filter(([, v]) => v))
      const r = await attendanceApi.logs(p)
      setLogs(r.data)
    } finally { setLoading(false) }
  }

  useEffect(() => { employeeApi.departments().then(r => setDepartments(r.data)); load() }, [])

  const exportCsv = async () => {
    const p = Object.fromEntries(Object.entries(filters).filter(([, v]) => v))
    const r = await attendanceApi.exportCsv(p)
    const url = URL.createObjectURL(new Blob([r.data]))
    Object.assign(document.createElement('a'), { href: url, download: 'attendance.csv' }).click()
  }

  const set = k => e => setFilters(p => ({ ...p, [k]: e.target.value }))
  const cnt = k => logs.filter(l => l.status === k).length

  const clearFilters = () => {
    setFilters({ start_date: '', end_date: '', employee_id: '', department_id: '', status: '' })
    load()
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-semibold text-gray-800">Attendance Log</h2>
        <button onClick={exportCsv} className="flex items-center gap-2 border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm">
          ↓ Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4 grid grid-cols-2 md:grid-cols-7 gap-3">
        <input type="date" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" value={filters.start_date} onChange={set('start_date')} />
        <input type="date" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" value={filters.end_date} onChange={set('end_date')} />
        <input className="border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Employee ID" value={filters.employee_id} onChange={set('employee_id')} />
        <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm" value={filters.department_id} onChange={set('department_id')}>
          <option value="">All Depts</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm" value={filters.status} onChange={set('status')}>
          <option value="">All Status</option>
          {['present', 'late', 'half_day', 'absent'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={load} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm">Apply</button>
        <button onClick={clearFilters} className="border border-gray-200 hover:bg-gray-50 text-gray-600 px-4 py-2 rounded-lg text-sm">Clear</button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {[
          ['Total',    logs.length,     'bg-blue-50 text-blue-700'],
          ['Present',  cnt('present'),  'bg-green-50 text-green-700'],
          ['Late',     cnt('late'),     'bg-yellow-50 text-yellow-700'],
          ['Half Day', cnt('half_day'), 'bg-orange-50 text-orange-700'],
        ].map(([l, n, c]) => (
          <div key={l} className={`${c} rounded-2xl p-4 text-center`}>
            <div className="text-2xl font-semibold">{n}</div>
            <div className="text-xs font-medium mt-0.5">{l}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm min-w-[820px]">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {['Employee', 'Department', 'Date', 'Punch In', 'Punch Out', 'Hours', 'Overtime', 'Status'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan={8} className="text-center py-10 text-gray-400 text-sm">Loading…</td></tr>
            ) : logs.map(l => (
              <tr key={l.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-800">{l.employee_name}</p>
                  <p className="text-xs text-gray-400">{l.employee_id}</p>
                </td>
                <td className="px-4 py-3 text-gray-500">{l.department || '—'}</td>
                <td className="px-4 py-3 text-gray-700">{l.date}</td>

                {/* Punch In */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-green-600">
                      {l.punch_in_time ? new Date(l.punch_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </span>
                    <ImageThumb
                      path={l.punch_in_image}
                      label={`${l.employee_name} — Punch In ${l.date}`}
                      onOpen={() => openLightbox(l.punch_in_image, `${l.employee_name} — Punch In ${l.date}`)}
                    />
                  </div>
                </td>

                {/* Punch Out */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-orange-600">
                      {l.punch_out_time ? new Date(l.punch_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </span>
                    <ImageThumb
                      path={l.punch_out_image}
                      label={`${l.employee_name} — Punch Out ${l.date}`}
                      onOpen={() => openLightbox(l.punch_out_image, `${l.employee_name} — Punch Out ${l.date}`)}
                    />
                  </div>
                </td>

                <td className="px-4 py-3 text-gray-700">{l.working_hours ? `${l.working_hours}h` : '—'}</td>
                <td className="px-4 py-3">
                  {l.overtime_hours > 0
                    ? <span className="text-xs font-medium text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">{l.overtime_hours}h OT</span>
                    : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full capitalize font-medium ${SC[l.status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {l.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && logs.length === 0 && (
          <p className="text-center text-gray-400 py-10 text-sm">No records found</p>
        )}
      </div>

      {lightbox && <Lightbox src={lightbox.src} label={lightbox.label} onClose={() => setLightbox(null)} />}
    </div>
  )
}
