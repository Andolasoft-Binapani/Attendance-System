import { useEffect, useState } from 'react'
import { settingsApi } from '../api/client'

const TABS = ['Work Schedule', 'Holidays']

function TabBtn({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
        active ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      {label}
    </button>
  )
}

function FieldRow({ label, hint, children }) {
  return (
    <div className="flex items-start justify-between py-4 border-b border-gray-50 last:border-0">
      <div className="mr-6">
        <p className="text-sm font-medium text-gray-800">{label}</p>
        {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  )
}

function WorkScheduleTab() {
  const [form, setForm] = useState({ work_start_time: '09:00', work_end_time: '18:00', late_threshold: '09:15' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    settingsApi.get().then(r => setForm(r.data)).catch(() => {})
  }, [])

  const handleSave = async e => {
    e.preventDefault()
    setSaving(true)
    try {
      await settingsApi.update(form)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {}
    finally { setSaving(false) }
  }

  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  const stdHours = () => {
    try {
      const [sh, sm] = form.work_start_time.split(':').map(Number)
      const [eh, em] = form.work_end_time.split(':').map(Number)
      const diff = (eh * 60 + em - sh * 60 - sm) / 60
      return diff > 0 ? `${diff}h standard workday` : ''
    } catch { return '' }
  }

  return (
    <form onSubmit={handleSave}>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-1">Office Hours</h3>
        <p className="text-xs text-gray-400 mb-4">
          These times are used for late detection and overtime calculation.
          {stdHours() && <span className="ml-1 text-indigo-600 font-medium">{stdHours()}</span>}
        </p>

        <FieldRow label="Work Start Time" hint="Employees must arrive by this time">
          <input
            type="time"
            value={form.work_start_time}
            onChange={set('work_start_time')}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </FieldRow>

        <FieldRow label="Work End Time" hint="Standard end of workday (used for overtime)">
          <input
            type="time"
            value={form.work_end_time}
            onChange={set('work_end_time')}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </FieldRow>

        <FieldRow label="Late Threshold" hint="Punch-in after this time is marked late">
          <input
            type="time"
            value={form.late_threshold}
            onChange={set('late_threshold')}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </FieldRow>
      </div>

      <div className="flex items-center justify-end gap-3 mt-4">
        {saved && <span className="text-sm text-green-600 font-medium">✓ Settings saved</span>}
        <button
          type="submit"
          disabled={saving}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-60 transition"
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </form>
  )
}

function HolidaysTab() {
  const [holidays, setHolidays] = useState([])
  const [form, setForm]         = useState({ date: '', name: '', type: 'public' })
  const [adding, setAdding]     = useState(false)
  const [error, setError]       = useState('')

  const load = () => settingsApi.holidays().then(r => setHolidays(r.data)).catch(() => {})
  useEffect(() => { load() }, [])

  const add = async e => {
    e.preventDefault()
    setError('')
    setAdding(true)
    try {
      await settingsApi.addHoliday(form)
      setForm({ date: '', name: '', type: 'public' })
      load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to add holiday')
    } finally { setAdding(false) }
  }

  const remove = async id => {
    await settingsApi.deleteHoliday(id)
    load()
  }

  const TYPE_BADGE = {
    public:   'bg-green-100 text-green-700',
    optional: 'bg-yellow-100 text-yellow-700',
  }

  return (
    <div className="space-y-5">
      {/* Holiday list */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50">
          <p className="text-sm font-semibold text-gray-700">Declared Holidays</p>
        </div>
        {holidays.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No holidays declared yet</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Date', 'Holiday Name', 'Type', ''].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {holidays.map(h => (
                <tr key={h.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-sm text-gray-700">{h.date}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{h.name}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full capitalize font-medium ${TYPE_BADGE[h.type] ?? 'bg-gray-100 text-gray-600'}`}>
                      {h.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => remove(h.id)}
                      className="text-xs text-red-500 hover:text-red-700 hover:underline transition"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add holiday form */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <p className="text-sm font-semibold text-gray-700 mb-4">Add Holiday</p>
        <form onSubmit={add} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <input
            type="date"
            required
            value={form.date}
            onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            type="text"
            required
            placeholder="Holiday name"
            value={form.name}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:col-span-2"
          />
          <select
            value={form.type}
            onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="public">Public</option>
            <option value="optional">Optional</option>
          </select>
          {error && <p className="sm:col-span-4 text-xs text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={adding}
            className="sm:col-span-4 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-60 transition"
          >
            {adding ? 'Adding…' : '+ Add Holiday'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const [tab, setTab] = useState(0)

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h2 className="text-xl font-semibold text-gray-800 mb-5">Settings</h2>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit mb-6">
        {TABS.map((label, i) => (
          <TabBtn key={label} label={label} active={tab === i} onClick={() => setTab(i)} />
        ))}
      </div>

      {tab === 0 && <WorkScheduleTab />}
      {tab === 1 && <HolidaysTab />}
    </div>
  )
}
