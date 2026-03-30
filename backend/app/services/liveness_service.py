"""
Liveness detection using MediaPipe Face Mesh.

Spoofing signals across a short burst of frames:
  1. EAR variance     — real eyes have micro-movement; a photo has zero variance.
  2. Nose-tip movement— natural head micro-motion; absent on flat printed/screen images.
  3. EAR plausibility — real open eyes sit in [0.15, 0.45]; photos often fall outside.

Weights: EAR_var=0.4  nose_var=0.4  EAR_plausible=0.2
Threshold: confidence ≥ 0.35 → is_live=True
"""
from __future__ import annotations

import logging
from typing import Optional

import numpy as np

logger = logging.getLogger(__name__)

# ── MediaPipe availability guard ─────────────────────────────────────────────
try:
    import mediapipe as mp
    _mp_face_mesh = mp.solutions.face_mesh
    MEDIAPIPE_AVAILABLE = True
except Exception as _err:
    logger.warning("mediapipe unavailable — liveness will fail-open: %s", _err)
    MEDIAPIPE_AVAILABLE = False

# ── MediaPipe Face Mesh landmark indices (468-point canonical model) ──────────
# Each eye: 4 vertical pairs (top[i] ↔ bottom[i]) + 2 horizontal corners.
LEFT_EYE_TOP    = [386, 387, 388, 385]
LEFT_EYE_BOTTOM = [374, 373, 380, 381]
LEFT_EYE_CORNER = [362, 263]            # inner, outer

RIGHT_EYE_TOP    = [159, 160, 161, 158]
RIGHT_EYE_BOTTOM = [145, 144, 153, 154]
RIGHT_EYE_CORNER = [33, 133]            # inner, outer

NOSE_TIP = 4

CONFIDENCE_THRESHOLD = 0.35
EAR_VAR_CAP  = 1e-4   # normalize raw EAR variance into [0, 1]
NOSE_VAR_CAP = 2.0    # normalize nose displacement variance (pixels²) into [0, 1]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _ear(top: np.ndarray, bottom: np.ndarray, corners: np.ndarray) -> float:
    """
    Eye Aspect Ratio = mean vertical distance across 4 pairs
                       ────────────────────────────────────────
                       horizontal corner distance

    Using 4 pairs (vs. the classic 2-pair Soukupova formula) gives a
    smoother signal and is more robust to slight head rotations.
    """
    vertical   = float(np.mean(np.linalg.norm(top - bottom, axis=1)))
    horizontal = float(np.linalg.norm(corners[0] - corners[1])) + 1e-6
    return vertical / horizontal


def _landmarks_to_px(result, w: int, h: int) -> Optional[np.ndarray]:
    """Return (468, 2) pixel-space array or None when no face is detected."""
    if not result.multi_face_landmarks:
        return None
    lm = result.multi_face_landmarks[0].landmark
    return np.array([[p.x * w, p.y * h] for p in lm], dtype=np.float32)


# ── Public API ────────────────────────────────────────────────────────────────

def check_liveness(frames: list[np.ndarray]) -> dict:
    """
    Analyse a burst of BGR frames and return a liveness verdict.

    Parameters
    ----------
    frames : list[np.ndarray]
        BGR images (as returned by cv2.imdecode).  Requires ≥ 3 frames.

    Returns
    -------
    dict
        is_live    : bool
        confidence : float  (0.0 – 1.0)
        reason     : "live" | "static_image" |
                     "insufficient_frames" | "no_face_detected"
    """
    if not MEDIAPIPE_AVAILABLE:
        logger.warning("check_liveness: mediapipe not available, failing open")
        return {"is_live": True, "confidence": 0.5, "reason": "live"}

    if len(frames) < 3:
        return {"is_live": False, "confidence": 0.0, "reason": "insufficient_frames"}

    ear_values:     list[float]      = []
    nose_positions: list[np.ndarray] = []
    detected_count = 0

    with _mp_face_mesh.FaceMesh(
        static_image_mode=True,       # each frame processed independently
        max_num_faces=1,
        refine_landmarks=True,        # sharper eye/iris corners for EAR
        min_detection_confidence=0.5,
    ) as mesh:
        for frame in frames:
            if frame is None:
                continue
            h, w = frame.shape[:2]
            rgb    = frame[:, :, ::-1].copy()   # BGR → RGB without cv2 dependency
            result = mesh.process(rgb)
            pts    = _landmarks_to_px(result, w, h)
            if pts is None:
                continue

            detected_count += 1

            l_ear = _ear(pts[LEFT_EYE_TOP],  pts[LEFT_EYE_BOTTOM],  pts[LEFT_EYE_CORNER])
            r_ear = _ear(pts[RIGHT_EYE_TOP], pts[RIGHT_EYE_BOTTOM], pts[RIGHT_EYE_CORNER])
            ear_values.append((l_ear + r_ear) / 2.0)
            nose_positions.append(pts[NOSE_TIP])

    if detected_count < 3:
        return {"is_live": False, "confidence": 0.0, "reason": "no_face_detected"}

    ear_arr  = np.array(ear_values,    dtype=np.float64)
    nose_arr = np.array(nose_positions, dtype=np.float64)   # (N, 2)

    # ── Score 1: EAR variance (weight 0.4) ───────────────────────────────────
    # Real eyes blink and micro-move; photo eyes are perfectly static (var ≈ 0).
    score_ear_var = float(min(np.var(ear_arr) / EAR_VAR_CAP, 1.0))

    # ── Score 2: Nose-tip movement (weight 0.4) ───────────────────────────────
    # Real heads have natural micro-tremor; flat images have zero movement.
    nose_mean          = nose_arr.mean(axis=0)
    nose_displacements = np.linalg.norm(nose_arr - nose_mean, axis=1)
    score_nose_var     = float(min(np.var(nose_displacements) / NOSE_VAR_CAP, 1.0))

    # ── Score 3: EAR plausibility (weight 0.2) ────────────────────────────────
    # A real open-eyed person at a kiosk sits in [0.15, 0.45].
    # Compressed/distorted photo eyes often fall outside this range.
    mean_ear      = float(ear_arr.mean())
    ear_plausible = 1.0 if 0.15 <= mean_ear <= 0.45 else 0.0

    confidence = float(np.clip(
        0.4 * score_ear_var + 0.4 * score_nose_var + 0.2 * ear_plausible,
        0.0, 1.0,
    ))

    is_live = confidence >= CONFIDENCE_THRESHOLD
    reason  = "live" if is_live else "static_image"

    logger.debug(
        "liveness: n=%d ear_var=%.6f nose_var=%.6f mean_ear=%.3f "
        "s_ear=%.3f s_nose=%.3f s_plaus=%.1f → conf=%.3f live=%s",
        detected_count, np.var(ear_arr), np.var(nose_displacements), mean_ear,
        score_ear_var, score_nose_var, ear_plausible, confidence, is_live,
    )

    return {"is_live": is_live, "confidence": round(confidence, 4), "reason": reason}
