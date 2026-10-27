# Practice quiz engine (Choice)

LearnHarness builds daily multiple-choice cards for the **Choice** phone app. The server stores subjects and answer sources; local models (Ollama via provider `ollama`) write question wording only. Correct answers and distractors always come from **confirmed** entries you approved.

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
| `groove-id` | Hit grid SVG → name the groove |
| `image-pick` | Text label → pick one of four images |
| `label-pick` | Image → pick one of four labels |

## Daily build

`POST /api/practice/daily-build` optional body `{ "modelId": "your-ollama-model" }`.

Schedule on the host (example 06:15):

```bash
curl -s -X POST http://127.0.0.1:3000/api/practice/daily-build -H "Content-Type: application/json" -d '{}'
```

Optional GPU broker: set `LH_GPU_BROKER_URL` (POST `/acquire` and `/release`). A 503 from the model endpoint stops the run cleanly.

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
| `LH_GPU_BROKER_URL` | Optional GPU lease broker |
| `LH_PRACTICE_SKIP_LLM` | Skip model calls in daily build |

Trusted single-user server (e.g. Tailscale). No separate auth layer on these routes.
