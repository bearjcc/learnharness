# Practice quiz engine (Choice)

LearnHarness builds daily multiple-choice cards for the **Choice** phone app. The server stores subjects and answer sources; local models (Ollama via provider `ollama`) write question wording only. Correct answers and distractors always come from **confirmed** entries you approved.

## Sandbox demo (`demo`)

Set `sandbox: true` on a subject to serve a fixed deck from the repo fixture with **no persistent grading**: answers return `correct` in the API response but do not update FSRS, answer logs, or the graph. Daily build skips sandbox subjects. `GET /api/practice/today?subject=<id>` returns the full deck every time.

The built-in `demo` subject is always available (see [fixtures/practice/demo](../fixtures/practice/demo)).

## Subjects

Configure in **Settings → Practice** or `PUT /api/practice/subjects`:

```json
{
  "subjectId": "latin",
  "title": "Latin in English",
  "enabled": true,
  "dailyCards": 10,
  "itemKinds": ["term-pick", "meaning-pick"]
}
```

`itemKinds` lists plugin ids (empty = all kinds that apply to each entry type).

Visual subjects can define **media variants** (e.g. country `outline` vs `locator`). Each image-pick or label-pick item picks one variant for that card; all four options (and the label-pick prompt image) use that same variant. The checker rejects mixed variants.

```json
{
  "subjectId": "geography",
  "title": "Countries",
  "enabled": true,
  "dailyCards": 10,
  "itemKinds": ["label-pick", "image-pick"],
  "mediaVariants": {
    "enabled": ["outline", "locator"],
    "weights": { "outline": 1, "locator": 1 },
    "distractorBias": "similar-size"
  }
}
```

Bulk country import (Natural Earth, no network at runtime):

```bash
curl -s -X POST http://127.0.0.1:3000/api/entries/import-geography \
  -H "Content-Type: application/json" \
  -d '{"subjectId":"geography"}'
```

See [samples/geography/README.md](../samples/geography/README.md) for attribution.

## Entries

Stored in `data/practice/entries.jsonl`. Status: `pending` → `confirmed` or `retired`. Only **confirmed** entries appear in quizzes.

Import: `POST /api/entries/import` with an array of rows. Wikimedia images:

```json
{
  "subjectId": "geography",
  "type": "visual",
  "front": "Ukraine",
  "back": "Country in eastern Europe",
  "commons": { "pageTitle": "File:Ukraine (orthographic projection).svg" }
}
```

Files are cached under `data/practice/media/`. Attribution is stored on the entry; Choice loads images via `/api/practice/media/:token` only.

## Item kinds

| Kind | Use |
|------|-----|
| `term-pick` | Front → pick one of four backs |
| `meaning-pick` | Back → pick one of four fronts |
| `fact-pick` | Fact question → four answers |
| `groove-id` | ABC drum notation (cached SVG) → name the groove |
| `image-pick` / `label-pick` | Four images or one image + four labels; all images in an item share one **media variant** (see below) |
| `image-pick` | Text label → pick one of four images |
| `label-pick` | Image → pick one of four labels |

## Daily build

`POST /api/practice/daily-build` optional body `{ "modelId": "your-ollama-model" }`.

Schedule on the host (example 06:15):

```bash
curl -s -X POST http://127.0.0.1:3000/api/practice/daily-build -H "Content-Type: application/json" -d '{}'
```

Optional GPU broker: set `LH_GPU_BROKER_URL` (e.g. `http://127.0.0.1:3880`). Daily build requests `POST /api/lease` with JSON `{ service, vramGb, … }`, heartbeats `POST /api/lease/<id>/heartbeat` while the build runs, and releases with `POST /api/lease/<id>/release`. Paths are overridable via `LH_GPU_BROKER_LEASE_PATH`, `LH_GPU_BROKER_HEARTBEAT_PATH`, `LH_GPU_BROKER_RELEASE_PATH` (`{id}` placeholder). If the broker is unreachable, the build runs against Ollama without a lease. A 503 from the **model** endpoint stops the run cleanly.

Set `LH_PRACTICE_SKIP_LLM=1` to build cards without calling the model (wording defaults).

## Choice API

| Route | Purpose |
|-------|---------|
| `GET /api/practice/today?subject=` | Today's cards (mixed ~5 per subject if subject omitted) |
| `GET /api/practice/media/:token` | Cached svg/png/jpg/webp/audio |
| `POST /api/practice/answers` | Record or undo an answer (idempotent `event_id`) |
| `GET /api/entries/pending?subject=` | Pending entries for keep/reject |
| `POST /api/entries/:id/decision` | `{ "event_id", "value": "keep" \| "reject" }` |
| `POST /api/entries/import` | Bulk import |
| `POST /api/practice/daily-build` | Build today's queues |
| `GET /api/practice/subjects` | List subjects |
| `PUT /api/practice/subjects` | Create/update subject |

## Local model options

Per manual Ollama model in settings (`localInference.manualModels[]`):

- `think` (boolean) — maps to Ollama `think` (default false when unset)
- `maxTokens` — `max_tokens`
- `format` — JSON schema for structured quiz wording

## Environment

| Variable | Purpose |
|----------|---------|
| `LH_DATA_DIR` | Data root (`practice/` underneath) |
| `LH_OLLAMA_BASE_URL` | Local model server |
| `LH_OLLAMA_API_KEY` | Optional |
| `LH_GPU_BROKER_URL` | Optional GPU lease broker base URL |
| `LH_GPU_BROKER_SERVICE` | Lease service name (default `learnharness`) |
| `LH_GPU_BROKER_CLASS` | Lease class (default `batch`) |
| `LH_GPU_BROKER_OWNER` | Lease owner (default `learnharness`) |
| `LH_GPU_BROKER_REASON` | Lease reason |
| `LH_GPU_BROKER_VRAM_GB` | Estimated VRAM (default `8`) |
| `LH_GPU_BROKER_HEARTBEAT_MS` | Heartbeat interval (default `30000`) |
| `LH_GPU_BROKER_LEASE_PATH` | Default `/api/lease` |
| `LH_GPU_BROKER_HEARTBEAT_PATH` | Default `/api/lease/{id}/heartbeat` |
| `LH_GPU_BROKER_RELEASE_PATH` | Default `/api/lease/{id}/release` |
| `LH_PRACTICE_SKIP_LLM` | Skip model calls in daily build |

Trusted single-user server (e.g. Tailscale). No separate auth layer on these routes.
