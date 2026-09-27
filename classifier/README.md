# E-waste photo classifier

This is a zero-shot image classifier built on **Google SigLIP 2** (`google/siglip2-base-patch16-224`), running on Hugging Face Transformers and PyTorch. It's a small FastAPI service, deployed separately from the Node backend.

- It sorts a photo into `CRT`, `LCD`, `PCB`, `Cables`, `Batteries`, `Motors/Magnets`, `Mixed Plastic` or `Other`.
- `Other` also covers "not recognised" and "not e-waste".
- **Not trained or fine-tuned.** It compares the photo against text descriptions of each class (`CLASS_PROMPTS` in `classifier_service.py`).
- **No accuracy figure is claimed.** It hasn't been evaluated on a labelled e-waste test set yet. See "Evaluating" below.

## How it fits

```
PWA (NewLot photo step) ──POST /api/classify──► Node backend (backend/) ──proxy──► this service ──► SigLIP 2
        ▲  suggestion; collector confirms or picks manually                       (CLASSIFIER_URL)
```

- The app **never depends on it.** When offline, when there's no backend, or on any error, the collector picks the category from the icon grid as before.
- A confident answer pre-selects the category and shows a "Yes, that is right" button.
- `uncertain` or `Other` shows "choose below".
- Each lot stores the model's suggestion (`aiSuggestion`) next to the category the collector chose. That pair is the start of a labelled dataset. See `database/13_useful_queries.sql`, query 11c.

## Files

| File | What |
|---|---|
| `classifier_service.py` | **All model-specific logic.** Class prompts, loading (once), device/dtype, cached text embeddings, prompt aggregation, the confidence and margin rules, and image validation. Public API: `classify_image(image) -> dict` |
| `app.py` | FastAPI: `POST /api/classify` (multipart, field `image`), `GET /api/health`. Loads the model at startup |
| `test_classifier.py` | CLI: `python test_classifier.py img1.jpg [img2.png …]` |
| `requirements.txt` | CPU PyTorch wheels by default |
| `railway.json`, `.python-version` | Railway deploy (Root Directory = `classifier`) |

## Result format

```json
{ "class": "PCB", "confidence": 0.82, "uncertain": false, "best_guess": "PCB",
  "scores": { "CRT": 0.03, "LCD": 0.02, "PCB": 0.82, "...": 0.0 }, "model": "google/siglip2-base-patch16-224" }
```

How the scores are built:

- **Per prompt:** each prompt gets a SigLIP logit, computed as `cos(image, text) · exp(logit_scale) + logit_bias`.
- **Per class:** the prompt logits are **averaged** (`CLASSIFIER_PROMPT_AGGREGATION=max` to take the maximum instead).
- **Normalised:** softmax across the 8 classes, so the scores sum to 1.
- **Uncertainty rule:** the answer becomes `"class": "Other", "uncertain": true` if either
  - the top score is below `CONFIDENCE_THRESHOLD` (0.35), or
  - the top two scores are closer than `MARGIN_THRESHOLD` (0.05).

  `best_guess` keeps what the model leaned towards.
- **Confident "Other"** comes back as `uncertain: false`: the model thinks it isn't one of the seven materials.

## Configuration (env vars)

| Var | Default | |
|---|---|---|
| `CLASSIFIER_MODEL` | `google/siglip2-base-patch16-224` | any SigLIP/SigLIP 2 checkpoint |
| `CLASSIFIER_CONFIDENCE_THRESHOLD` | `0.35` | raise it if it guesses wrong too often |
| `CLASSIFIER_MARGIN_THRESHOLD` | `0.05` | top-1 minus top-2 |
| `CLASSIFIER_PROMPT_AGGREGATION` | `mean` | or `max` |
| `CLASSIFIER_DEVICE` | `auto` | `auto` uses CUDA if available, else CPU |
| `CLASSIFIER_DTYPE` | `float32` | `bfloat16` halves memory (about 0.8 GB instead of 1.5 GB) |
| `CLASSIFIER_MAX_IMAGE_BYTES` | 10 MB | |
| `CORS_ORIGIN` | `*` | |

## Run and test locally

```bash
cd classifier
python -m venv .venv && . .venv/Scripts/activate     # optional; Windows Git Bash path
pip install -r requirements.txt
python test_classifier.py some-photo.jpg               # first run downloads the 1.5 GB model
uvicorn app:app --port 8000
curl -F "image=@some-photo.jpg" http://localhost:8000/api/classify
```

To use it through the app, start the Node backend with `CLASSIFIER_URL=http://localhost:8000 npm run dev:backend` from the repo root. Then build the PWA with `VITE_API_URL` pointing at that backend.

## Deploy (Railway)

1. Add a new service from the same repo, with **Root Directory = `classifier`**. Railpack installs `requirements.txt` and starts uvicorn (`railway.json`).
2. It needs roughly **2 GB of RAM** with float32, or about 1 GB with `CLASSIFIER_DTYPE=bfloat16`.
3. The first boot downloads the model (1.5 GB), so give the health check time. `healthcheckTimeout` is 600 s.
4. Generate a domain. On the **backend** service, set `CLASSIFIER_URL=https://<classifier-domain>`.

## Replacing the model later

Write a class with `classify(image: PIL.Image) -> dict` that returns the same keys, and select it in `_build_classifier()` (e.g. `CLASSIFIER_BACKEND=finetuned`). The API, the Node proxy and the PWA don't change as long as the class labels stay the same.

## Evaluating (before claiming any accuracy)

Collect labelled photos for each class, ideally real collector photos (the app is already storing collector-labelled lots). Run the classifier over them and report per-class precision and recall plus a confusion matrix. Tune the prompts and thresholds on a separate split from the one you report.
