import React, { useEffect, useState } from 'react'
import { attendanceApi, employeeApi } from '../api/client'
const SC = { present:'bg-green-100 text-green-700', late:'bg-yellow-100 text-yellow-700', half_day:'bg-orange-100 text-orange-700', absent:'bg-red-100 text-red-700' }
export default function AttendancePage() {
  const [logs,setLogs]=useState([]); const [departments,setDepartments]=useState([]); const [loading,setLoading]=useState(false)
  const [filters,setFilters]=useState({start_date:'',end_date:'',employee_id:'',department_id:'',status:''})
  const load = async () => {
    setLoading(true)
    try { const p=Object.fromEntries(Object.entries(filters).filter(([,v])=>v)); const r=await attendanceApi.logs(p); setLogs(r.data) }
    finally { setLoading(false) }
  }
  useEffect(()=>{ employeeApi.departments().then(r=>setDepartments(r.data)); load() },[])
  const exportCsv = async () => {
    const p=Object.fromEntries(Object.entries(filters).filter(([,v])=>v))
    const r=await attendanceApi.exportCsv(p)
    const url=URL.createObjectURL(new Blob([r.data]))
    Object.assign(document.createElement('a'),{href:url,download:'attendance.csv'}).click()
  }
  const set = k => e => setFilters(p=>({...p,[k]:e.target.value}))
  const cnt = k => logs.filter(l=>l.status===k).length
  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex items-center justify-between mb-5"><h2 className="text-xl font-semibold text-gray-800">Attendance Log</h2><button onClick={exportCsv} className="flex items-center gap-2 border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm">↓ Export CSV</button></div>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4 grid grid-cols-2 md:grid-cols-7 gap-3">
        <input type="date" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" value={filters.start_date} onChange={set('start_date')} />
        <input type="date" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" value={filters.end_date} onChange={set('end_date')} />
        <input className="border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Employee ID" value={filters.employee_id} onChange={set('employee_id')} />
        <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm" value={filters.department_id} onChange={set('department_id')}><option value="">All Depts</option>{departments.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select>
        <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm" value={filters.status} onChange={set('status')}><option value="">All Status</option>{['present','late','half_day','absent'].map(s=><option key={s} value={s}>{s}</option>)}</select>
        <button onClick={load} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm">Apply</button>
        <button onClick={()=>{setFilters({start_date:'',end_date:'',employee_id:'',department_id:'',status:''});load()}} className="border border-gray-200 hover:bg-gray-50 text-gray-600 px-4 py-2 rounded-lg text-sm">Clear</button>
      </div>
      <div className="grid grid-cols-4 gap-3 mb-4">
        {[['Total',logs.length,'bg-blue-50 text-blue-700'],['Present',cnt('present'),'bg-green-50 text-green-700'],['Late',cnt('late'),'bg-yellow-50 text-yellow-700'],['Half Day',cnt('half_day'),'bg-orange-50 text-orange-700']].map(([l,n,c])=>(
          <div key={l} className={`${c} rounded-2xl p-4 text-center`}><div className="text-2xl font-semibold">{n}</div><div className="text-xs font-medium mt-0.5">{l}</div></div>
        ))}
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead className="bg-gray-50 border-b border-gray-100"><tr>{['Employee','Department','Date','Punch In','Punch Out','Hours','Status'].map(h=><th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-50">
            {loading?<tr><td colSpan={7} className="text-center py-10 text-gray-400 text-sm">Loading…</td></tr>:logs.map(l=>(
              <tr key={l.id} className="hover:bg-gray-50">
                <td className="px-4 py-3"><p className="font-medium text-gray-800">{l.employee_name}</p><p className="text-xs text-gray-400">{l.employee_id}</p></td>
                <td className="px-4 py-3 text-gray-500">{l.department||'—'}</td>
                <td className="px-4 py-3 text-gray-700">{l.date}</td>
                <td className="px-4 py-3 font-mono text-xs text-green-600">{l.punch_in_time?new Date(l.punch_in_time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'—'}</td>
                <td className="px-4 py-3 font-mono text-xs text-orange-600">{l.punch_out_time?new Date(l.punch_out_time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'—'}</td>
                <td className="px-4 py-3 text-gray-700">{l.working_hours?`${l.working_hours}h`:'—'}</td>
                <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full capitalize font-medium ${SC[l.status]||'bg-gray-100 text-gray-600'}`}>{l.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading&&logs.length===0&&<p className="text-center text-gray-400 py-10 text-sm">No records found</p>}
      </div>
    </div>
  )
}
