import React, { useEffect, useState } from 'react'
import { employeeApi } from '../api/client'
const EMPTY = { employee_id:'',name:'',email:'',phone:'',department_id:'',designation:'',joining_date:'' }
export default function EmployeePage() {
  const [employees,setEmployees]=useState([]); const [departments,setDepartments]=useState([])
  const [search,setSearch]=useState(''); const [modal,setModal]=useState(false)
  const [editing,setEditing]=useState(null); const [form,setForm]=useState(EMPTY)
  const [img,setImg]=useState(null); const [error,setError]=useState(''); const [saving,setSaving]=useState(false)
  const load = async () => {
    const [a,b] = await Promise.all([employeeApi.list({search}),employeeApi.departments()])
    setEmployees(a.data); setDepartments(b.data)
  }
  useEffect(()=>{load()},[search])
  const openAdd = () => { setEditing(null); setForm(EMPTY); setImg(null); setError(''); setModal(true) }
  const openEdit = emp => { setEditing(emp); setForm({employee_id:emp.employee_id,name:emp.name,email:emp.email||'',phone:emp.phone||'',department_id:'',designation:emp.designation||'',joining_date:emp.joining_date||''}); setImg(null); setError(''); setModal(true) }
  const save = async e => {
    e.preventDefault(); setError(''); setSaving(true)
    try {
      const fd = new FormData()
      Object.entries(form).forEach(([k,v])=>v&&fd.append(k,v))
      if(img) fd.append('image',img)
      editing ? await employeeApi.update(editing.id,fd) : await employeeApi.create(fd)
      setModal(false); load()
    } catch(err) { setError(err.response?.data?.detail||'Failed to save') }
    finally { setSaving(false) }
  }
  const remove = async id => { if(!confirm('Deactivate?'))return; await employeeApi.remove(id); load() }
  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-5"><h2 className="text-xl font-semibold text-gray-800">Employees</h2><button onClick={openAdd} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium">+ Add</button></div>
      <input className="mb-4 border border-gray-200 rounded-lg px-4 py-2 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Search…" value={search} onChange={e=>setSearch(e.target.value)} />
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-gray-50 border-b border-gray-100"><tr>{['ID','Name','Department','Designation','Face',''].map(h=><th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-50">
            {employees.map(e=>(
              <tr key={e.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs text-indigo-600">{e.employee_id}</td>
                <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-semibold">{e.name[0]}</div><span className="font-medium text-gray-800">{e.name}</span></div></td>
                <td className="px-4 py-3 text-gray-500">{e.department||'—'}</td>
                <td className="px-4 py-3 text-gray-500">{e.designation||'—'}</td>
                <td className="px-4 py-3">{e.has_encoding?<span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">✓ Enrolled</span>:<span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">⚠ No face</span>}</td>
                <td className="px-4 py-3"><div className="flex gap-3"><button onClick={()=>openEdit(e)} className="text-xs text-indigo-600 hover:underline">Edit</button><button onClick={()=>remove(e.id)} className="text-xs text-red-500 hover:underline">Remove</button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
        {employees.length===0&&<p className="text-center text-gray-400 py-10 text-sm">No employees found</p>}
      </div>
      {modal&&(
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-base font-semibold text-gray-800 mb-4">{editing?'Edit Employee':'Add Employee'}</h3>
              <form onSubmit={save} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {[['employee_id','Employee ID','text',!editing],['name','Full Name','text',true],['email','Email','email',false],['phone','Phone','text',false],['designation','Designation','text',false],['joining_date','Joining Date','date',false]].map(([k,l,t,req])=>(
                    <div key={k}><label className="block text-xs font-medium text-gray-600 mb-1">{l}</label><input type={t} required={req} disabled={k==='employee_id'&&!!editing} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50" value={form[k]} onChange={e=>setForm(p=>({...p,[k]:e.target.value}))} /></div>
                  ))}
                </div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Department</label><select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" value={form.department_id} onChange={e=>setForm(p=>({...p,department_id:e.target.value}))}><option value="">Select…</option>{departments.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">{editing?'Update photo (optional)':'Employee photo *'}</label><input type="file" accept="image/*" required={!editing} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" onChange={e=>setImg(e.target.files[0])} /><p className="text-xs text-gray-400 mt-1">Clear front-facing photo for recognition</p></div>
                {error&&<p className="text-red-500 text-xs">{error}</p>}
                <div className="flex gap-3 pt-2"><button type="button" onClick={()=>setModal(false)} className="flex-1 border border-gray-200 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50">Cancel</button><button type="submit" disabled={saving} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg text-sm disabled:opacity-60">{saving?'Saving…':editing?'Update':'Add Employee'}</button></div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
