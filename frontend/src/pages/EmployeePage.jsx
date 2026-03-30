import { useEffect, useRef, useState, useCallback } from 'react'
import { employeeApi, employeePanelApi } from '../api/client'

const EMPTY = { employee_id:'',name:'',email:'',phone:'',department_id:'',designation:'',joining_date:'' }
const ACCT  = { username:'', password:'' }
const submitLabel = editing => editing ? 'Update' : 'Add Employee'

export default function EmployeePage() {
  const [employees, setEmployees] = useState([])
  const [departments, setDepartments] = useState([])
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [img, setImg] = useState(null)
  const [imgPreview, setImgPreview] = useState(null)
  const [imgMode, setImgMode] = useState('upload') // 'upload' | 'webcam'
  const [webcamActive, setWebcamActive] = useState(false)
  const [captured, setCaptured] = useState(false)
  const webcamRef = useRef(null)
  const webcamCanvas = useRef(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  // Create-login modal
  const [acctTarget, setAcctTarget] = useState(null) // employee object
  const [acctForm, setAcctForm] = useState(ACCT)
  const [acctError, setAcctError] = useState('')
  const [acctSaving, setAcctSaving] = useState(false)
  const [acctDone, setAcctDone] = useState(false)

  const load = async () => {
    const [a, b] = await Promise.all([employeeApi.list({ search }), employeeApi.departments()])
    setEmployees(a.data); setDepartments(b.data)
  }
  useEffect(() => { load() }, [search])

  const stopWebcam = useCallback(() => {
    if (webcamRef.current?.srcObject) {
      webcamRef.current.srcObject.getTracks().forEach(t => t.stop())
      webcamRef.current.srcObject = null
    }
    setWebcamActive(false)
  }, [])

  const openAdd  = () => { stopWebcam(); setEditing(null); setForm(EMPTY); setImg(null); setImgPreview(null); setImgMode('upload'); setCaptured(false); setError(''); setModal(true) }
  const openEdit = emp => { stopWebcam(); setEditing(emp); setForm({ employee_id: emp.employee_id, name: emp.name, email: emp.email||'', phone: emp.phone||'', department_id:'', designation: emp.designation||'', joining_date: emp.joining_date||'' }); setImg(null); setImgPreview(null); setImgMode('upload'); setCaptured(false); setError(''); setModal(true) }
  const closeModal = () => { stopWebcam(); setModal(false) }

  const startWebcam = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' } })
      webcamRef.current.srcObject = stream
      await webcamRef.current.play()
      setWebcamActive(true)
    } catch { setError('Camera permission denied'); setImgMode('upload') }
  }, [])

  const switchMode = useCallback(async mode => {
    if (mode === 'upload') { stopWebcam(); setCaptured(false); setImgPreview(null) }
    else { setCaptured(false); setImgPreview(null); setImg(null); await startWebcam() }
    setImgMode(mode)
  }, [stopWebcam, startWebcam])

  const capturePhoto = useCallback(() => {
    const v = webcamRef.current, c = webcamCanvas.current
    if (!v || !c) return
    c.width = v.videoWidth; c.height = v.videoHeight
    c.getContext('2d').drawImage(v, 0, 0)
    setImgPreview(c.toDataURL('image/jpeg', 0.9))
    c.toBlob(blob => setImg(new File([blob], 'webcam-capture.jpg', { type: 'image/jpeg' })), 'image/jpeg', 0.9)
    setCaptured(true); stopWebcam()
  }, [stopWebcam])

  const retakePhoto = useCallback(async () => {
    setCaptured(false); setImgPreview(null); setImg(null); await startWebcam()
  }, [startWebcam])

  const save = async e => {
    e.preventDefault(); setError(''); setSaving(true)
    try {
      const fd = new FormData()
      Object.entries(form).forEach(([k,v]) => v && fd.append(k, v))
      if (img) fd.append('image', img)
      editing ? await employeeApi.update(editing.id, fd) : await employeeApi.create(fd)
      setModal(false); load()
    } catch (err) { setError(err.response?.data?.detail || 'Failed to save') }
    finally { setSaving(false) }
  }

  const remove = async id => {
    if (!confirm('Deactivate this employee?')) return
    await employeeApi.remove(id); load()
  }

  const openAcct = emp => {
    setAcctTarget(emp)
    setAcctForm({ username: emp.employee_id, password: '' })
    setAcctError(''); setAcctDone(false)
  }

  const createAccount = async e => {
    e.preventDefault(); setAcctError(''); setAcctSaving(true)
    try {
      await employeePanelApi.createAccount(acctTarget.id, acctForm)
      setAcctDone(true); load()
    } catch (err) { setAcctError(err.response?.data?.detail || 'Failed to create account') }
    finally { setAcctSaving(false) }
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-semibold text-gray-800">Employees</h2>
        <button onClick={openAdd} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium">+ Add Employee</button>
      </div>

      <input className="mb-4 border border-gray-200 rounded-lg px-4 py-2 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm min-w-[740px]">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>{['ID','Name','Department','Designation','Face','Login',''].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {employees.map(e => (
              <tr key={e.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs text-indigo-600">{e.employee_id}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-semibold">{e.name[0]}</div>
                    <span className="font-medium text-gray-800">{e.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-500">{e.department || '—'}</td>
                <td className="px-4 py-3 text-gray-500">{e.designation || '—'}</td>
                <td className="px-4 py-3">
                  {e.has_encoding
                    ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">✓ Enrolled</span>
                    : <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">⚠ No face</span>}
                </td>
                <td className="px-4 py-3">
                  {e.has_account
                    ? <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">✓ Has login</span>
                    : <button onClick={() => openAcct(e)} className="text-xs bg-gray-100 hover:bg-indigo-50 hover:text-indigo-700 text-gray-600 px-2 py-0.5 rounded-full transition">+ Create login</button>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-3">
                    <button onClick={() => openEdit(e)} className="text-xs text-indigo-600 hover:underline">Edit</button>
                    <button onClick={() => remove(e.id)} className="text-xs text-red-500 hover:underline">Remove</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {employees.length === 0 && <p className="text-center text-gray-400 py-10 text-sm">No employees found</p>}
      </div>

      {/* Add/Edit modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-base font-semibold text-gray-800 mb-4">{editing ? 'Edit Employee' : 'Add Employee'}</h3>
              <form onSubmit={save} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {[['employee_id','Employee ID','text',!editing],['name','Full Name','text',true],['email','Email','email',false],['phone','Phone','text',false],['designation','Designation','text',false],['joining_date','Joining Date','date',false]].map(([k,l,t,req]) => (
                    <div key={k}>
                      <label className="block text-xs font-medium text-gray-600 mb-1">{l}</label>
                      <input type={t} required={req} disabled={k==='employee_id' && !!editing} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50" value={form[k]} onChange={e => setForm(p => ({...p,[k]:e.target.value}))} />
                    </div>
                  ))}
                </div>
                <div>
                  <label htmlFor="dept" className="block text-xs font-medium text-gray-600 mb-1">Department</label>
                  <select id="dept" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" value={form.department_id} onChange={e => setForm(p => ({...p,department_id:e.target.value}))}>
                    <option value="">Select…</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-2">{editing ? 'Update photo (optional)' : 'Employee photo *'}</p>
                  {/* Mode tabs */}
                  <div className="flex rounded-lg border border-gray-200 overflow-hidden mb-3 text-xs font-medium">
                    <button type="button" onClick={() => switchMode('upload')}
                      className={`flex-1 py-1.5 transition ${imgMode==='upload' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                      Upload File
                    </button>
                    <button type="button" onClick={() => switchMode('webcam')}
                      className={`flex-1 py-1.5 transition ${imgMode==='webcam' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                      Use Webcam
                    </button>
                  </div>
                  {imgMode === 'upload' ? (
                    <div>
                      <input id="emp-photo" type="file" accept="image/*" required={!editing && !img}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                        onChange={e => { const f = e.target.files[0]; setImg(f); setImgPreview(f ? URL.createObjectURL(f) : null) }} />
                      {imgPreview && <img src={imgPreview} alt="preview" className="mt-2 w-20 h-20 object-cover rounded-lg border border-gray-200" />}
                    </div>
                  ) : (
                    <div>
                      {captured ? (
                        <>
                          <img src={imgPreview} alt="captured" className="w-full rounded-lg border border-gray-200 object-cover" style={{aspectRatio:'4/3'}} />
                          <button type="button" onClick={retakePhoto}
                            className="mt-2 w-full border border-gray-200 text-gray-600 hover:bg-gray-50 py-2 rounded-lg text-sm font-medium">
                            Retake
                          </button>
                        </>
                      ) : (
                        <>
                          <div className="relative bg-gray-900 rounded-lg overflow-hidden" style={{aspectRatio:'4/3'}}>
                            <video ref={webcamRef} className="w-full h-full object-cover" playsInline muted />
                            {!webcamActive && <div className="absolute inset-0 flex items-center justify-center text-white/50 text-sm">Starting camera…</div>}
                          </div>
                          <canvas ref={webcamCanvas} className="hidden" />
                          <button type="button" onClick={capturePhoto} disabled={!webcamActive}
                            className="mt-2 w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                            Capture Photo
                          </button>
                        </>
                      )}
                    </div>
                  )}
                  <p className="text-xs text-gray-400 mt-1">Clear front-facing photo for recognition</p>
                </div>
                {error && <p className="text-red-500 text-xs">{error}</p>}
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={closeModal} className="flex-1 border border-gray-200 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
                  <button type="submit" disabled={saving} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg text-sm disabled:opacity-60">{saving ? 'Saving…' : submitLabel(editing)}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Create login modal */}
      {acctTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="p-6">
              {acctDone ? (
                <div className="text-center py-2">
                  <svg className="w-12 h-12 text-green-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <p className="font-semibold text-gray-800 mb-1">Account created!</p>
                  <p className="text-sm text-gray-500 mb-1">Username: <span className="font-mono font-medium text-indigo-600">{acctForm.username}</span></p>
                  <p className="text-xs text-gray-400 mb-4">Share these credentials with the employee.</p>
                  <button onClick={() => setAcctTarget(null)} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg text-sm">Done</button>
                </div>
              ) : (
                <>
                  <h3 className="text-base font-semibold text-gray-800 mb-1">Create Employee Login</h3>
                  <p className="text-xs text-gray-400 mb-4">For <span className="font-medium text-gray-700">{acctTarget.name}</span></p>
                  <form onSubmit={createAccount} className="space-y-3">
                    <div>
                      <label htmlFor="acct-username" className="block text-xs font-medium text-gray-600 mb-1">Username</label>
                      <input id="acct-username" type="text" required value={acctForm.username} onChange={e => setAcctForm(p => ({...p, username: e.target.value}))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div>
                      <label htmlFor="acct-password" className="block text-xs font-medium text-gray-600 mb-1">Password</label>
                      <input id="acct-password" type="text" required minLength={6} value={acctForm.password} onChange={e => setAcctForm(p => ({...p, password: e.target.value}))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Min 6 characters" />
                    </div>
                    {acctError && <p className="text-red-500 text-xs">{acctError}</p>}
                    <div className="flex gap-3 pt-1">
                      <button type="button" onClick={() => setAcctTarget(null)} className="flex-1 border border-gray-200 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
                      <button type="submit" disabled={acctSaving} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg text-sm disabled:opacity-60">{acctSaving ? 'Creating…' : 'Create'}</button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
