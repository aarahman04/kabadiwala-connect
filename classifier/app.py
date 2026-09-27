"""
Classifier HTTP service.

    uvicorn app:app --host 0.0.0.0 --port 8000

POST /api/classify   multipart/form-data, field "image" (JPEG/PNG/WebP)
GET  /api/health     model status

The model loads once at startup (lifespan). Inference is CPU/GPU-bound, so
it runs in a worker thread and a lock keeps one inference at a time, which
avoids memory spikes on small instances.
"""

import asyncio
import logging
import os
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

import classifier_service as svc

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("classifier.api")

_infer_lock = threading.Lock()
_load_error: str | None = None


@asynccontextmanager
async def lifespan(_: FastAPI):
    global _load_error
    try:
        await asyncio.to_thread(svc.get_classifier)
    except Exception as exc:  # keep the server up so /health can report it
        _load_error = f"{type(exc).__name__}: {exc}"
        log.exception("model failed to load")
    yield


app = FastAPI(title="Kabadiwala Connect classifier", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGIN", "*").split(","),
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    clf = svc._classifier  # noqa: SLF001 - status only
    return {
        "ok": svc.is_loaded(),
        "model": svc.MODEL_NAME,
        "device": str(getattr(clf, "device", None)),
        "dtype": str(getattr(clf, "dtype", None)),
        "classes": svc.CLASSES,
        "confidence_threshold": svc.CONFIDENCE_THRESHOLD,
        "margin_threshold": svc.MARGIN_THRESHOLD,
        "error": _load_error,
    }


@app.post("/api/classify")
async def classify(image: UploadFile = File(...)):
    if not svc.is_loaded():
        raise HTTPException(503, detail=_load_error or "model is still loading")
    data = await image.read(svc.MAX_IMAGE_BYTES + 1)
    try:
        pil = svc.load_image(data)
    except svc.InvalidImageError as exc:
        raise HTTPException(415 if "format" in str(exc) else 400, detail=str(exc)) from exc

    def run():
        with _infer_lock:
            return svc.classify_image(pil)

    try:
        return await asyncio.to_thread(run)
    except Exception as exc:
        log.exception("inference failed")
        raise HTTPException(500, detail="classification failed") from exc
