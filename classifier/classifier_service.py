"""
E-waste material classifier.

Everything model-specific lives in this file. The rest of the system (the
FastAPI app, the Node proxy, the PWA) only ever sees:

    classify_image(image) -> {"class", "confidence", "uncertain", "best_guess", "scores", "model"}

with `class` one of CLASSES. To swap SigLIP 2 zero-shot for a fine-tuned model
later, implement another class with the same `classify(PIL.Image) -> dict`
contract and select it in `_build_classifier()` (e.g. via CLASSIFIER_BACKEND).

Current backend: google/siglip2-base-patch16-224, zero-shot. SigLIP scores an
image against text descriptions, so each class is described by several
prompts; prompt scores are averaged per class and normalised across classes.
"""

from __future__ import annotations

import io
import logging
import os
import threading
from typing import Protocol

import torch
from PIL import Image, UnidentifiedImageError

log = logging.getLogger("classifier")

# ---------------------------------------------------------------------------
# Configuration (all overridable via environment variables)
# ---------------------------------------------------------------------------

MODEL_NAME = os.getenv("CLASSIFIER_MODEL", "google/siglip2-base-patch16-224")
# Top class must reach this share of the normalised score, else -> "Other".
CONFIDENCE_THRESHOLD = float(os.getenv("CLASSIFIER_CONFIDENCE_THRESHOLD", "0.35"))
# If the top two classes are closer than this, the answer is not reliable.
MARGIN_THRESHOLD = float(os.getenv("CLASSIFIER_MARGIN_THRESHOLD", "0.05"))
# "mean" or "max" over a class's prompt variants.
PROMPT_AGGREGATION = os.getenv("CLASSIFIER_PROMPT_AGGREGATION", "mean")
# "auto" | "cuda" | "cpu"
DEVICE_SETTING = os.getenv("CLASSIFIER_DEVICE", "auto")
# "float32" (default) or "bfloat16" / "float16" to halve memory.
DTYPE_SETTING = os.getenv("CLASSIFIER_DTYPE", "float32")
MAX_IMAGE_BYTES = int(os.getenv("CLASSIFIER_MAX_IMAGE_BYTES", str(10 * 1024 * 1024)))

ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}

# Application-level classes, in the order scores are reported.
CLASSES = ["CRT", "LCD", "PCB", "Cables", "Batteries", "Motors/Magnets", "Mixed Plastic", "Other"]

# SigLIP 2 was trained on lower-cased text; keep prompts lower case.
CLASS_PROMPTS: dict[str, list[str]] = {
    "CRT": [
        "a cathode ray tube crt television or monitor",
        "an old bulky crt computer monitor",
        "a cathode ray tube display with a large glass tube",
    ],
    "LCD": [
        "an lcd flat panel display",
        "a flat screen lcd monitor or television",
        "an lcd display panel from electronic waste",
    ],
    "PCB": [
        "a printed circuit board pcb",
        "an electronic circuit board with chips and components",
        "a green printed circuit board from electronic equipment",
    ],
    "Cables": [
        "electrical wires and cables",
        "a bundle of insulated electrical cables",
        "electronic wires connectors and cables",
    ],
    "Batteries": [
        "an electronic battery",
        "a lithium ion battery or rechargeable battery",
        "discarded batteries from electronic equipment",
    ],
    "Motors/Magnets": [
        "an electric motor or permanent magnet",
        "an electric motor from electronic equipment",
        "a motor rotor stator or magnetic electronic component",
    ],
    "Mixed Plastic": [
        "mixed plastic parts from electronic waste",
        "plastic housings and plastic electronic components",
        "discarded plastic casing from electronic equipment",
    ],
    "Other": [
        "other miscellaneous electronic waste",
        "an electronic component that is not a circuit board battery cable display motor or plastic",
        "miscellaneous electronic waste",
    ],
}


class InvalidImageError(ValueError):
    """The upload is not a readable JPEG / PNG / WebP image."""


# ---------------------------------------------------------------------------
# Image handling
# ---------------------------------------------------------------------------


def load_image(data: bytes) -> Image.Image:
    """Validate raw upload bytes and return an RGB PIL image. Never lets PIL errors escape."""
    if not data:
        raise InvalidImageError("empty file")
    if len(data) > MAX_IMAGE_BYTES:
        raise InvalidImageError(f"image larger than {MAX_IMAGE_BYTES // (1024 * 1024)} MB")
    try:
        with Image.open(io.BytesIO(data)) as probe:
            fmt = probe.format
            probe.verify()  # catches truncated / corrupted files
        if fmt not in ALLOWED_FORMATS:
            raise InvalidImageError(f"unsupported format {fmt or 'unknown'}; use JPEG, PNG or WebP")
        # verify() leaves the image unusable, so reopen to decode.
        image = Image.open(io.BytesIO(data))
        image.load()
    except InvalidImageError:
        raise
    except UnidentifiedImageError as exc:
        raise InvalidImageError("not a valid image file") from exc
    except (OSError, SyntaxError, ValueError) as exc:  # truncated / corrupted data
        raise InvalidImageError(f"image is corrupted or incomplete ({exc})") from exc
    return image.convert("RGB")


def _to_rgb(image: Image.Image | bytes) -> Image.Image:
    if isinstance(image, (bytes, bytearray)):
        return load_image(bytes(image))
    if isinstance(image, Image.Image):
        return image.convert("RGB")
    raise InvalidImageError("expected image bytes or a PIL image")


# ---------------------------------------------------------------------------
# Classifier backends
# ---------------------------------------------------------------------------


class Classifier(Protocol):
    name: str

    def classify(self, image: Image.Image) -> dict: ...


def _pick_device() -> torch.device:
    if DEVICE_SETTING == "cuda" or (DEVICE_SETTING == "auto" and torch.cuda.is_available()):
        if not torch.cuda.is_available():
            log.warning("CLASSIFIER_DEVICE=cuda but CUDA is unavailable; falling back to CPU")
            return torch.device("cpu")
        return torch.device("cuda")
    return torch.device("cpu")


def _pick_dtype(device: torch.device) -> torch.dtype:
    dtype = {"float32": torch.float32, "bfloat16": torch.bfloat16, "float16": torch.float16}.get(DTYPE_SETTING)
    if dtype is None:
        raise ValueError(f"CLASSIFIER_DTYPE must be float32, bfloat16 or float16 (got {DTYPE_SETTING})")
    if dtype == torch.float16 and device.type == "cpu":
        log.warning("float16 is poorly supported on CPU; using bfloat16")
        return torch.bfloat16
    return dtype


def _as_embedding(out) -> torch.Tensor:
    # get_*_features returns a tensor in transformers 4.x and a model output in some 5.x paths.
    return out if isinstance(out, torch.Tensor) else out.pooler_output


class SigLIPZeroShotClassifier:
    """SigLIP 2 zero-shot over CLASS_PROMPTS. Text embeddings are computed once."""

    def __init__(self, model_name: str = MODEL_NAME):
        from transformers import AutoModel, AutoProcessor

        self.name = model_name
        self.device = _pick_device()
        self.dtype = _pick_dtype(self.device)
        log.info("loading %s on %s (%s)", model_name, self.device, self.dtype)
        self.processor = AutoProcessor.from_pretrained(model_name)
        self.model = AutoModel.from_pretrained(model_name, dtype=self.dtype).to(self.device).eval()

        # Flatten prompts, remembering which class each belongs to.
        self._prompt_class: list[int] = []
        prompts: list[str] = []
        for class_index, cls in enumerate(CLASSES):
            for prompt in CLASS_PROMPTS[cls]:
                prompts.append(prompt)
                self._prompt_class.append(class_index)
        self._prompt_class_t = torch.tensor(self._prompt_class, device=self.device)

        # SigLIP 2 expects text padded to max_length=64, as in training.
        text_inputs = self.processor(
            text=prompts, padding="max_length", max_length=64, truncation=True, return_tensors="pt"
        ).to(self.device)
        with torch.inference_mode():
            text_emb = _as_embedding(self.model.get_text_features(**text_inputs))
        self._text_emb = torch.nn.functional.normalize(text_emb.float(), dim=-1)  # cached
        self._logit_scale = self.model.logit_scale.exp().float()
        self._logit_bias = self.model.logit_bias.float()
        log.info("classifier ready: %d classes, %d prompts", len(CLASSES), len(prompts))

    def classify(self, image: Image.Image) -> dict:
        inputs = self.processor(images=image, return_tensors="pt").to(self.device)
        pixel_values = inputs["pixel_values"].to(self.dtype)
        with torch.inference_mode():
            img_emb = _as_embedding(self.model.get_image_features(pixel_values=pixel_values))
        img_emb = torch.nn.functional.normalize(img_emb.float(), dim=-1)

        # Same formula as SiglipModel.forward: one logit per (image, prompt).
        prompt_logits = (img_emb @ self._text_emb.T).squeeze(0) * self._logit_scale + self._logit_bias

        # One logit per application class, from its prompt variants.
        class_logits = torch.empty(len(CLASSES), device=prompt_logits.device)
        for i in range(len(CLASSES)):
            vals = prompt_logits[self._prompt_class_t == i]
            class_logits[i] = vals.max() if PROMPT_AGGREGATION == "max" else vals.mean()

        # Normalise across the 8 classes so scores sum to 1 and read as shares.
        probs = torch.softmax(class_logits, dim=0).cpu().tolist()
        scores = {cls: round(p, 4) for cls, p in zip(CLASSES, probs)}
        return _decide(scores, self.name)


def _decide(scores: dict[str, float], model_name: str) -> dict:
    """Pick the class, applying the confidence and top-2 margin rules."""
    ranked = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)
    (best, top), (_, second) = ranked[0], ranked[1]
    uncertain = best != "Other" and (top < CONFIDENCE_THRESHOLD or (top - second) < MARGIN_THRESHOLD)
    return {
        "class": "Other" if uncertain else best,
        "confidence": round(top, 4),
        "uncertain": uncertain,
        "best_guess": best,  # what the model leaned towards, even when uncertain
        "scores": scores,
        "model": model_name,
    }


# ---------------------------------------------------------------------------
# Module-level singleton: the model loads once per process.
# ---------------------------------------------------------------------------

_classifier: Classifier | None = None
_lock = threading.Lock()


def _build_classifier() -> Classifier:
    backend = os.getenv("CLASSIFIER_BACKEND", "siglip2-zero-shot")
    if backend == "siglip2-zero-shot":
        return SigLIPZeroShotClassifier(MODEL_NAME)
    # Future: elif backend == "finetuned": return FineTunedClassifier(path)
    raise ValueError(f"unknown CLASSIFIER_BACKEND {backend}")


def get_classifier() -> Classifier:
    global _classifier
    if _classifier is None:
        with _lock:
            if _classifier is None:
                _classifier = _build_classifier()
    return _classifier


def is_loaded() -> bool:
    return _classifier is not None


def classify_image(image: Image.Image | bytes) -> dict:
    """Classify one image (PIL image or raw JPEG/PNG/WebP bytes). Raises InvalidImageError."""
    return get_classifier().classify(_to_rgb(image))
