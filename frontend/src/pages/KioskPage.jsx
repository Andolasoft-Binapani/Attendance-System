import { useRef, useEffect, useState, useCallback } from 'react'

// ── Constants ─────────────────────────────────────────────────────────────────
const SCAN_INTERVAL       = 2200   // ms between face-recognition attempts
const LIVENESS_INTERVAL   = 500    // ms between layer-1 pixel-diff samples
const LIVENESS_THRESHOLD  = 7      // mean pixel diff < this = suspicious (static frame)
const LIVENESS_FRAMES     = 5      // consecutive static frames → block punch
const LV_FRAME_COUNT      = 5      // frames to collect for backend check
const LV_FRAME_GAP_MS     = 300    // gap between collected frames (5 × 300 = 1.5 s window)
const CHALLENGE_THRESHOLD = 22     // pixel-diff spike needed to pass a challenge
const CHALLENGE_TIMEOUT_S = 12     // seconds to complete challenge before failing
const SESSION_TIMEOUT_S   = 45     // reset the whole session if nothing succeeds

// ── Challenges ────────────────────────────────────────────────────────────────
const CHALLENGES = [
  { key: 'blink',       text: 'Blink your eyes twice',          icon: '👁' },
  { key: 'nod',         text: 'Slowly nod your head',           icon: '↕' },
  { key: 'turn_right',  text: 'Turn your head slightly right',  icon: '→' },
  { key: 'turn_left',   text: 'Turn your head slightly left',   icon: '←' },
  { key: 'smile',       text: 'Smile at the camera',            icon: '😊' },
]

function randomChallenge() {
  return CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)]
}

const STEPS = [
  { n: 1, text: 'Look directly at the camera' },
  { n: 2, text: 'Complete the on-screen challenge' },
  { n: 3, text: 'Wait for liveness verification' },
  { n: 4, text: 'Press Punch In or Punch Out' },
]

// ── API ───────────────────────────────────────────────────────────────────────
async function apiFetch(url, opts = {}) {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts })
  return res.json()
}

const kioskApi = {
  identify: frame =>
    apiFetch('/api/recognition/identify', { method: 'POST', body: JSON.stringify({ frame }) }),
  status: id =>
    apiFetch(`/api/kiosk/status/${id}`),
  punch: (employee_db_id, action, snapshot_path) =>
    apiFetch('/api/attendance/punch', { method: 'POST', body: JSON.stringify({ employee_db_id, action, snapshot_path }) }),
  verifyLiveness: (frames, challenge, challengePassed, employeeDbId) =>
    apiFetch('/api/liveness/verify', {
      method: 'POST',
      body: JSON.stringify({
        frames,
        client_ts_ms:     Date.now(),
        challenge:        challenge?.key ?? null,
        challenge_passed: challengePassed,
        employee_db_id:   employeeDbId ?? null,
      }),
    }),
}

// ── Small UI pieces ───────────────────────────────────────────────────────────

function Spinner({ size = 4 }) {
  return (
    <svg className={`w-${size} h-${size} animate-spin`} fill="none" viewBox="0 0 24 24">
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

function KioskHeader({ sessionLeft }) {
  const warn = sessionLeft !== null && sessionLeft <= 10
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
      {sessionLeft !== null && (
        <div className={`text-xs font-mono px-3 py-1 rounded-full border ${warn ? 'bg-red-50 border-red-200 text-red-600 animate-pulse' : 'bg-gray-100 border-gray-200 text-gray-500'}`}>
          {warn ? '⏱ ' : ''}{sessionLeft}s
        </div>
      )}
    </div>
  )
}

// ── Camera overlay badges ─────────────────────────────────────────────────────

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

function LivenessBadge({ isLive, livenessState }) {
  if (livenessState !== 'pass') return null
  if (!isLive) {
    return (
      <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-red-600/85 backdrop-blur-sm rounded-full px-3 py-1">
        <span className="text-white text-xs font-semibold">⚠️ Spoof detected</span>
      </div>
    )
  }
  return (
    <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-green-600/85 backdrop-blur-sm rounded-full px-3 py-1">
      <span className="text-white text-xs font-semibold">✅ Live face detected</span>
    </div>
  )
}

// ── Challenge overlay ─────────────────────────────────────────────────────────

function ChallengeOverlay({ challenge, secondsLeft, challengeState }) {
  if (!challenge || challengeState === 'pass' || challengeState === 'idle') return null

  const isFail = challengeState === 'fail' || challengeState === 'timeout'
  const bgColor = isFail ? 'bg-red-600/90' : 'bg-indigo-700/90'
  const progress = Math.max(0, secondsLeft / CHALLENGE_TIMEOUT_S)

  return (
    <div className={`absolute inset-0 flex flex-col items-center justify-end pb-6 ${bgColor} backdrop-blur-sm transition-colors`}>
      {/* Progress ring around icon */}
      <div className="relative flex items-center justify-center mb-3">
        <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="34" fill="none" stroke="white" strokeOpacity="0.2" strokeWidth="5" />
          <circle
            cx="40" cy="40" r="34" fill="none"
            stroke={isFail ? '#fca5a5' : 'white'} strokeWidth="5"
            strokeDasharray={`${2 * Math.PI * 34}`}
            strokeDashoffset={`${2 * Math.PI * 34 * (1 - progress)}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1s linear' }}
          />
        </svg>
        <span className="absolute text-3xl">{challenge.icon}</span>
      </div>

      {isFail ? (
        <p className="text-white font-bold text-base text-center px-4">Challenge failed — retrying…</p>
      ) : (
        <>
          <p className="text-white/70 text-xs uppercase tracking-widest mb-1">Challenge</p>
          <p className="text-white font-bold text-lg text-center px-4">{challenge.text}</p>
          <p className="text-white/60 text-xs mt-1">{secondsLeft}s remaining</p>
        </>
      )}
    </div>
  )
}

// ── Bottom camera hints ───────────────────────────────────────────────────────

function CameraHint({ hint, detected, livenessState, isLive, challengeState }) {
  if (detected && (challengeState === 'active' || challengeState === 'fail' || challengeState === 'timeout')) {
    return null // challenge overlay covers this
  }
  if (hint && !detected) {
    return (
      <div className="absolute bottom-3 left-0 right-0 flex justify-center">
        <span className="bg-black/50 backdrop-blur-sm text-white/70 text-xs px-3 py-1 rounded-full">{hint}</span>
      </div>
    )
  }
  if (detected && livenessState === 'collecting') {
    return (
      <div className="absolute bottom-3 left-0 right-0 flex justify-center">
        <span className="bg-indigo-600/80 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-full font-medium">
          Hold still — collecting frames…
        </span>
      </div>
    )
  }
  if (detected && livenessState === 'checking') {
    return (
      <div className="absolute bottom-3 left-0 right-0 flex justify-center">
        <span className="bg-indigo-600/80 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-full font-medium">
          Verifying liveness…
        </span>
      </div>
    )
  }
  if (detected && livenessState === 'fail') {
    return (
      <div className="absolute bottom-3 left-0 right-0 flex justify-center">
        <span className="bg-red-600/80 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-full font-medium">
          ⚠ Liveness check failed — please try again
        </span>
      </div>
    )
  }
  if (detected && livenessState === 'pass' && !isLive) {
    return (
      <div className="absolute bottom-3 left-0 right-0 flex justify-center">
        <span className="bg-red-600/80 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-full font-medium">
          ⚠ Static image detected — show your live face
        </span>
      </div>
    )
  }
  return null
}

// ── Success popup ─────────────────────────────────────────────────────────────

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

// ── Right panel cards ─────────────────────────────────────────────────────────

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

function StatusCard({ hint, done, livenessState, livenessReason, livenessMsg, challengeState, challenge }) {
  if (done) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <div className="py-4 flex justify-center">
          <p className="text-sm text-blue-600 font-medium text-center">Recorded! Restarting scan…</p>
        </div>
      </div>
    )
  }

  // Challenge active
  if (challengeState === 'active' && challenge) {
    return (
      <div className="bg-indigo-50 rounded-2xl shadow-sm border border-indigo-200 p-5">
        <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wide mb-2">Security challenge</p>
        <div className="flex items-center gap-3">
          <span className="text-3xl">{challenge.icon}</span>
          <p className="text-sm text-indigo-800 font-semibold">{challenge.text}</p>
        </div>
        <p className="text-xs text-indigo-400 mt-2">Perform the action to prove you're live</p>
      </div>
    )
  }

  if (challengeState === 'fail' || challengeState === 'timeout') {
    return (
      <div className="bg-red-50 rounded-2xl shadow-sm border border-red-200 p-5">
        <div className="py-3 flex flex-col items-center gap-1.5">
          <p className="text-sm text-red-600 font-semibold text-center">
            {challengeState === 'timeout' ? 'Challenge timed out' : 'Challenge failed'}
          </p>
          <p className="text-xs text-red-400 text-center">Retrying in 3s…</p>
        </div>
      </div>
    )
  }

  if (livenessState === 'collecting') {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-indigo-100 p-5">
        <div className="py-4 flex flex-col items-center gap-2">
          <Spinner size={5} />
          <p className="text-sm text-indigo-600 font-medium text-center">Collecting frames… hold still</p>
        </div>
      </div>
    )
  }

  if (livenessState === 'checking') {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-indigo-100 p-5">
        <div className="py-4 flex flex-col items-center gap-2">
          <Spinner size={5} />
          <p className="text-sm text-indigo-600 font-medium text-center">Verifying liveness…</p>
        </div>
      </div>
    )
  }

  if (livenessState === 'fail') {
    const reasonText = livenessMsg || {
      static_image:        'Static image or photo detected',
      no_face_detected:    'Face not clearly visible',
      challenge_fail:      'Challenge not completed',
      replay_attack:       'Replay attack detected',
    }[livenessReason] || 'Liveness check failed'
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

// ── Punch action bar ──────────────────────────────────────────────────────────

function CameraActions({ detected, status, punching, done, isLive, livenessState, challengeState, onPunch }) {
  if (done) {
    return <p className="text-center text-sm text-blue-600 py-1 font-medium">Recorded! Restarting scan…</p>
  }
  if (!detected) {
    return <p className="text-center text-sm text-gray-400 py-1">Position your face in front of the camera</p>
  }
  if (challengeState === 'active') {
    return (
      <p className="text-center text-sm text-indigo-500 py-1 flex items-center justify-center gap-2">
        <Spinner /> Complete the on-screen challenge…
      </p>
    )
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
    return <p className="text-center text-sm text-red-500 py-1">⚠️ Spoof attempt detected — retrying…</p>
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
      {!isLive && livenessState === 'pass' && (
        <p className="text-xs text-red-600 text-center bg-red-50 border border-red-100 py-1.5 rounded-lg font-medium">
          ⚠ Spoofing attempt detected (image/video not allowed)
        </p>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function KioskPage() {
  const videoRef      = useRef(null)
  const canvasRef     = useRef(null)
  const livenessRef   = useRef(null)
  const scanTimerRef  = useRef(null)
  const liveTimerRef  = useRef(null)
  const sessionTimerRef = useRef(null)
  const challengeTimerRef = useRef(null)
  const streamRef     = useRef(null)
  const prevPixelsRef = useRef(null)
  const lowCountRef   = useRef(0)
  const challengeMaxDiffRef = useRef(0)  // peak pixel-diff seen during challenge window

  // Circular-ref breakers
  const startScanRef   = useRef(null)
  const runLivenessRef = useRef(null)

  // ── State ────────────────────────────────────────────────────────────────────
  const [scanning,       setScanning]       = useState(false)
  const [detected,       setDetected]       = useState(null)
  const [status,         setStatus]         = useState(null)
  const [punching,       setPunching]       = useState(false)
  const [popup,          setPopup]          = useState(null)
  const [hint,           setHint]           = useState('')
  const [done,           setDone]           = useState(false)
  const [camError,       setCamError]       = useState('')

  // Layer-1 pixel-diff liveness
  const [isLive,         setIsLive]         = useState(true)

  // Layer-2 backend liveness
  const [livenessState,  setLivenessState]  = useState('idle')  // idle|collecting|checking|pass|fail
  const [livenessReason, setLivenessReason] = useState('')
  const [livenessMsg,    setLivenessMsg]    = useState('')

  // Challenge
  const [challenge,       setChallenge]      = useState(null)
  const [challengeState,  setChallengeState] = useState('idle')  // idle|active|pass|fail|timeout
  const [challengeSecs,   setChallengeSecs]  = useState(CHALLENGE_TIMEOUT_S)

  // Session timeout
  const [sessionSecs, setSessionSecs] = useState(null)

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const capture = useCallback(() => {
    const v = videoRef.current, c = canvasRef.current
    if (!v || !c || !v.videoWidth) return null
    c.width = v.videoWidth; c.height = v.videoHeight
    c.getContext('2d').drawImage(v, 0, 0)
    return c.toDataURL('image/jpeg', 0.75)
  }, [])

  // Layer-1: pixel-diff liveness (runs every 500 ms).
  // Also powers challenge detection: if max diff during challenge window > CHALLENGE_THRESHOLD,
  // the user performed a visible face movement.
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

      // Track max diff for challenge detection
      if (mean > challengeMaxDiffRef.current) {
        challengeMaxDiffRef.current = mean
      }

      // Static-frame counter for layer-1
      if (mean < LIVENESS_THRESHOLD) {
        lowCountRef.current = Math.min(lowCountRef.current + 1, LIVENESS_FRAMES + 1)
      } else {
        lowCountRef.current = 0
      }
      setIsLive(lowCountRef.current < LIVENESS_FRAMES)
    }
    prevPixelsRef.current = new Uint8ClampedArray(curr)
  }, [])

  // ── Challenge runner ──────────────────────────────────────────────────────────

  const runChallenge = useCallback((onResult) => {
    const ch = randomChallenge()
    setChallenge(ch)
    setChallengeState('active')
    setChallengeSecs(CHALLENGE_TIMEOUT_S)
    challengeMaxDiffRef.current = 0

    let secsLeft = CHALLENGE_TIMEOUT_S
    const tick = setInterval(() => {
      secsLeft -= 1
      setChallengeSecs(secsLeft)

      // Check if user performed visible movement (challenge passed)
      if (challengeMaxDiffRef.current >= CHALLENGE_THRESHOLD) {
        clearInterval(tick)
        clearTimeout(challengeTimerRef.current)
        setChallengeState('pass')
        onResult(true, ch)
        return
      }

      if (secsLeft <= 0) {
        clearInterval(tick)
        setChallengeState('timeout')
        onResult(false, ch)
      }
    }, 1000)

    challengeTimerRef.current = tick
  }, [])

  // ── Layer-2 backend liveness ───────────────────────────────────────────────

  const runLiveness = useCallback(async (detectedEmp) => {
    // First run the challenge
    runChallenge(async (challengePassed, ch) => {
      if (!challengePassed) {
        // Challenge failed → restart scan in 3 s
        setTimeout(() => startScanRef.current?.(), 3000)
        return
      }

      // Challenge passed → collect frames for backend
      setLivenessState('collecting')
      const frames = []
      for (let i = 0; i < LV_FRAME_COUNT; i++) {
        const f = capture()
        if (f) frames.push(f)
        if (i < LV_FRAME_COUNT - 1) await new Promise(r => setTimeout(r, LV_FRAME_GAP_MS))
      }

      setLivenessState('checking')
      try {
        const result = await kioskApi.verifyLiveness(
          frames,
          ch,
          challengePassed,
          detectedEmp?.employee_db_id,
        )
        if (result.is_live) {
          setLivenessState('pass')
          setLivenessMsg(result.message || '')
        } else {
          setLivenessState('fail')
          setLivenessReason(result.reason || 'static_image')
          setLivenessMsg(result.message || '')
          setTimeout(() => startScanRef.current?.(), 3000)
        }
      } catch {
        // Network/backend error → fail open so real employees aren't locked out
        setLivenessState('pass')
      }
    })
  }, [capture, runChallenge])

  useEffect(() => { runLivenessRef.current = runLiveness }, [runLiveness])

  // ── Session timeout ───────────────────────────────────────────────────────────

  const startSessionTimer = useCallback(() => {
    clearInterval(sessionTimerRef.current)
    let secs = SESSION_TIMEOUT_S
    setSessionSecs(secs)
    sessionTimerRef.current = setInterval(() => {
      secs -= 1
      setSessionSecs(secs)
      if (secs <= 0) {
        clearInterval(sessionTimerRef.current)
        setSessionSecs(null)
        setHint('Session timed out — restarting…')
        setTimeout(() => startScanRef.current?.(), 1500)
      }
    }, 1000)
  }, [])

  // ── Main scan loop ────────────────────────────────────────────────────────────

  const startScan = useCallback(() => {
    clearInterval(scanTimerRef.current)
    clearInterval(challengeTimerRef.current)
    clearInterval(sessionTimerRef.current)

    // Reset all state
    lowCountRef.current = 0
    prevPixelsRef.current = null
    challengeMaxDiffRef.current = 0
    setIsLive(true)
    setLivenessState('idle')
    setLivenessReason('')
    setLivenessMsg('')
    setChallenge(null)
    setChallengeState('idle')
    setChallengeSecs(CHALLENGE_TIMEOUT_S)
    setDetected(null)
    setStatus(null)
    setDone(false)
    setHint('Looking for a face…')
    setScanning(true)
    setSessionSecs(SESSION_TIMEOUT_S)

    startSessionTimer()

    scanTimerRef.current = setInterval(async () => {
      const frame = capture()
      if (!frame) return
      try {
        const data = await kioskApi.identify(frame)
        if (data.recognized) {
          clearInterval(scanTimerRef.current)
          clearInterval(sessionTimerRef.current)
          setSessionSecs(null)
          setScanning(false)
          setDetected(data)
          setHint('')
          setStatus(await kioskApi.status(data.employee_db_id))
          runLivenessRef.current?.(data)
        } else {
          setHint(data.message || 'No face detected')
        }
      } catch {
        setHint('Recognition error, retrying…')
      }
    }, SCAN_INTERVAL)
  }, [capture, startSessionTimer])

  useEffect(() => { startScanRef.current = startScan }, [startScan])

  // ── Camera init ───────────────────────────────────────────────────────────────

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
      .catch(() => {
        if (!cancelled) setCamError('Camera permission denied. Please allow camera access and reload.')
      })

    return () => {
      cancelled = true
      clearInterval(scanTimerRef.current)
      clearInterval(liveTimerRef.current)
      clearInterval(sessionTimerRef.current)
      clearInterval(challengeTimerRef.current)
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    }
  }, [checkLiveness, startScan])

  // ── Punch ─────────────────────────────────────────────────────────────────────

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
        setHint(data.message || 'Punch failed')
        setTimeout(() => startScanRef.current?.(), 2500)
      }
    } catch {
      setHint('Punch failed, please try again')
      setTimeout(() => startScanRef.current?.(), 2500)
    } finally {
      setPunching(false)
    }
  }, [detected, punching, isLive, livenessState])

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`@keyframes popIn { from { opacity:0; transform:scale(0.7) } to { opacity:1; transform:scale(1) } }`}</style>

      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-6 gap-6">
        <KioskHeader sessionLeft={sessionSecs} />

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
                  <LivenessBadge isLive={isLive} livenessState={livenessState} />

                  {/* Challenge overlay — shown when challenge is active */}
                  {detected && (
                    <ChallengeOverlay
                      challenge={challenge}
                      secondsLeft={challengeSecs}
                      challengeState={challengeState}
                    />
                  )}

                  <CameraHint
                    hint={hint}
                    detected={detected}
                    livenessState={livenessState}
                    isLive={isLive}
                    challengeState={challengeState}
                  />
                </>
              )}
            </div>

            {/* Punch buttons */}
            <div className="p-4">
              <CameraActions
                detected={detected}
                status={status}
                punching={punching}
                done={done}
                isLive={isLive}
                livenessState={livenessState}
                challengeState={challengeState}
                onPunch={punch}
              />
            </div>
          </div>

          {/* Right panel */}
          <div className="space-y-4">
            {detected && !done && livenessState === 'pass' && challengeState === 'pass'
              ? <EmployeeCard detected={detected} status={status} />
              : <StatusCard
                  hint={hint}
                  done={done}
                  livenessState={livenessState}
                  livenessReason={livenessReason}
                  livenessMsg={livenessMsg}
                  challengeState={challengeState}
                  challenge={challenge}
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
