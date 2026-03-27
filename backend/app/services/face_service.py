from __future__ import annotations
import base64, logging
from typing import Optional, Union
import cv2, face_recognition, numpy as np
logger = logging.getLogger(__name__)

def encode_face_from_path(image_path: str) -> Optional[bytes]:
    try:
        img = face_recognition.load_image_file(image_path)
        encs = face_recognition.face_encodings(img, model="large", num_jitters=3)
        if not encs: return None
        return encs[0].tobytes()
    except Exception as e:
        logger.error("encode_face_from_path: %s", e); return None

def decode_frame(b64: str) -> Optional[np.ndarray]:
    try:
        if "," in b64: b64 = b64.split(",", 1)[1]
        arr = np.frombuffer(base64.b64decode(b64), dtype=np.uint8)
        return cv2.imdecode(arr, cv2.IMREAD_COLOR)
    except Exception as e:
        logger.error("decode_frame: %s", e); return None

def recognize_face(frame: np.ndarray, known: list, tolerance: float = 0.5) -> Union[int, str, None]:
    if frame is None or not known: return "no_face"
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    small = cv2.resize(rgb, (0, 0), fx=0.5, fy=0.5)
    locs = face_recognition.face_locations(small, model="hog")
    if len(locs) == 0: return "no_face"
    if len(locs) > 1: return "multiple"
    t, r, b, l = locs[0]
    full_locs = [(t*2, r*2, b*2, l*2)]
    encs = face_recognition.face_encodings(rgb, known_face_locations=full_locs, model="large", num_jitters=1)
    if not encs: return "no_face"
    dists = face_recognition.face_distance(known, encs[0])
    best = int(np.argmin(dists))
    return best if dists[best] <= tolerance else None
