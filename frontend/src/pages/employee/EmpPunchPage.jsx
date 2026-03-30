import { useState, useRef, useEffect, useCallback } from 'react'
import { employeePanelApi } from '../../api/client'

const STATUS_COLOR = {
  present: 'text-green-600 bg-green-50',
  late: 'text-yellow-600 bg-yellow-50',
  half_day: 'text-orange-600 bg-orange-50',
}

function fmt(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function EmpPunchPage() {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [today, setToday] = useState(null)
  const [loading, setLoading] = useState(true)
  const [punching, setPunching] = useState(false)
  const [message, setMessage] = useState(null) // { text, ok }
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const loadToday = useCallback(async () => {
    try { const r = await employeePanelApi.today(); setToday(r.data) }
    catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadToday() }, [loadToday])

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' } })
      videoRef.current.srcObject = stream
      await videoRef.current.play()
      setCameraActive(true)
    } catch { setMessage({ text: 'Camera permission denied — you can still punch without a photo.', ok: false }) }
  }

  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) videoRef.current.srcObject.getTracks().forEach(t => t.stop())
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraActive(false)
  }, [])

  useEffect(() => () => stopCamera(), [stopCamera])

  const captureBlob = () => new Promise(resolve => {
    const v = videoRef.current, c = canvasRef.current
    if (!v || !c || !cameraActive) return resolve(null)
    c.width = v.videoWidth; c.height = v.videoHeight
    c.getContext('2d').drawImage(v, 0, 0)
    c.toBlob(resolve, 'image/jpeg', 0.8)
  })

  const punch = async action => {
    setPunching(true); setMessage(null)
    try {
      const blob = await captureBlob()
      const fd = new FormData()
      fd.append('action', action)
      if (blob) fd.append('image', blob, 'selfie.jpg')
      const r = await employeePanelApi.punch(fd)
      setMessage({ text: r.data.message, ok: r.data.status === 'success' })
      await loadToday()
      stopCamera()
    } catch (e) {
      setMessage({ text: e.response?.data?.detail || 'Punch failed. Please try again.', ok: false })
    } finally { setPunching(false) }
  }

  const action = !today?.punch_in_time ? 'punch_in' : !today?.punch_out_time ? 'punch_out' : null
  const allDone = today?.punch_in_time && today?.punch_out_time

  return (
    <div className="max-w-2xl mx-auto p-6">
      {/* Live clock */}
      <div className="text-center mb-6">
        <p className="text-4xl font-light text-gray-800 tabular-nums tracking-tight">
          {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </p>
        <p className="text-sm text-gray-400 mt-1">{now.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>

      {/* Today status card */}
      {!loading && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Today's Status</p>
          {today?.status && (
            <span className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full capitalize mb-3 ${STATUS_COLOR[today.status] || 'text-gray-600 bg-gray-50'}`}>
              {today.status.replace('_', ' ')}
            </span>
          )}
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-gray-400 mb-1">Punch In</p>
              <p className={`font-mono text-sm font-semibold ${today?.punch_in_time ? 'text-green-600' : 'text-gray-300'}`}>{fmt(today?.punch_in_time)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Punch Out</p>
              <p className={`font-mono text-sm font-semibold ${today?.punch_out_time ? 'text-orange-600' : 'text-gray-300'}`}>{fmt(today?.punch_out_time)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Hours</p>
              <p className={`font-mono text-sm font-semibold ${today?.working_hours ? 'text-indigo-600' : 'text-gray-300'}`}>{today?.working_hours ? `${today.working_hours}h` : '—'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Camera + punch */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Camera preview */}
        <div className="relative bg-gray-900" style={{ aspectRatio: '16/9' }}>
          <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
          <canvas ref={canvasRef} className="hidden" />
          {!cameraActive && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white/50">
              <svg className="w-10 h-10 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              <p className="text-xs">Camera off — optional for photo capture</p>
            </div>
          )}
          {cameraActive && (
            <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/50 rounded-full px-3 py-1">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-white text-xs">Live</span>
            </div>
          )}
        </div>

        <div className="p-5 space-y-3">
          {message && (
            <div className={`flex items-center gap-2 text-sm px-4 py-2.5 rounded-lg ${message.ok ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {message.ok
                  ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />}
              </svg>
              {message.text}
            </div>
          )}

          {allDone ? (
            <div className="text-center py-3 text-sm text-gray-500">
              <svg className="w-8 h-8 text-green-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              All done for today! See you tomorrow.
            </div>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={cameraActive ? stopCamera : startCamera}
                className="flex-shrink-0 border border-gray-200 text-gray-600 hover:bg-gray-50 px-4 py-2.5 rounded-lg text-sm transition"
              >
                {cameraActive ? 'Stop Camera' : 'Start Camera'}
              </button>
              <button
                onClick={() => punch(action)}
                disabled={punching}
                className={`flex-1 text-white font-medium py-2.5 rounded-lg text-sm transition disabled:opacity-60 ${action === 'punch_in' ? 'bg-green-500 hover:bg-green-600' : 'bg-orange-500 hover:bg-orange-600'}`}
              >
                {punching ? 'Recording…' : action === 'punch_in' ? '✓ Punch In' : '✓ Punch Out'}
              </button>
            </div>
          )}

          <p className="text-xs text-gray-400 text-center">
            {cameraActive ? 'A selfie will be captured with your punch' : 'Start camera to include a punch photo'}
          </p>
        </div>
      </div>
    </div>
  )
}
