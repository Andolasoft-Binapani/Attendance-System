import React, { useRef, useEffect, useState, useCallback } from 'react'
import { recognitionApi, attendanceApi } from '../api/client'
const INTERVAL = 2200
export default function PunchPage() {
  const videoRef = useRef(null); const canvasRef = useRef(null); const timerRef = useRef(null)
  const [active, setActive] = useState(false); const [scanning, setScanning] = useState(false)
  const [detected, setDetected] = useState(null); const [msg, setMsg] = useState('')
  const [todayLogs, setTodayLogs] = useState([]); const [punching, setPunching] = useState(false)
  const [done, setDone] = useState(false)
  const loadToday = async () => { try { const r = await attendanceApi.today(); setTodayLogs(r.data) } catch {} }
  useEffect(() => { loadToday() }, [])
  const capture = () => {
    const v = videoRef.current, c = canvasRef.current
    if (!v || !c) return null
    c.width = v.videoWidth; c.height = v.videoHeight
    c.getContext('2d').drawImage(v, 0, 0)
    return c.toDataURL('image/jpeg', 0.75)
  }
  const startScan = useCallback(() => {
    timerRef.current = setInterval(async () => {
      const frame = capture(); if (!frame) return
      try {
        const r = await recognitionApi.identify(frame)
        if (r.data.recognized) { clearInterval(timerRef.current); setScanning(false); setDetected(r.data) }
        else setMsg(r.data.message)
      } catch {}
    }, INTERVAL)
    setScanning(true)
  }, [])
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } })
      videoRef.current.srcObject = stream; await videoRef.current.play()
      setActive(true); setDetected(null); setDone(false); setMsg(''); startScan()
    } catch { setMsg('Camera permission denied.') }
  }
  const stopCamera = useCallback(() => {
    clearInterval(timerRef.current)
    if (videoRef.current?.srcObject) videoRef.current.srcObject.getTracks().forEach(t => t.stop())
    if (videoRef.current) videoRef.current.srcObject = null
    setActive(false); setScanning(false); setDetected(null); setMsg(''); setDone(false)
  }, [])
  const punch = async action => {
    if (!detected) return; setPunching(true)
    try {
      const r = await attendanceApi.punch({ employee_db_id: detected.employee_db_id, action })
      setMsg(r.data.message); setDone(true); await loadToday(); setTimeout(stopCamera, 3500)
    } catch (e) { setMsg(e.response?.data?.detail || 'Punch failed') }
    finally { setPunching(false) }
  }
  const alreadyIn  = detected && todayLogs.some(l => l.employee_id === detected.employee_id && l.punch_in)
  const alreadyOut = detected && todayLogs.some(l => l.employee_id === detected.employee_id && l.punch_out)
  return (
    <div className="max-w-5xl mx-auto p-6">
      <h2 className="text-xl font-semibold text-gray-800 mb-5">Punch In / Out</h2>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="relative bg-gray-900" style={{aspectRatio:'4/3'}}>
            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
            <canvas ref={canvasRef} className="hidden" />
            {!active && (<div className="absolute inset-0 flex flex-col items-center justify-center text-white/60"><svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M4 8a2 2 0 012-2h9a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2V8z" /></svg><span className="text-sm">Camera off</span></div>)}
            {active && (<div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/50 rounded-full px-3 py-1"><div className={`w-2 h-2 rounded-full ${scanning?'bg-green-400 animate-pulse':'bg-yellow-400'}`} /><span className="text-white text-xs">{scanning?'Scanning…':detected?'Face found':'Ready'}</span></div>)}
          </div>
          <div className="p-4">{!active?<button onClick={startCamera} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-lg text-sm font-medium">Start Camera</button>:<button onClick={stopCamera} className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-lg text-sm font-medium">Stop Camera</button>}</div>
        </div>
        <div className="space-y-4">
          <div className={`bg-white rounded-2xl shadow-sm border p-5 transition ${detected&&!done?'border-green-200 bg-green-50':done?'border-blue-200 bg-blue-50':'border-gray-100'}`}>
            {detected&&!done?(<>
              <div className="flex items-center gap-3 mb-4"><div className="w-11 h-11 rounded-full bg-green-200 text-green-700 flex items-center justify-center text-lg font-semibold">{detected.name[0]}</div><div><p className="font-semibold text-gray-800 text-sm">{detected.name}</p><p className="text-xs text-gray-500">{detected.employee_id}</p>{detected.department&&<p className="text-xs text-gray-400">{detected.department}</p>}</div></div>
              <div className="space-y-2">
                {!alreadyIn&&!alreadyOut&&<button onClick={()=>punch('punch_in')} disabled={punching} className="w-full bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50">{punching?'Recording…':'✓ Punch In'}</button>}
                {alreadyIn&&!alreadyOut&&<button onClick={()=>punch('punch_out')} disabled={punching} className="w-full bg-orange-500 hover:bg-orange-600 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50">{punching?'Recording…':'✓ Punch Out'}</button>}
                {alreadyOut&&<p className="text-center text-xs text-gray-500 py-2">All done for today ✓</p>}
              </div>
            </>):done?<p className="text-center text-sm text-blue-600 py-2">{msg}</p>:<p className="text-center text-xs text-gray-400 py-4">{msg||'Start camera to begin'}</p>}
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <p className="text-xs font-semibold text-gray-600 mb-3 uppercase tracking-wide">Today</p>
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {todayLogs.length===0?<p className="text-xs text-gray-400 text-center py-2">No records yet</p>:todayLogs.map(l=>(
                <div key={l.id} className="flex items-center justify-between">
                  <span className="text-xs text-gray-700 font-medium truncate w-24">{l.name}</span>
                  <div className="flex gap-1 text-xs">
                    <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-mono">{l.punch_in?new Date(l.punch_in).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'--'}</span>
                    <span className="bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-mono">{l.punch_out?new Date(l.punch_out).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'--'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
