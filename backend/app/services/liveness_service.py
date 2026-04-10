"""
Liveness detection using MediaPipe Face Mesh.

Four-factor anti-spoofing score across a short burst of frames:

  1. EAR variance      (0.35) — real eyes micro-move/blink; photos have zero variance.
  2. Nose-tip movement (0.35) — natural head micro-tremor; absent on flat images/screens.
  3. EAR plausibility  (0.15) — open eyes sit in [0.15, 0.45]; distorted photos often fall outside.
  4. Texture richness  (0.15) — Laplacian variance of the face crop; screens/prints are
                                  spatially smoother than a real 3-D face captured live.

Threshold: confidence ≥ 0.32 → is_live = True
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

# ── Face Mesh landmark indices (468-point canonical model) ────────────────────
# 4 vertical pairs per eye (more robust than the classic Soukupova 2-pair formula).
LEFT_EYE_TOP    = [386, 387, 388, 385]
LEFT_EYE_BOTTOM = [374, 373, 380, 381]
LEFT_EYE_CORNER = [362, 263]

RIGHT_EYE_TOP    = [159, 160, 161, 158]
RIGHT_EYE_BOTTOM = [145, 144, 153, 154]
RIGHT_EYE_CORNER = [33, 133]

NOSE_TIP = 4

# Approximate face bounding-box landmarks (used for texture crop).
FACE_OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323,
             361, 288, 397, 365, 379, 378, 400, 377, 152, 148,
             176, 149, 150, 136, 172, 58,  132, 93,  234, 127,
             162, 21,  54,  103, 67,  109]

# ── Tuning constants ──────────────────────────────────────────────────────────
CONFIDENCE_THRESHOLD = 0.32     # lowered slightly vs old 0.35 because we now have 4 factors
EAR_VAR_CAP          = 1e-4     # normalise EAR variance → [0, 1]
NOSE_VAR_CAP         = 2.0      # normalise nose displacement variance → [0, 1]
TEXTURE_CAP          = 150.0    # Laplacian variance cap; real faces ≈ 100-800, screens ≈ 10-100


# ── Helpers ───────────────────────────────────────────────────────────────────

def _ear(top: np.ndarray, bottom: np.ndarray, corners: np.ndarray) -> float:
    """Eye Aspect Ratio across 4 vertical landmark pairs."""
    vertical   = float(np.mean(np.linalg.norm(top - bottom, axis=1)))
    horizontal = float(np.linalg.norm(corners[0] - corners[1])) + 1e-6
    return vertical / horizontal


def _landmarks_to_px(result, w: int, h: int) -> Optional[np.ndarray]:
    """Return (468, 2) pixel array or None when no face detected."""
    if not result.multi_face_landmarks:
        return None
    lm = result.multi_face_landmarks[0].landmark
    return np.array([[p.x * w, p.y * h] for p in lm], dtype=np.float32)


def _face_crop_gray(frame: np.ndarray, pts: np.ndarray) -> np.ndarray:
    """
    Return a grayscale crop of the face bounding box.
    Used for texture (Laplacian variance) analysis.
    """
    h, w = frame.shape[:2]
    xs = pts[FACE_OVAL, 0]
    ys = pts[FACE_OVAL, 1]
    x1, x2 = int(max(xs.min() - 5, 0)), int(min(xs.max() + 5, w))
    y1, y2 = int(max(ys.min() - 5, 0)), int(min(ys.max() + 5, h))
    crop = frame[y1:y2, x1:x2]
    if crop.size == 0:
        return np.zeros((1, 1), dtype=np.float32)
    # BGR → grayscale via luminance weights
    gray = (0.114 * crop[:, :, 0] +
            0.587 * crop[:, :, 1] +
            0.299 * crop[:, :, 2]).astype(np.float32)
    return gray


def _laplacian_variance(gray: np.ndarray) -> float:
    """
    Variance of the discrete Laplacian (edge energy).
    Real faces captured live have higher variance than flat printed/screen images
    photographed by another camera.
    """
    if gray.shape[0] < 3 or gray.shape[1] < 3:
        return 0.0
    lap = (
        -4.0 * gray[1:-1, 1:-1]
        +      gray[:-2,  1:-1]
        +      gray[2:,   1:-1]
        +      gray[1:-1, :-2]
        +      gray[1:-1, 2:]
    )
    return float(np.var(lap))


# ── Public API ────────────────────────────────────────────────────────────────

def check_liveness(frames: list[np.ndarray]) -> dict:
    """
    Analyse a burst of BGR frames and return a liveness verdict.

    Parameters
    ----------
    frames : list[np.ndarray]
        BGR images (cv2.imdecode output).  Requires ≥ 3 frames.

    Returns
    -------
    dict
        is_live    : bool
        confidence : float  (0.0 – 1.0)
        reason     : "live" | "static_image" | "insufficient_frames" | "no_face_detected"
        scores     : dict   (individual factor scores for debugging)
    """
    if not MEDIAPIPE_AVAILABLE:
        logger.warning("check_liveness: mediapipe not available, failing open")
        return {"is_live": True, "confidence": 0.5, "reason": "live", "scores": {}}

    if len(frames) < 3:
        return {"is_live": False, "confidence": 0.0,
                "reason": "insufficient_frames", "scores": {}}

    ear_values:      list[float]      = []
    nose_positions:  list[np.ndarray] = []
    texture_values:  list[float]      = []
    detected_count = 0

    with _mp_face_mesh.FaceMesh(
        static_image_mode=True,
        max_num_faces=1,
        refine_landmarks=True,
        min_detection_confidence=0.5,
    ) as mesh:
        for frame in frames:
            if frame is None:
                continue
            h, w = frame.shape[:2]
            rgb    = frame[:, :, ::-1].copy()
            result = mesh.process(rgb)
            pts    = _landmarks_to_px(result, w, h)
            if pts is None:
                continue

            detected_count += 1

            l_ear = _ear(pts[LEFT_EYE_TOP],  pts[LEFT_EYE_BOTTOM],  pts[LEFT_EYE_CORNER])
            r_ear = _ear(pts[RIGHT_EYE_TOP], pts[RIGHT_EYE_BOTTOM], pts[RIGHT_EYE_CORNER])
            ear_values.append((l_ear + r_ear) / 2.0)
            nose_positions.append(pts[NOSE_TIP])

            # Factor 4: texture of the face crop
            gray = _face_crop_gray(frame, pts)
            texture_values.append(_laplacian_variance(gray))

    if detected_count < 3:
        return {"is_live": False, "confidence": 0.0,
                "reason": "no_face_detected", "scores": {}}

    ear_arr     = np.array(ear_values,     dtype=np.float64)
    nose_arr    = np.array(nose_positions, dtype=np.float64)
    texture_arr = np.array(texture_values, dtype=np.float64)

    # ── Factor 1: EAR variance (weight 0.35) ─────────────────────────────────
    score_ear_var = float(min(np.var(ear_arr) / EAR_VAR_CAP, 1.0))

    # ── Factor 2: Nose-tip movement (weight 0.35) ─────────────────────────────
    nose_mean          = nose_arr.mean(axis=0)
    nose_displacements = np.linalg.norm(nose_arr - nose_mean, axis=1)
    score_nose_var     = float(min(np.var(nose_displacements) / NOSE_VAR_CAP, 1.0))

    # ── Factor 3: EAR plausibility (weight 0.15) ──────────────────────────────
    mean_ear      = float(ear_arr.mean())
    ear_plausible = 1.0 if 0.15 <= mean_ear <= 0.45 else 0.0

    # ── Factor 4: Texture richness (weight 0.15) ──────────────────────────────
    # Screens and prints photographed through a webcam lens have lower Laplacian
    # variance than a real 3-D face captured in the same scenario.
    mean_texture   = float(texture_arr.mean())
    score_texture  = float(min(mean_texture / TEXTURE_CAP, 1.0))

    confidence = float(np.clip(
        0.35 * score_ear_var
        + 0.35 * score_nose_var
        + 0.15 * ear_plausible
        + 0.15 * score_texture,
        0.0, 1.0,
    ))

    is_live = confidence >= CONFIDENCE_THRESHOLD
    reason  = "live" if is_live else "static_image"

    scores = {
        "ear_variance":   round(score_ear_var,  4),
        "nose_movement":  round(score_nose_var, 4),
        "ear_plausible":  ear_plausible,
        "texture":        round(score_texture,  4),
        "mean_ear":       round(mean_ear,        3),
        "mean_texture":   round(mean_texture,    1),
        "n_detected":     detected_count,
    }

    logger.debug(
        "liveness: n=%d ear_var=%.4f nose_var=%.4f plaus=%.1f tex=%.4f → conf=%.3f live=%s",
        detected_count, score_ear_var, score_nose_var, ear_plausible, score_texture,
        confidence, is_live,
    )

    return {
        "is_live":    is_live,
        "confidence": round(confidence, 4),
        "reason":     reason,
        "scores":     scores,
    }
