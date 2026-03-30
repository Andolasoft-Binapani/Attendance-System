import { useRef, useEffect, useState, useCallback } from 'react'

const SCAN_INTERVAL       = 2200
const LIVENESS_INTERVAL   = 500
const LIVENESS_THRESHOLD  = 7    // pixel-diff: mean below this = static frame
const LIVENESS_FRAMES     = 5    // consecutive static frames → block punch (layer 1)
const LV_FRAME_COUNT      = 5    // frames to collect for backend check (layer 2)
const LV_FRAME_GAP_MS     = 300  // 5 frames × 300ms = 1.5s collection window

const STEPS = [
  { n: 1, text: 'Look directly at the camera' },
  { n: 2, text: 'Hold still — liveness check runs automatically' },
  { n: 3, text: 'Press Punch In or Punch Out' },
  { n: 4, text: 'Wait for confirmation' },
]

async function apiFetch(url, opts = {}) {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts })
  return res.json()
}

const kioskApi = {
  identify: frame =>
    apiFetch('/api/recognition/identify', { method: 'POST', body: JSON.stringify({ frame }) }),
  status: id => apiFetch(`/api/kiosk/status/${id}`),
  punch: (employee_db_id, action, snapshot_path) =>
    apiFetch('/api/attendance/punch', { method: 'POST', body: JSON.stringify({ employee_db_id, action, snapshot_path }) }),
  verifyLiveness: frames =>
    apiFetch('/api/liveness/verify', { method: 'POST', body: JSON.stringify({ frames }) }),
}

// ── Small UI pieces ──────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
    </svg>
  )
}

function Clock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="text-center">
      <p className="text-3xl font-mono font-bold text-gray-800 tabular-nums">
        {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </p>
      <p className="text-sm text-gray-400 mt-0.5">
        {now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
      </p>
    </div>
  )
}

function KioskHeader() {
  return (
    <div className="flex items-center justify-between w-full max-w-5xl">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <span className="text-gray-800 font-semibold text-lg">Attendance Kiosk</span>
      </div>
      <Clock />
    </div>
  )
}

function ScanBadge({ scanning, detected }) {
  let dotClass = 'bg-gray-400'
  let label    = 'Ready'
  if (scanning)      { dotClass = 'bg-green-400 animate-pulse'; label = 'Scanning…' }
  else if (detected) { dotClass = 'bg-yellow-400';              label = 'Face found' }
  return (
    <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/50 backdrop-blur-sm rounded-full px-3 py-1">
      <div className={`w-2 h-2 rounded-full ${dotClass}`} />
      <span className="text-white text-xs font-medium">{label}</span>
    </div>
  )
}

function InstructionsCard() {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">How to use</p>
      <ol className="space-y-2">
        {STEPS.map(({ n, text }) => (
          <li key={n} className="flex items-start gap-2.5 text-xs text-gray-500">
            <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
              {n}
            </span>
            {text}
          </li>
        ))}
      </ol>
    </div>
  )
}

// ── Success popup ────────────────────────────────────────────────────────────

function SuccessPopup({ popup }) {
  const isIn       = popup.type === 'in'
  const ringClass  = isIn ? 'bg-green-100'  : 'bg-orange-100'
  const iconClass  = isIn ? 'text-green-500' : 'text-orange-500'
  const labelClass = isIn ? 'text-green-600' : 'text-orange-600'
  const label      = isIn ? 'Punched In!'    : 'Punched Out!'
  const tagline    = isIn ? 'Have a productive day!' : 'See you tomorrow!'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div
        className="bg-white rounded-3xl p-10 flex flex-col items-center gap-5 shadow-2xl w-full max-w-sm mx-4"
        style={{ animation: 'popIn 0.35s cubic-bezier(0.34,1.56,0.64,1) both' }}
      >
        <div className={`w-24 h-24 rounded-full flex items-center justify-center shadow-lg ${ringClass}`}>
          <svg className={`w-12 h-12 ${iconClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div className="text-center">
          <p className={`text-3xl font-extrabold ${labelClass}`}>{label}</p>
          <p className="text-gray-600 text-lg font-semibold mt-1">{popup.name}</p>
          <p className="text-4xl font-mono font-bold text-gray-800 mt-3 tabular-nums">{popup.time}</p>
        </div>
        <p className="text-gray-400 text-sm">{tagline}</p>
      </div>
    </div>
  )
}

// ── Right panel ──────────────────────────────────────────────────────────────

function PunchTimes({ status }) {
  if (!status?.punch_in && !status?.punch_out) return null
  return (
    <div className="flex gap-2 mt-3 text-xs">
      {status.punch_in && (
        <span className="flex-1 text-center bg-green-100 text-green-700 py-1 rounded-lg font-mono">
          In {new Date(status.punch_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      )}
      {status.punch_out && (
        <span className="flex-1 text-center bg-orange-100 text-orange-700 py-1 rounded-lg font-mono">
          Out {new Date(status.punch_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      )}
    </div>
  )
}

function EmployeeCard({ detected, status }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-green-200 bg-green-50 p-5">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-xl font-bold text-white shadow flex-shrink-0">
          {detected.name[0].toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-gray-800 text-sm truncate">{detected.name}</p>
          <p className="text-xs text-gray-500">{detected.employee_id}</p>
          {detected.department && <p className="text-xs text-gray-400 truncate">{detected.department}</p>}
        </div>
      </div>
      <PunchTimes status={status} />
    </div>
  )
}

function WaitingCard({ hint, done, livenessState, livenessReason }) {
  if (done) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <div className="py-4 flex justify-center">
          <p className="text-sm text-blue-600 font-medium text-center">Recorded! Restarting scan…</p>
        </div>
      </div>
    )
  }

  if (livenessState === 'collecting') {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-indigo-100 p-5">
        <div className="py-4 flex flex-col items-center gap-2">
          <Spinner />
          <p className="text-sm text-indigo-600 font-medium text-center">Collecting frames… hold still</p>
        </div>
      </div>
    )
  }

  if (livenessState === 'checking') {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-indigo-100 p-5">
        <div className="py-4 flex flex-col items-center gap-2">
          <Spinner />
          <p className="text-sm text-indigo-600 font-medium text-center">Verifying liveness…</p>
        </div>
      </div>
    )
  }

  if (livenessState === 'fail') {
    let reasonText = 'Liveness check failed'
    if (livenessReason === 'static_image')     reasonText = 'Static image or photo detected'
    if (livenessReason === 'no_face_detected') reasonText = 'Face not clearly visible'
    return (
      <div className="bg-red-50 rounded-2xl shadow-sm border border-red-200 p-5">
        <div className="py-4 flex flex-col items-center gap-1.5">
          <p className="text-sm text-red-600 font-semibold text-center">{reasonText}</p>
          <p className="text-xs text-red-400 text-center">Retrying in 3s…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <div className="py-4 flex flex-col items-center text-gray-300 gap-2">
        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
            d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
        </svg>
        <p className="text-xs text-center">{hint || 'Waiting for face detection…'}</p>
      </div>
    </div>
  )
}

// ── Camera action bar ─────────────────────────────────────────────────────────

function CameraActions({ detected, status, punching, done, isLive, livenessState, onPunch }) {
  if (done) {
    return <p className="text-center text-sm text-blue-600 py-1 font-medium">Recorded! Restarting scan…</p>
  }

  if (!detected) {
    return <p className="text-center text-sm text-gray-400 py-1">Position your face in front of the camera</p>
  }

  if (livenessState === 'collecting' || livenessState === 'checking') {
    return (
      <p className="text-center text-sm text-indigo-500 py-1 flex items-center justify-center gap-2">
        <Spinner />
        {livenessState === 'collecting' ? 'Collecting frames…' : 'Verifying liveness…'}
      </p>
    )
  }

  if (livenessState === 'fail') {
    return <p className="text-center text-sm text-red-500 py-1">Liveness check failed — retrying…</p>
  }

  const alreadyIn  = !!status?.punch_in
  const alreadyOut = !!status?.punch_out

  if (alreadyOut) {
    return <p className="text-center text-sm text-gray-500 py-1 font-medium">All done for today ✓</p>
  }

  const canPunch = isLive && livenessState === 'pass'

  return (
    <div className="space-y-2">
      <div className="flex gap-3">
        {!alreadyIn && (
          <button
            onClick={() => onPunch('punch_in')}
            disabled={punching || !canPunch}
            className="flex-1 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold transition active:scale-95"
          >
            {punching
              ? <span className="flex items-center justify-center gap-2"><Spinner />Recording…</span>
              : '✓ Punch In'}
          </button>
        )}
        {alreadyIn && !alreadyOut && (
          <button
            onClick={() => onPunch('punch_out')}
            disabled={punching || !canPunch}
            className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold transition active:scale-95"
          >
            {punching
              ? <span className="flex items-center justify-center gap-2"><Spinner />Recording…</span>
              : '✓ Punch Out'}
          </button>
        )}
      </div>
      {!isLive && (
        <p className="text-xs text-red-600 text-center bg-red-50 border border-red-100 py-1.5 rounded-lg font-medium">
          ⚠ Live face required — photos are not accepted
        </p>
      )}
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function KioskPage() {
  const videoRef      = useRef(null)
  const canvasRef     = useRef(null)
  const livenessRef   = useRef(null)   // small canvas for pixel-diff liveness (layer 1)
  const scanTimerRef  = useRef(null)
  const liveTimerRef  = useRef(null)
  const streamRef     = useRef(null)
  const prevPixelsRef = useRef(null)
  const lowCountRef   = useRef(0)

  // Refs to break circular useCallback dependency between startScan ↔ runLiveness
  const startScanRef   = useRef(null)
  const runLivenessRef = useRef(null)

  const [scanning,       setScanning]       = useState(false)
  const [detected,       setDetected]       = useState(null)
  const [status,         setStatus]         = useState(null)
  const [punching,       setPunching]       = useState(false)
  const [popup,          setPopup]          = useState(null)
  const [hint,           setHint]           = useState('')
  const [done,           setDone]           = useState(false)
  const [isLive,         setIsLive]         = useState(true)   // layer-1 pixel-diff
  const [livenessState,  setLivenessState]  = useState('idle') // layer-2 backend: idle|collecting|checking|pass|fail
  const [livenessReason, setLivenessReason] = useState('')
  const [camError,       setCamError]       = useState('')

  // Full-res capture for face recognition / liveness frame collection
  const capture = useCallback(() => {
    const v = videoRef.current, c = canvasRef.current
    if (!v || !c || !v.videoWidth) return null
    c.width = v.videoWidth; c.height = v.videoHeight
    c.getContext('2d').drawImage(v, 0, 0)
    return c.toDataURL('image/jpeg', 0.75)
  }, [])

  // Layer-1: pixel-diff liveness — 80×60 downsampled frame comparison every 500ms.
  // Catches completely static photos held in front of the camera.
  const checkLiveness = useCallback(() => {
    const v = videoRef.current, c = livenessRef.current
    if (!v || !c || !v.videoWidth) return
    const W = 80, H = 60
    c.width = W; c.height = H
    const ctx = c.getContext('2d')
    ctx.drawImage(v, 0, 0, W, H)
    const curr = ctx.getImageData(0, 0, W, H).data

    if (prevPixelsRef.current) {
      let diff = 0
      for (let i = 0; i < curr.length; i += 4) {
        diff += Math.abs(curr[i]   - prevPixelsRef.current[i])
        diff += Math.abs(curr[i+1] - prevPixelsRef.current[i+1])
        diff += Math.abs(curr[i+2] - prevPixelsRef.current[i+2])
      }
      const mean = diff / ((curr.length / 4) * 3)
      if (mean < LIVENESS_THRESHOLD) {
        lowCountRef.current = Math.min(lowCountRef.current + 1, LIVENESS_FRAMES + 1)
      } else {
        lowCountRef.current = 0
      }
      setIsLive(lowCountRef.current < LIVENESS_FRAMES)
    }
    prevPixelsRef.current = new Uint8ClampedArray(curr)
  }, [])

  // Layer-2: backend MediaPipe liveness — collect 5 frames after recognition,
  // send to /api/liveness/verify for EAR variance + nose movement analysis.
  const runLiveness = useCallback(async () => {
    setLivenessState('collecting')
    const frames = []
    for (let i = 0; i < LV_FRAME_COUNT; i++) {
      const f = capture()
      if (f) frames.push(f)
      if (i < LV_FRAME_COUNT - 1) await new Promise(r => setTimeout(r, LV_FRAME_GAP_MS))
    }

    setLivenessState('checking')
    try {
      const result = await kioskApi.verifyLiveness(frames)
      if (result.is_live) {
        setLivenessState('pass')
      } else {
        setLivenessState('fail')
        setLivenessReason(result.reason || 'static_image')
        setTimeout(() => startScanRef.current?.(), 3000)
      }
    } catch {
      // Network/backend error → fail open so real employees aren't blocked
      setLivenessState('pass')
    }
  }, [capture])

  // Keep refs current so each callback always calls the latest version
  useEffect(() => { startScanRef.current   = startScan   }, )   // updated below
  useEffect(() => { runLivenessRef.current = runLiveness }, [runLiveness])

  const startScan = useCallback(() => {
    clearInterval(scanTimerRef.current)
    // Reset both liveness layers for each new scan
    lowCountRef.current = 0
    prevPixelsRef.current = null
    setIsLive(true)
    setLivenessState('idle')
    setLivenessReason('')
    setDetected(null); setStatus(null); setDone(false)
    setHint('Looking for a face…'); setScanning(true)

    scanTimerRef.current = setInterval(async () => {
      const frame = capture(); if (!frame) return
      try {
        const data = await kioskApi.identify(frame)
        if (data.recognized) {
          clearInterval(scanTimerRef.current)
          setScanning(false); setDetected(data); setHint('')
          setStatus(await kioskApi.status(data.employee_db_id))
          runLivenessRef.current?.()   // trigger layer-2 check after recognition
        } else {
          setHint(data.message || 'No face detected')
        }
      } catch { setHint('Recognition error, retrying…') }
    }, SCAN_INTERVAL)
  }, [capture])

  // Keep startScanRef current
  useEffect(() => { startScanRef.current = startScan }, [startScan])

  // Auto-start camera on mount; clean up on unmount
  useEffect(() => {
    let cancelled = false
    navigator.mediaDevices
      .getUserMedia({ video: { width: 1280, height: 720, facingMode: 'user' } })
      .then(stream => {
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        videoRef.current.srcObject = stream
        return videoRef.current.play()
      })
      .then(() => {
        if (cancelled) return
        liveTimerRef.current = setInterval(checkLiveness, LIVENESS_INTERVAL)
        startScan()
      })
      .catch(() => { if (!cancelled) setCamError('Camera permission denied. Please allow camera access and reload.') })

    return () => {
      cancelled = true
      clearInterval(scanTimerRef.current)
      clearInterval(liveTimerRef.current)
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    }
  }, [checkLiveness, startScan])

  const punch = useCallback(async action => {
    if (!detected || punching || !isLive || livenessState !== 'pass') return
    setPunching(true)
    try {
      const data = await kioskApi.punch(detected.employee_db_id, action, detected.snapshot_path)
      if (data.status === 'success') {
        const time = new Date(data.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        setPopup({ type: action === 'punch_in' ? 'in' : 'out', name: detected.name, time })
        setDone(true)
        setTimeout(() => { setPopup(null); startScanRef.current?.() }, 3500)
      } else {
        setHint(data.message || 'Punch failed'); setTimeout(() => startScanRef.current?.(), 2500)
      }
    } catch {
      setHint('Punch failed, please try again'); setTimeout(() => startScanRef.current?.(), 2500)
    } finally { setPunching(false) }
  }, [detected, punching, isLive, livenessState])

  return (
    <>
      <style>{`@keyframes popIn { from { opacity:0; transform:scale(0.7) } to { opacity:1; transform:scale(1) } }`}</style>

      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-6 gap-6">
        <KioskHeader />

        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Camera panel */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="relative bg-gray-900" style={{ aspectRatio: '4/3' }}>
              <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
              <canvas ref={canvasRef} className="hidden" />
              <canvas ref={livenessRef} className="hidden" />

              {camError ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white/50 text-sm gap-3 px-6 text-center">
                  <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M4 8a2 2 0 012-2h9a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2V8z" />
                  </svg>
                  {camError}
                </div>
              ) : (
                <>
                  <ScanBadge scanning={scanning} detected={detected} />

                  {/* Bottom overlay: hint / liveness states */}
                  {hint && !detected && (
                    <div className="absolute bottom-3 left-0 right-0 flex justify-center">
                      <span className="bg-black/50 backdrop-blur-sm text-white/70 text-xs px-3 py-1 rounded-full">{hint}</span>
                    </div>
                  )}
                  {detected && livenessState === 'collecting' && (
                    <div className="absolute bottom-3 left-0 right-0 flex justify-center">
                      <span className="bg-indigo-600/80 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-full font-medium">
                        Hold still — collecting frames…
                      </span>
                    </div>
                  )}
                  {detected && livenessState === 'checking' && (
                    <div className="absolute bottom-3 left-0 right-0 flex justify-center">
                      <span className="bg-indigo-600/80 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-full font-medium">
                        Verifying liveness…
                      </span>
                    </div>
                  )}
                  {detected && livenessState === 'fail' && (
                    <div className="absolute bottom-3 left-0 right-0 flex justify-center">
                      <span className="bg-red-600/80 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-full font-medium">
                        ⚠ Liveness check failed — please try again
                      </span>
                    </div>
                  )}
                  {detected && livenessState === 'pass' && !isLive && (
                    <div className="absolute bottom-3 left-0 right-0 flex justify-center">
                      <span className="bg-red-600/80 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-full font-medium">
                        ⚠ Static image detected — show your real face
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Punch buttons */}
            <div className="p-4">
              <CameraActions
                detected={detected} status={status} punching={punching}
                done={done} isLive={isLive} livenessState={livenessState} onPunch={punch}
              />
            </div>
          </div>

          {/* Right panel */}
          <div className="space-y-4">
            {detected && !done && livenessState === 'pass'
              ? <EmployeeCard detected={detected} status={status} />
              : <WaitingCard
                  hint={hint} done={done}
                  livenessState={livenessState} livenessReason={livenessReason}
                />
            }
            <InstructionsCard />
          </div>
        </div>
      </div>

      {popup && <SuccessPopup popup={popup} />}
    </>
  )
}
